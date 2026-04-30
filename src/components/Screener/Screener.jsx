import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Slider, Tag, Table, Switch, Spin, Tooltip, Drawer, Row, Col, Radio, Input, Badge, message, Alert, Modal, notification, Select } from 'antd'
import { FilterOutlined, ThunderboltOutlined, CloudOutlined, DatabaseOutlined, LineChartOutlined, SafetyOutlined, StarFilled, StarOutlined, BulbOutlined, SearchOutlined, SwapOutlined, BellOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useAllStocks, useSectorData } from '../../hooks/useMarketData'
import { fetchQQKLine, toQQCode } from '../../services/api'
import { addCustomStockToPool } from '../../data/stockPool'
import { STRATEGIES, FACTOR_META, computeScores, getScoreLevel } from '../../utils/scoringEngine'
import { analyzeStock, getSignalStyle, getRiskStyle, getTrendStyle, getPositionStyle } from '../../utils/signalEngine'
import { formatPercent, formatNumber, getChangeColor } from '../../utils/helpers'
import './Screener.css'

// ===== 多列排序列头组件 =====
// 直接点击即可叠加排序，无需 Shift
function SortHeader({ label, sortKey, sortRules, onSort }) {
    const idx = sortRules.findIndex(r => r.key === sortKey)
    const rule = idx >= 0 ? sortRules[idx] : null
    const priority = idx + 1
    const priorityBadges = ['', '①', '②', '③', '④', '⑤']

    const arrow = rule?.dir === 'desc' ? ' ▼' : rule?.dir === 'asc' ? ' ▲' : null
    const hint = rule
        ? (rule.dir === 'desc' ? '再次点击切换为升序' : '再次点击取消此列排序')
        : '点击添加此列降序排序'

    return (
        <span
            className="multi-sort-header"
            onClick={() => onSort(sortKey)}
            title={hint}
            style={{
                cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                color: rule ? 'var(--color-primary)' : 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 2,
            }}
        >
            {label}
            {rule && <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>{arrow}</span>}
            {priority > 0 && sortRules.length > 1 && (
                <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 1, lineHeight: 1, verticalAlign: 'super' }}>
                    {priorityBadges[priority] || `(${priority})`}
                </span>
            )}
        </span>
    )
}

// ===== 自选股 localStorage 管理 =====
const FAV_KEY = 'quantmaster_favs'
function loadFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] } }
function saveFavs(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)) }

// ===== 信号缓存 localStorage 管理 =====
const SIGNAL_CACHE_KEY = 'quantmaster_signal_cache'
const SIGNAL_CACHE_TTL = 4 * 60 * 60 * 1000 // 4小时过期
function loadSignalCache() {
    try {
        const raw = JSON.parse(localStorage.getItem(SIGNAL_CACHE_KEY) || '{}')
        if (raw.timestamp && Date.now() - raw.timestamp < SIGNAL_CACHE_TTL && raw.data) return raw.data
    } catch { }
    return null
}
function saveSignalCache(data) {
    try { localStorage.setItem(SIGNAL_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })) } catch { }
}
function clearSignalCache() {
    try { localStorage.removeItem(SIGNAL_CACHE_KEY) } catch { }
}

export default function Screener() {
    const [activeStrategy, setActiveStrategy] = useState('momentum')
    const [customWeights, setCustomWeights] = useState({ pe: 20, pb: 20, changePercent: 20, turnoverRate: 20, totalCap: 20 })
    const [peRange, setPeRange] = useState([0, 200])
    const [pbRange, setPbRange] = useState([0, 20])
    const [onlyUp, setOnlyUp] = useState(false)     //仅看上涨
    // 多列排序：[{key, dir}]，默认空（scored 内部已按评分倒序兜底）
    const [sortRules, setSortRules] = useState([])
    const [excludeGEM, setExcludeGEM] = useState(false)    // 默认排除创业板 (300/301)
    const [excludeStar, setExcludeStar] = useState(true)  // 默认排除科创板 (688xxx)
    const [excludeBSE, setExcludeBSE] = useState(true)    // 默认排除北交所 (8字头、4字头、9字头)

    // ====== 智能诊股筛选状态（pending = 下拉框当前值，applied = 已生效值）======
    const [pendingSignalFilter, setPendingSignalFilter] = useState('all')
    const [pendingTrendFilter, setPendingTrendFilter] = useState('all')
    const [pendingPositionFilter, setPendingPositionFilter] = useState('all')
    const [pendingRiskFilter, setPendingRiskFilter] = useState('all')
    const [signalFilter, setSignalFilter] = useState('all')
    const [trendFilter, setTrendFilter] = useState('all')
    const [positionFilter, setPositionFilter] = useState('all')
    const [riskFilter, setRiskFilter] = useState('all')
    // 是否有待应用但尚未生效的改动
    const hasPendingChange =
        pendingSignalFilter !== signalFilter || pendingTrendFilter !== trendFilter ||
        pendingPositionFilter !== positionFilter || pendingRiskFilter !== riskFilter
    const hasActiveFilter = signalFilter !== 'all' || trendFilter !== 'all' || positionFilter !== 'all' || riskFilter !== 'all'

    const [onlyFav, setOnlyFav] = useState(false)
    const [favs, setFavs] = useState(loadFavs)
    const [searchText, setSearchText] = useState('')

    const [signalMap, setSignalMap] = useState({})
    const [signalLoading, setSignalLoading] = useState(false)

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedStock, setSelectedStock] = useState(null)
    const [detailKlines, setDetailKlines] = useState(null)
    const [detailAnalysis, setDetailAnalysis] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [klinePeriod, setKlinePeriod] = useState('day')

    // ====== 实时信号预警状态 ======
    const [alertMessages, setAlertMessages] = useState([])
    const alertNotifiedCodes = useRef(new Set()) // 记录已通知过的股票和信号 { "000001-buy": timestamp }

    // 将预警数量广播给全局 (AppLayout)
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('quant-alert-update', { detail: { count: alertMessages.length } }))
    }, [alertMessages])

    const [isAlertPolling, setIsAlertPolling] = useState(true) // 默认开启
    const [alertIntervalMin, setAlertIntervalMin] = useState(3) // 预警轮询间隔（分钟）
    const [signalVersion, setSignalVersion] = useState(0) // 手动刷新时递增，触发信号重计算
    const [signalProgress, setSignalProgress] = useState({ done: 0, total: 0 }) // 信号计算进度

    // ====== 个股详情实时刷新状态 ======
    const [isDetailPolling, setIsDetailPolling] = useState(false)
    const [detailPollInterval, setDetailPollInterval] = useState(10000) // 默认10s
    const detailLastSignalRef = useRef(null) // 记录当前个股上一个信号

    const [autoRefreshData, setAutoRefreshData] = useState(false) // 是否实时获取列表数据，默认关闭

    const { data: allStocks, loading, isLive, lastUpdate, refetch: refetchStocks } = useAllStocks(autoRefreshData)
    const { data: sectorData } = useSectorData(autoRefreshData)

    // 板块热度映射: industry -> changePercent (用于联动加权)
    const sectorHeat = useMemo(() => {
        if (!sectorData) return {}
        const map = {}
        const sorted = [...sectorData].sort((a, b) => b.changePercent - a.changePercent)
        sorted.forEach((s, i) => {
            map[s.name] = { rank: i + 1, total: sorted.length, change: s.changePercent }
        })
        return map
    }, [sectorData])

    // NEW角标: 缓存上一轮信号，检测新信号
    const [prevSignalMap, setPrevSignalMap] = useState({})

    // 切换收藏
    const toggleFav = useCallback((code, e) => {
        if (e) {
            e.stopPropagation()
            e.preventDefault()
        }
        setFavs(prev => {
            const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
            saveFavs(next)
            return next
        })
    }, [])

    const currentStrategy = useMemo(() => {
        const base = STRATEGIES.find(s => s.key === activeStrategy) || STRATEGIES[0]
        if (activeStrategy !== 'custom') return base
        const totalW = Object.values(customWeights).reduce((a, b) => a + b, 0) || 1
        const factors = {}
        for (const [key, w] of Object.entries(customWeights)) {
            const defaultFactor = STRATEGIES[4].factors[key]
            factors[key] = { weight: w / totalW, ascending: defaultFactor?.ascending ?? (key === 'pe' || key === 'pb'), label: FACTOR_META[key]?.label || key }
        }
        return { ...base, factors }
    }, [activeStrategy, customWeights])


    // ==========================================
    // 自选股实时信号监听引擎（独立运行，不依赖实时刷新数据开关）
    // ==========================================
    useEffect(() => {
        if (!isAlertPolling || favs.length === 0) return;

        let pollTimer;
        const POLLING_INTERVAL = alertIntervalMin * 60 * 1000;

        const checkFavSignals = async () => {
            if (favs.length === 0) return;
            try {
                // 仅对自选股发起分析请求
                const results = await Promise.all(
                    favs.map(async (code) => {
                        const stock = allStocks?.find(s => s.code === code)
                        const kData = await fetchQQKLine(toQQCode(code), 120)
                        if (kData?.klines) {
                            return { code, name: stock?.name || code, analysis: analyzeStock(kData.klines, stock?.price, stock?.name) }
                        }
                        return null;
                    })
                )

                const newAlerts = [];
                results.forEach(res => {
                    if (!res || !res.analysis) return;
                    const { code, name, analysis } = res;
                    const { signal, signalText, reasons } = analysis;

                    // 核心过滤：只预警强买和强卖
                    if (signal === 'buy' || signal === 'sell') {
                        const notifKey = `${code}-${signal}`;

                        // 检查是否已经通知过（避免重复轰炸，当天同一个信号只提醒一次）
                        if (!alertNotifiedCodes.current.has(notifKey)) {
                            alertNotifiedCodes.current.add(notifKey);

                            newAlerts.push({
                                id: Date.now() + Math.random(),
                                code, name, signal, signalText, reasons,
                                time: new Date().toLocaleTimeString()
                            });

                            // 系统级 Notification
                            if (Notification.permission === 'granted') {
                                new Notification(`【系统预警】${name} (${code})`, {
                                    body: `触发${signalText}信号！\n原因：${reasons[0]}`,
                                    icon: '/vite.svg'
                                });
                            }

                            // Antd 应用内强通知
                            notification[signal === 'buy' ? 'success' : 'warning']({
                                message: `实时预警：${name} (${code})`,
                                description: `当前触发【${signalText}】信号！\n${reasons[0]}`,
                                duration: 10,
                                placement: 'topRight',
                            });
                        }
                    }

                    // 顺便更新一下缓存，让主界面同步更新
                    setSignalMap(prev => {
                        if (prev[code]?.signal !== signal) {
                            return { ...prev, [code]: analysis };
                        }
                        return prev;
                    });
                });

                if (newAlerts.length > 0) {
                    setAlertMessages(prev => [...newAlerts, ...prev].slice(0, 10)); // 保留最新10条预警
                    // 播放提示音
                    try {
                        const audio = new Audio('/alert.mp3');
                        audio.play().catch(e => console.log('浏览器限制自动播放声音'));
                    } catch (e) { }
                }

            } catch (err) {
                console.warn('自选股预警轮询错误:', err);
            }
        };

        // 首次启动时若有 Notification 权限，请求一下
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        // 启动时立即检查一次，然后按间隔轮询
        checkFavSignals();
        pollTimer = setInterval(checkFavSignals, POLLING_INTERVAL);
        return () => clearInterval(pollTimer);
    }, [isAlertPolling, alertIntervalMin, favs, allStocks]);
    // ==========================================

    const scored = useMemo(() => {
        if (!allStocks || allStocks.length === 0) return []

        // 1. 先对全量股票进行全局评分（保证任何过滤条件下评分稳定不漂移）
        let result = computeScores(allStocks, currentStrategy)

        // 板块热度联动：热板块加分，冷板块减分（也在全量计算）
        if (Object.keys(sectorHeat).length > 0) {
            const total = Object.keys(sectorHeat).length
            result = result.map(s => {
                const industry = s.industry
                const heat = industry ? sectorHeat[industry] : null
                if (!heat) return s
                let bonus = 0
                if (heat.rank <= Math.max(3, Math.ceil(total * 0.2))) bonus = 8  // 热板块+8分
                else if (heat.rank >= total - Math.max(3, Math.ceil(total * 0.2))) bonus = -4 // 冷板块-4分
                return { ...s, _score: Math.max(0, Math.min(100, s._score + bonus)), _sectorHeat: heat }
            })
        }

        // 2. 然后应用过滤条件
        const searchLower = searchText.toLowerCase()
        let filtered = result.filter(s => {
            if (onlyFav && !favs.includes(s.code)) return false
            if (searchText && !s.code.includes(searchText) && !s.name.toLowerCase().includes(searchLower)) return false
            if (excludeGEM && (s.code.startsWith('300') || s.code.startsWith('301'))) return false
            if (excludeStar && s.code.startsWith('688')) return false
            if (excludeBSE && (s.code.startsWith('8') || s.code.startsWith('4') || s.code.startsWith('9'))) return false
            if (s.pe > 0 && (s.pe < peRange[0] || s.pe > peRange[1])) return false
            if (s.pb > 0 && (s.pb < pbRange[0] || s.pb > pbRange[1])) return false
            if (onlyUp && s.changePercent <= 0 && !favs.includes(s.code)) return false
            return true
        })

        // 3. 仅按评分做稳定初始排序（多列排序由 multiSorted 接管）
        filtered.sort((a, b) => b._score - a._score)

        return filtered
        // 注意：scored 不含信号过滤，信号过滤在 signalFiltered 中独立完成，避免循环依赖
    }, [allStocks, currentStrategy, peRange, pbRange, onlyUp, excludeGEM, excludeStar, excludeBSE, onlyFav, favs, sectorHeat, searchText])

    // ===== 信号计算：评分前 300 只，60根K线，20并发，4.5s超时 =====
    // scored 不含信号过滤，所以不存在循环依赖
    const signalComputingRef = useRef(false)
    const scoredRef = useRef([])
    useEffect(() => {
        scoredRef.current = scored
    })

    // 计算全部筛选出来的股票（仅看上涨+排除三板后约400-800只，可在1-2分钟内完成）

    useEffect(() => {
        if (!scored || scored.length === 0) return

        // 先尝试读缓存（首次加载直接用）
        const cached = loadSignalCache()
        if (cached && Object.keys(cached).length > 0) {
            setSignalMap(cached)
            setPrevSignalMap(prev => Object.keys(prev).length === 0 ? { ...cached } : prev)
            setSignalProgress({ done: scored.length, total: scored.length })
            return
        }

        // 全量计算（按策略评分已排好序，最优股票最先出结果）
        const target = scored
        const need = target.filter(s => !signalMap[s.code])
        if (need.length === 0) {
            setSignalProgress({ done: target.length, total: target.length })
            return
        }

        // 用 AbortController 控制取消，保证 cleanup 后立即中止 in-flight 请求
        const controller = new AbortController()
        signalComputingRef.current = true
        let doneCount = target.length - need.length

        setSignalProgress({ done: doneCount, total: target.length })
        setSignalLoading(true)

        // 带 AbortSignal + 超时保护的 K 线请求
        async function fetchWithCancel(code, price, name) {
            const TIMEOUT_MS = 4500
            return new Promise(resolve => {
                const timer = setTimeout(() => resolve({ code, analysis: null }), TIMEOUT_MS)
                fetchQQKLine(toQQCode(code), 60)  // 60根够用，传输量砍半
                    .then(kData => {
                        clearTimeout(timer)
                        if (controller.signal.aborted) return resolve({ code, analysis: null })
                        if (kData?.klines) resolve({ code, analysis: analyzeStock(kData.klines, price, name) })
                        else resolve({ code, analysis: null })
                    })
                    .catch(() => { clearTimeout(timer); resolve({ code, analysis: null }) })
            })
        }

        async function computeAll() {
            const accumulated = { ...signalMap }
            const BATCH = 10
            for (let i = 0; i < need.length; i += BATCH) {
                if (controller.signal.aborted) break
                const group = need.slice(i, i + BATCH)
                const results = await Promise.all(
                    group.map(s => fetchWithCancel(s.code, s.price, s.name))
                )
                if (controller.signal.aborted) break
                results.forEach(r => { if (r.analysis) accumulated[r.code] = r.analysis })
                doneCount += group.length
                setSignalMap({ ...accumulated })
                setSignalProgress({ done: Math.min(doneCount, target.length), total: target.length })
            }
            if (!controller.signal.aborted) {
                saveSignalCache(accumulated)
                setPrevSignalMap(prev => Object.keys(prev).length === 0 ? { ...accumulated } : prev)
                setSignalLoading(false)
                setSignalProgress(p => ({ ...p, done: p.total }))
            }
            // 无论正常结束还是取消，都释放锁
            signalComputingRef.current = false
        }

        computeAll()
        return () => {
            controller.abort()              // 取消 in-flight 请求
            signalComputingRef.current = false  // ★ 修复：立即释放锁，让新 Effect 能正常启动
        }
    }, [scored, signalVersion])



    // ===== 信号过滤：始终只展示有信号数据的股票，纯内存运算 =====
    const signalFiltered = useMemo(() => {
        const isDone = signalProgress.done >= signalProgress.total && signalProgress.total > 0
        const noFilter = signalFilter === 'all' && trendFilter === 'all' && positionFilter === 'all' && riskFilter === 'all'

        if (!isDone) {
            // 尚在计算中：展示已有信号的（逐步呈现）+ 尚未计算的一并展示
            if (noFilter) return scored
            return scored.filter(s => {
                const sig = signalMap[s.code]
                if (!sig) return false
                return applySignalFilter(sig)
            })
        }

        // 计算完成：只展示成功获得信号的股票
        return scored.filter(s => {
            const sig = signalMap[s.code]
            if (!sig) return false  // 过滤掉计算失败（超时/无K线）的股票
            if (noFilter) return true
            return applySignalFilter(sig)
        })

        function applySignalFilter(sig) {
            if (signalFilter === 'buy' && sig.signal !== 'buy' && sig.signal !== 'buy_weak') return false
            if (signalFilter === 'sell' && sig.signal !== 'sell' && sig.signal !== 'sell_weak') return false
            if (trendFilter !== 'all' && sig.trend !== trendFilter) return false
            if (positionFilter !== 'all') {
                if (positionFilter === 'heavy' && sig.positionLevel < 3) return false
                if (positionFilter === 'half' && sig.positionLevel !== 2) return false
                if (positionFilter === 'light' && sig.positionLevel !== 1) return false
                if (positionFilter === 'reduce' && sig.positionLevel !== 0) return false
                if (positionFilter === 'empty' && sig.positionLevel !== -1) return false
            }
            if (riskFilter !== 'all' && sig.riskLevel !== riskFilter) return false
            return true
        }
    }, [scored, signalMap, signalFilter, trendFilter, positionFilter, riskFilter, signalProgress])

    // 多键排序：在 scored 结果上叠加用户指定的排序规则
    const SORT_VALUE = {
        '_score': s => s._score || 0,
        'price': s => s.price || 0,
        'changePercent': s => s.changePercent || 0,
        'pe': s => s.pe || 0,
        'turnoverRate': s => s.turnoverRate || 0,
        'totalCap': s => s.totalCap || 0,
    }
    const multiSorted = useMemo(() => {
        if (!sortRules.length) return signalFiltered
        return [...signalFiltered].sort((a, b) => {
            for (const { key, dir } of sortRules) {
                const fn = SORT_VALUE[key]
                if (!fn) continue
                const va = fn(a), vb = fn(b)
                if (va === vb) continue
                return dir === 'asc' ? va - vb : vb - va
            }
            return 0
        })
    }, [scored, sortRules])

    // 列头点击：直接叠加（每列独立循环 无→降→升→无）
    const handleSort = useCallback((key) => {
        setSortRules(prev => {
            const idx = prev.findIndex(r => r.key === key)
            // 循环：当前无 -> desc, desc -> asc, asc -> 移除
            if (idx < 0) {
                return [...prev, { key, dir: 'desc' }]
            }
            const cur = prev[idx].dir
            if (cur === 'desc') return prev.map(r => r.key === key ? { key, dir: 'asc' } : r)
            return prev.filter(r => r.key !== key)   // asc -> 移除
        })
    }, [])

    // 信号变动检测
    const signalChanges = useMemo(() => {
        if (Object.keys(prevSignalMap).length === 0 || Object.keys(signalMap).length === 0) return []
        const changes = []
        for (const [code, curr] of Object.entries(signalMap)) {
            const prev = prevSignalMap[code]
            if (prev && prev.signal !== curr.signal) {
                const stock = allStocks?.find(s => s.code === code)
                changes.push({ code, name: stock?.name || code, from: prev.signalText, to: curr.signalText, fromSignal: prev.signal, toSignal: curr.signal })
            }
        }
        return changes
    }, [signalMap, prevSignalMap, allStocks])

    const openDetail = useCallback(async (stock) => {
        setSelectedStock(stock)
        setDrawerOpen(true)
        setDetailLoading(true)
        setDetailKlines(null); setDetailAnalysis(null)
        setKlinePeriod('day')
        setIsDetailPolling(false) // 打开时默认关闭实时拉取（按需手动开启）
        detailLastSignalRef.current = null
        try {
            const kData = await fetchQQKLine(toQQCode(stock.code), 120)
            if (kData?.klines) {
                setDetailKlines(kData.klines)
                const analysis = analyzeStock(kData.klines, stock.price, stock.name)
                setDetailAnalysis(analysis)
                detailLastSignalRef.current = analysis.signal
            }
        } catch (err) { console.warn('加载K线失败', err) }
        setDetailLoading(false)
    }, [])

    // K线周期切换
    const handlePeriodChange = useCallback(async (period) => {
        if (!selectedStock) return
        setKlinePeriod(period)
        setDetailLoading(true)
        try {
            const kData = await fetchQQKLine(toQQCode(selectedStock.code), 120, period)
            if (kData?.klines) {
                setDetailKlines(kData.klines)
                const analysis = analyzeStock(kData.klines, selectedStock.price, selectedStock.name)
                setDetailAnalysis(analysis)
                detailLastSignalRef.current = analysis.signal
            }
        } catch (err) { console.warn('加载K线失败', err) }
        setDetailLoading(false)
    }, [selectedStock])

    // ==========================================
    // 个股详情实时拉取引擎
    // ==========================================
    useEffect(() => {
        if (!drawerOpen || !selectedStock || !isDetailPolling) return;
        let pTimer;

        const fetchDetailData = async () => {
            try {
                // 如果需要更精准的实时价格，这里可以增加 fetchQQQuotes。这里暂用最后一口K线或 allStocks 中的更新价。
                const currentFromList = allStocks?.find(s => s.code === selectedStock.code)?.price || selectedStock.price;
                const kData = await fetchQQKLine(toQQCode(selectedStock.code), 120, klinePeriod);
                if (kData?.klines) {
                    setDetailKlines(kData.klines);
                    const analysis = analyzeStock(kData.klines, currentFromList, selectedStock.name);
                    setDetailAnalysis(analysis);

                    // 判断买卖点是否有变化
                    const lastSignal = detailLastSignalRef.current;
                    const currSignal = analysis.signal;

                    if (lastSignal && currSignal !== lastSignal && (currSignal === 'buy' || currSignal === 'sell')) {
                        notification[currSignal === 'buy' ? 'success' : 'warning']({
                            message: `个股异动预警：${selectedStock.name}`,
                            description: `实时监控到该股触发【${analysis.signalText}】信号！\n原因：${analysis.reasons[0]}`,
                            duration: 10,
                            placement: 'topRight',
                        });

                        try {
                            new Audio('/alert.mp3').play().catch(() => { });
                        } catch (e) { }
                    }
                    detailLastSignalRef.current = currSignal;
                }
            } catch (err) {
                console.warn('个股详情轮询拉取失败:', err);
            }
        };

        pTimer = setInterval(fetchDetailData, detailPollInterval);
        return () => clearInterval(pTimer);
    }, [drawerOpen, selectedStock, isDetailPolling, detailPollInterval, klinePeriod, allStocks]);
    // ==========================================

    // 自定义添加代码
    const handleAddCustomStock = useCallback((val) => {
        const code = addCustomStockToPool(val)
        if (!code) {
            message.error('无效的代码格式（需6位数字）或已存在')
            return
        }
        setFavs(prev => {
            const next = prev.includes(code) ? prev : [...prev, code]
            saveFavs(next)
            return next
        })
        message.success(`已添加代码 ${code} 并加入自选`)
        // signalLoadedRef.current = false // 重置信号加载，确保新加的股票也能被计算 // This line was commented out, keeping it that way.
        refetchStocks() // 重新拉取以加载新股票的基础数据和实时行情
    }, [refetchStocks])

    // 多策略对比：当前股票在各策略下的得分
    const multiStrategyScores = useMemo(() => {
        if (!selectedStock || !allStocks || allStocks.length === 0) return []
        return STRATEGIES.filter(s => s.key !== 'custom').map(strategy => {
            const scored = computeScores(allStocks, strategy)
            const found = scored.find(s => s.code === selectedStock.code)
            return { key: strategy.key, name: strategy.name, icon: strategy.icon, color: strategy.color, score: found?._score || 0 }
        })
    }, [selectedStock, allStocks])

    // K线图 + 历史信号标注
    const klineOption = useMemo(() => {
        if (!detailKlines || !detailAnalysis) return null
        const dates = detailKlines.map(k => k.date)
        const ohlc = detailKlines.map(k => [k.open, k.close, k.low, k.high])
        const vols = detailKlines.map(k => k.volume)
        const closes = detailKlines.map(k => k.close)
        const { series, signalMarks } = detailAnalysis
        const lastIdx = dates.length - 1
        // 缓存实时涨跌数据（用于最后一根K线）
        const liveChange = selectedStock?.change
        const liveChangePct = selectedStock?.changePercent
        const livePrevClose = selectedStock?.prevClose

        // 将历史买卖信号转为 markPoint
        const buyMarks = signalMarks.filter(m => m.type === 'buy').map(m => {
            const idx = dates.indexOf(m.date)
            return idx >= 0 ? {
                coord: [m.date, detailKlines[idx].low * 0.97],
                value: '买', symbol: 'triangle', symbolSize: 18,
                itemStyle: { color: '#ef4444', shadowColor: 'rgba(239,68,68,0.6)', shadowBlur: 6 },
                label: { show: true, color: '#ef4444', fontSize: 10, fontWeight: 'bold', position: 'bottom' },
            } : null
        }).filter(Boolean).slice(-15)

        const sellMarks = signalMarks.filter(m => m.type === 'sell').map(m => {
            const idx = dates.indexOf(m.date)
            return idx >= 0 ? {
                coord: [m.date, detailKlines[idx].high * 1.03],
                value: '卖', symbol: 'arrow', symbolSize: 20, symbolRotate: 180,
                itemStyle: { color: '#3fb950', shadowColor: 'rgba(63,185,80,0.6)', shadowBlur: 6 },
                label: { show: true, color: '#3fb950', fontSize: 10, fontWeight: 'bold', position: 'top' },
            } : null
        }).filter(Boolean).slice(-15)

        return {
            animation: false, backgroundColor: 'transparent',
            grid: [
                { left: 50, right: 20, top: 30, height: '55%' },
                { left: 50, right: 20, top: '72%', height: '18%' },
            ],
            xAxis: [
                { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false }, splitLine: { show: false } },
                { type: 'category', data: dates, gridIndex: 1, axisLabel: { fontSize: 10, color: '#8b949e' }, splitLine: { show: false } },
            ],
            yAxis: [
                { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { fontSize: 10, color: '#8b949e' } },
                { gridIndex: 1, scale: true, splitLine: { show: false }, axisLabel: { show: false } },
            ],
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: 'rgba(20,25,35,0.95)', borderColor: '#333', textStyle: { color: '#e6edf3', fontSize: 12 },
                formatter: function (params) {
                    if (!params || params.length === 0) return ''
                    const kParam = params.find(p => p.seriesName === 'K线')
                    if (!kParam) return ''

                    const idx = kParam.dataIndex
                    const v = kParam.value  // [dim, open, close, low, high]
                    if (!v || v.length < 5) return ''

                    const open = v[1], close = v[2], low = v[3], high = v[4]

                    // 修正：涨跌幅应对比“昨收”，而不是“今开”
                    const prevClose = idx > 0 ? detailKlines[idx - 1].close : open
                    const change = close - prevClose
                    const changePct = (change / prevClose * 100).toFixed(2)
                    const color = change >= 0 ? '#ef4444' : '#3fb950'

                    return `<div style="font-size:13px;line-height:1.8;padding:4px">
                        <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #333">${dates[idx]}</div>
                         <div style="display:flex;justify-content:space-between;gap:30px"><span>开盘</span><b style="color:#ddd">${open.toFixed(2)}</b></div>
                         <div style="display:flex;justify-content:space-between;gap:30px"><span>收盘</span><b style="color:${color}">${close.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)</b></div>
                         <div style="display:flex;justify-content:space-between;gap:30px"><span>最高</span><b style="color:#ef4444">${high.toFixed(2)}</b></div>
                         <div style="display:flex;justify-content:space-between;gap:30px"><span>最低</span><b style="color:#3fb950">${low.toFixed(2)}</b></div>
                         <div style="display:flex;justify-content:space-between;gap:30px"><span>成交量</span><b style="color:#f59e0b">${vols[idx] ? (vols[idx] / 10000).toFixed(0) + '万' : '-'}</b></div>
                    </div>`
                },
            },
            dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 }],
            series: [
                {
                    name: 'K线', type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
                    itemStyle: { color: '#ef4444', color0: '#3fb950', borderColor: '#ef4444', borderColor0: '#3fb950' },
                    markPoint: { data: [...buyMarks, ...sellMarks], label: { show: false } },
                },
                { name: 'MA5', type: 'line', data: series.ma5, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { width: 1 }, symbol: 'none', itemStyle: { color: '#f59e0b' } },
                { name: 'MA20', type: 'line', data: series.ma20, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { width: 1 }, symbol: 'none', itemStyle: { color: '#3b82f6' } },
                {
                    name: '成交量', type: 'bar',
                    data: vols.map((v, i) => ({ value: v, itemStyle: { color: closes[i] >= (closes[i - 1] || closes[i]) ? 'rgba(239,68,68,0.5)' : 'rgba(63,185,80,0.5)' } })),
                    xAxisIndex: 1, yAxisIndex: 1,
                },
            ],
        }
    }, [detailKlines, detailAnalysis, selectedStock])

    const columns = [
        {
            title: '★', key: 'fav', width: 36, fixed: 'left',
            render: (_, r) => <span className="fav-btn" onClick={e => toggleFav(r.code, e)}>{favs.includes(r.code) ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined style={{ color: '#555' }} />}</span>,
        },
        { title: '#', key: 'rank', width: 42, fixed: 'left', render: (_, __, i) => <span className={`rank-badge ${i < 3 ? 'rank-top' : ''}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span> },
        { title: '代码', dataIndex: 'code', key: 'code', width: 72, fixed: 'left', render: v => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>{v}</span> },
        { title: '名称', dataIndex: 'name', key: 'name', width: 80, fixed: 'left', render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
        {
            title: '信号', key: 'signal', width: 80,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig) return <span className="signal-tag signal-loading">···</span>
                const st = getSignalStyle(sig.signal)
                // NEW角标：上一轮无信号或信号不同
                const prev = prevSignalMap[r.code]
                const isNew = prev && prev.signal !== sig.signal && (sig.signal === 'buy' || sig.signal === 'sell')
                return <Tooltip title={sig.reasons.join('；')}><span className="signal-tag" style={{ background: st.bg, color: st.color }}>{st.icon} {st.text}{isNew && <span className="signal-new">NEW</span>}</span></Tooltip>
            },
        },
        {
            title: '趋势', key: 'trend', width: 62,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig) return <span style={{ color: '#555' }}>-</span>
                const st = getTrendStyle(sig.trend)
                return <span className="trend-tag" style={{ background: st.bg, color: st.color }}>{st.icon}{st.text}</span>
            },
        },
        {
            title: '仓位', key: 'position', width: 55,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig) return <span style={{ color: '#555' }}>-</span>
                const st = getPositionStyle(sig.positionLevel)
                return <Tooltip title={sig.positionPct}><span className="position-tag" style={{ background: st.bg, color: st.color }}>{st.text}</span></Tooltip>
            },
        },
        {
            title: '风险', key: 'risk', width: 45,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig) return <span style={{ color: '#555' }}>-</span>
                const st = getRiskStyle(sig.riskLevel)
                return <Tooltip title={`止损:${sig.stopLoss}(${sig.stopLossPercent}%) 止盈:${sig.takeProfit}(+${sig.takeProfitPercent}%)`}><span className="risk-tag" style={{ background: st.bg, color: st.color }}>{st.text}</span></Tooltip>
            },
        },
        {
            title: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <SortHeader label="评分" sortKey="_score" sortRules={sortRules} onSort={handleSort} />
                    {!sortRules.find(r => r.key === '_score') && (
                        <span style={{ fontSize: 10, color: '#555', fontWeight: 'normal' }}>默认↓</span>
                    )}
                </span>
            ),
            dataIndex: '_score', key: 'score', width: 110,
            render: (score, r) => {
                const { level, color, bg } = getScoreLevel(score)
                return (
                    <Tooltip title={<div className="score-tooltip"><div className="score-tooltip-title">因子评分</div>{Object.entries(r._details || {}).map(([k, v]) => <div key={k} className="score-tooltip-row"><span>{FACTOR_META[k]?.label || k}</span><span style={{ color: v >= 60 ? '#f59e0b' : '#8b949e' }}>{v}</span></div>)}</div>}>
                        <div className="score-cell">
                            <span className="score-badge" style={{ background: bg, color }}>{level}</span>
                            <div className="score-bar-wrap"><div className="score-bar" style={{ width: `${score}%`, background: color }} /></div>
                            <span className="score-value" style={{ color }}>{score}</span>
                        </div>
                    </Tooltip>
                )
            },
        },
        { title: <SortHeader label="现价" sortKey="price" sortRules={sortRules} onSort={handleSort} />, dataIndex: 'price', key: 'price', width: 70, render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{v?.toFixed(2) || '-'}</span> },
        { title: <SortHeader label="涨跌幅" sortKey="changePercent" sortRules={sortRules} onSort={handleSort} />, dataIndex: 'changePercent', key: 'cp', width: 75, render: v => <span style={{ color: getChangeColor(v), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatPercent(v)}</span> },
        { title: <SortHeader label="PE" sortKey="pe" sortRules={sortRules} onSort={handleSort} />, dataIndex: 'pe', key: 'pe', width: 55, render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{v > 0 ? v.toFixed(1) : '亏损'}</span> },
        { title: <SortHeader label="换手" sortKey="turnoverRate" sortRules={sortRules} onSort={handleSort} />, dataIndex: 'turnoverRate', key: 'tr', width: 60, render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{v?.toFixed(2)}%</span> },
        {
            // #7: 综合信号分（100分制），基于信号强度+趋势+周线+风险+胜率综合打分
            title: <Tooltip title="信号强度×20 + 上升趋势+20 + 低风险+15 + 历史胜率≥60%+15 = 最高100分"><span style={{ cursor: 'help', borderBottom: '1px dashed #555' }}>综合分</span></Tooltip>,
            key: 'composite', width: 70,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig) return <span style={{ color: '#555' }}>-</span>
                const score = Math.min(100,
                    (sig.signalStrength || 0) * 20 +
                    (sig.trend === 'up' ? 20 : 0) +
                    (sig.riskLevel === 'low' ? 15 : sig.riskLevel === 'medium' ? 8 : 0) +
                    (sig.backtest?.winRate >= 60 && sig.backtest?.tradeCount >= 3 ? 15 : 0)
                )
                const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : score >= 40 ? '#3b82f6' : '#6b7280'
                return <Tooltip title={sig.advice}><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color, fontSize: 13 }}>{score}</span></Tooltip>
            },
        },
        {
            // #8: 历史回测胜率
            title: <Tooltip title="基于K线历史信号的胜率统计（止盈8%/止损5%规则）"><span style={{ cursor: 'help', borderBottom: '1px dashed #555' }}>胜率</span></Tooltip>,
            key: 'winrate', width: 60,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig || !sig.backtest || sig.backtest.tradeCount < 2) return <span style={{ color: '#555' }}>-</span>
                const { winRate, tradeCount } = sig.backtest
                const color = winRate >= 60 ? '#3fb950' : winRate >= 45 ? '#f59e0b' : '#ef4444'
                return <Tooltip title={`${tradeCount}次交易`}><span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{winRate}%</span></Tooltip>
            },
        },
        {
            // #9: 距支撑位百分比（越小=越靠近支撑=更好的买点）
            title: <Tooltip title="当前价距20日最低支撑位的百分比，越小说明越靠近支撑，买点越优"><span style={{ cursor: 'help', borderBottom: '1px dashed #555' }}>距支撑</span></Tooltip>,
            key: 'toSupport', width: 65,
            render: (_, r) => {
                const sig = signalMap[r.code]
                if (!sig || !sig.support || !r.price) return <span style={{ color: '#555' }}>-</span>
                const pct = +((r.price - sig.support) / sig.support * 100).toFixed(1)
                const color = pct <= 3 ? '#ef4444' : pct <= 8 ? '#f59e0b' : '#8b949e'
                const tip = `支撑:${sig.support}  阻力:${sig.resistance}`
                return <Tooltip title={tip}><span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: pct <= 3 ? 700 : 400 }}>+{pct}%</span></Tooltip>
            },
        },
    ]

    return (
        <div className="screener-page">
            <div className="page-header">
                <h2><span className="glow-text">智能选股器</span></h2>
                <p>
                    多因子评分 · 买卖信号 · 趋势研判 · 风控建议
                    <Tag color={isLive ? 'green' : 'default'} style={{ marginLeft: 12, borderRadius: 12 }}>
                        {isLive ? <><CloudOutlined /> 实时数据 · 全A股({allStocks?.length || 0}只)</> : <><DatabaseOutlined /> 模拟数据</>}
                    </Tag>
                    {lastUpdate && !autoRefreshData && (
                        <Tag color="orange" style={{ marginLeft: 8, borderRadius: 12, fontSize: 11 }}>
                            更新于 {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Tag>
                    )}
                    {signalLoading && <Tag color="blue" style={{ marginLeft: 8, borderRadius: 12 }}>⏳ 信号计算中...</Tag>}
                </p>
            </div>

            <div className="strategy-grid">
                {STRATEGIES.map(s => (
                    <div key={s.key} className={`strategy-card ${activeStrategy === s.key ? 'active' : ''}`} style={{ '--strategy-color': s.color }} onClick={() => setActiveStrategy(s.key)}>
                        <div className="strategy-icon">{s.icon}</div>
                        <div className="strategy-info"><div className="strategy-name">{s.name}</div><div className="strategy-desc">{s.desc}</div></div>
                        {activeStrategy === s.key && <div className="strategy-active-dot" />}
                    </div>
                ))}
            </div>

            {/* ====== 实时预警横幅 ====== */}
            {favs.length > 0 && (
                <div className="alert-banner-container">
                    <Alert
                        message={
                            <div className="alert-banner-content">
                                <span>
                                    <BellOutlined className={isAlertPolling ? 'pulsing-bell' : ''} />
                                    {' '}自选股预警监控
                                    {isAlertPolling
                                        ? <Tag color="green" style={{ marginLeft: 8, borderRadius: 10, fontSize: 11 }}>● 监控中 · 每 {alertIntervalMin} 分钟</Tag>
                                        : <Tag color="default" style={{ marginLeft: 8, borderRadius: 10, fontSize: 11 }}>已暂停</Tag>
                                    }
                                    {alertMessages.length > 0 && <Tag color="red" style={{ marginLeft: 4, borderRadius: 10, fontSize: 11 }}>{alertMessages.length} 条预警</Tag>}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: '#8b949e' }}>间隔</span>
                                    <Select
                                        size="small"
                                        value={alertIntervalMin}
                                        onChange={setAlertIntervalMin}
                                        style={{ width: 80 }}
                                        options={[
                                            { value: 1, label: '1 分钟' },
                                            { value: 2, label: '2 分钟' },
                                            { value: 3, label: '3 分钟' },
                                            { value: 5, label: '5 分钟' },
                                            { value: 10, label: '10 分钟' },
                                            { value: 30, label: '30 分钟' },
                                        ]}
                                    />
                                    <Switch checkedChildren="开" unCheckedChildren="停" checked={isAlertPolling} onChange={setIsAlertPolling} size="small" />
                                    {alertMessages.length > 0 && <a onClick={() => {
                                        setAlertMessages([])
                                        alertNotifiedCodes.current.clear()
                                        window.dispatchEvent(new CustomEvent('quant-alert-clear'))
                                    }}>清除</a>}
                                </div>
                            </div>
                        }
                        description={alertMessages.length > 0 ? (
                            <div className="alert-banner-list">
                                {alertMessages.map(msg => (
                                    <div key={msg.id} className="alert-msg-item">
                                        <span className="alert-time">{msg.time}</span>
                                        <span style={{ fontWeight: 600 }}>{msg.name} ({msg.code})</span>
                                        <Tag color={msg.signal === 'buy' ? 'error' : 'success'} style={{ marginLeft: 8 }}>{msg.signalText}</Tag>
                                        <span className="alert-reason">{msg.reasons[0]}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span style={{ fontSize: 12, color: '#555' }}>
                                {isAlertPolling ? `正在监控 ${favs.length} 只自选股，触发买入/卖出信号时自动提醒` : '预警已暂停，点击右侧开关启动监控'}
                            </span>
                        )}
                        type="info"
                        showIcon={false}
                        banner
                        className="live-alert-banner"
                    />
                </div>
            )}
            {/* ====== ====== */}


            <Row gutter={16}>
                <Col xs={24} lg={6}>
                    <div className="glass-card filter-panel">
                        {activeStrategy === 'custom' ? (
                            <>
                                <h3 className="card-title"><ThunderboltOutlined /> 因子权重</h3>
                                {Object.entries(customWeights).map(([key, val]) => (
                                    <div key={key} className="filter-section"><label>{FACTOR_META[key]?.label || key}<span className="weight-value">{val}%</span></label><Slider min={0} max={100} value={val} onChange={v => setCustomWeights(p => ({ ...p, [key]: v }))} /></div>
                                ))}
                            </>
                        ) : (
                            <>
                                <h3 className="card-title"><FilterOutlined /> 当前策略</h3>
                                <div className="strategy-detail">
                                    <div className="strategy-detail-name">{currentStrategy.icon} {currentStrategy.name}</div>
                                    <div className="factor-weights">
                                        {Object.entries(currentStrategy.factors).map(([k, f]) => (
                                            <div key={k} className="factor-item"><span className="factor-label">{f.label}</span><div className="factor-bar-wrap"><div className="factor-bar" style={{ width: `${f.weight * 100}%`, background: currentStrategy.color }} /></div><span className="factor-pct">{Math.round(f.weight * 100)}%</span></div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="filter-divider" />
                        <div className="filter-divider" />
                        <h3 className="card-title"><FilterOutlined /> 辅助筛选</h3>
                        <div className="filter-section filter-switch"><div className="switch-row"><span>🔄 实时刷新数据</span><Switch checked={autoRefreshData} onChange={setAutoRefreshData} size="small" /></div></div>
                        {!autoRefreshData && (
                            <div className="filter-section">
                                <button
                                    onClick={async () => {
                                        // 清空信号缓存 + 重置 signalMap，让信号跟随新数据重算
                                        clearSignalCache()
                                        setSignalMap({})
                                        setPrevSignalMap({})
                                        setSignalVersion(v => v + 1)
                                        await refetchStocks()
                                    }}
                                    disabled={loading}
                                    style={{
                                        width: "100%", padding: "6px 0",
                                        background: loading ? "rgba(99,179,237,0.1)" : "rgba(99,179,237,0.2)",
                                        border: "1px solid rgba(99,179,237,0.4)",
                                        borderRadius: 6, color: "#63b3ed",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        fontSize: 13, display: "flex", alignItems: "center",
                                        justifyContent: "center", gap: 6, transition: "background 0.2s",
                                    }}
                                >
                                    {loading ? "⏳ 加载中..." : "↻ 手动刷新数据"}
                                </button>
                            </div>
                        )}
                        <div className="filter-section filter-switch"><div className="switch-row"><span>🔵 排除创业板</span><Switch checked={excludeGEM} onChange={setExcludeGEM} size="small" /></div></div>
                        <div className="filter-section filter-switch"><div className="switch-row"><span>🔬 排除科创板</span><Switch checked={excludeStar} onChange={setExcludeStar} size="small" /></div></div>
                        <div className="filter-section filter-switch"><div className="switch-row"><span>🏛️ 排除北交所</span><Switch checked={excludeBSE} onChange={setExcludeBSE} size="small" /></div></div>
                        <div className="filter-section"><label>市盈率 (PE): {peRange[0]} - {peRange[1]}</label><Slider range min={0} max={200} value={peRange} onChange={setPeRange} /></div>
                        <div className="filter-section"><label>市净率 (PB): {pbRange[0].toFixed(1)} - {pbRange[1].toFixed(1)}</label><Slider range min={0} max={20} step={0.5} value={pbRange} onChange={setPbRange} /></div>
                        <div className="filter-section filter-switch"><div className="switch-row"><span>🚀 仅看上涨</span><Switch checked={onlyUp} onChange={setOnlyUp} size="small" /></div></div>
                        <div className="filter-section filter-switch"><div className="switch-row"><span>⭐ 仅看自选</span><Switch checked={onlyFav} onChange={setOnlyFav} size="small" /></div></div>
                        <div className="filter-section" style={{ marginTop: 8 }}>
                            <Input.Search placeholder="输入6位代码添加自选" enterButton="添加" onSearch={handleAddCustomStock} size="small" />
                        </div>
                        <div className="filter-result-count"><ThunderboltOutlined /> 筛选出 <strong style={{ color: 'var(--color-primary)' }}>{scored.length}</strong> 只股票</div>
                    </div>
                </Col>
                <Col xs={24} lg={18}>
                    <div className="glass-card">
                        {/* 搜索 + 信号变动提醒 */}
                        <div className="screener-toolbar">
                            <Input prefix={<SearchOutlined style={{ color: '#8b949e' }} />} placeholder="搜索代码或名称" value={searchText} onChange={e => setSearchText(e.target.value)} allowClear className="screener-search" />
                            {sortRules.length > 0 && (
                                <Tag
                                    closable
                                    onClose={() => setSortRules([])}
                                    color="blue"
                                    style={{ cursor: 'default', borderRadius: 12, marginLeft: 4 }}
                                >
                                    {sortRules.map(r => `${{
                                        '_score': '评分', price: '现价', changePercent: '涨跌幅',
                                        pe: 'PE', turnoverRate: '换手', totalCap: '市値'
                                    }[r.key] || r.key}${r.dir === 'desc' ? '▼' : '▲'}`).join(' + ')}
                                </Tag>
                            )}
                            {alertMessages.length > 0 && (
                                <Button
                                    type="link" size="small" danger
                                    onClick={() => {
                                        setAlertMessages([])
                                        alertNotifiedCodes.current.clear()
                                        window.dispatchEvent(new CustomEvent('quant-alert-clear'))
                                    }}
                                >
                                    清空预警
                                </Button>
                            )}
                            {signalChanges.length > 0 && (
                                <Badge count={signalChanges.length} size="small" offset={[-5, 0]}>
                                    <Tooltip title={<div className="signal-changes-tip">{signalChanges.map((c, i) => <div key={i}>{c.name}({c.code}): {c.from} → <b>{c.to}</b></div>)}</div>}>
                                        <Tag color="orange" style={{ cursor: 'pointer', borderRadius: 12 }}><SwapOutlined /> 信号变动</Tag>
                                    </Tooltip>
                                </Badge>
                            )}
                        </div>

                        {/* ===== 信号筛选工具栏（表格上方）===== */}
                        <div className="signal-filter-bar">
                            <div className="signal-filter-item">
                                <span className="signal-filter-label">买卖信号</span>
                                <Select value={pendingSignalFilter} onChange={setPendingSignalFilter} size="small" style={{ width: 110 }}
                                    options={[
                                        { value: 'all', label: '全部' },
                                        { value: 'buy', label: '🟢 买入/偏多' },
                                        { value: 'sell', label: '🔴 卖出/偏空' },
                                    ]}
                                />
                            </div>
                            <div className="signal-filter-item">
                                <span className="signal-filter-label">个股趋势</span>
                                <Select value={pendingTrendFilter} onChange={setPendingTrendFilter} size="small" style={{ width: 110 }}
                                    options={[
                                        { value: 'all', label: '全部' },
                                        { value: 'up', label: '📈 上升趋势' },
                                        { value: 'down', label: '📉 下降趋势' },
                                        { value: 'sideways', label: '📊 震荡整理' },
                                    ]}
                                />
                            </div>
                            <div className="signal-filter-item">
                                <span className="signal-filter-label">仓位建议</span>
                                <Select value={pendingPositionFilter} onChange={setPendingPositionFilter} size="small" style={{ width: 110 }}
                                    options={[
                                        { value: 'all', label: '全部' },
                                        { value: 'heavy', label: '重仓' },
                                        { value: 'half', label: '半仓' },
                                        { value: 'light', label: '轻仓' },
                                        { value: 'reduce', label: '减仓' },
                                        { value: 'empty', label: '空仓/观望' },
                                    ]}
                                />
                            </div>
                            <div className="signal-filter-item">
                                <span className="signal-filter-label">风险水平</span>
                                <Select value={pendingRiskFilter} onChange={setPendingRiskFilter} size="small" style={{ width: 110 }}
                                    options={[
                                        { value: 'all', label: '全部' },
                                        { value: 'low', label: '低风险' },
                                        { value: 'medium', label: '中风险' },
                                        { value: 'high', label: '高风险' },
                                    ]}
                                />
                            </div>
                            {/* 筛选 / 清除按钮 */}
                            <button
                                className={`signal-apply-btn ${hasPendingChange ? 'pending' : ''}`}
                                onClick={() => {
                                    setSignalFilter(pendingSignalFilter)
                                    setTrendFilter(pendingTrendFilter)
                                    setPositionFilter(pendingPositionFilter)
                                    setRiskFilter(pendingRiskFilter)
                                }}
                            >
                                🔍 筛选{hasPendingChange ? ' ●' : ''}
                            </button>
                            {hasActiveFilter && (
                                <button
                                    className="signal-clear-btn"
                                    onClick={() => {
                                        setPendingSignalFilter('all'); setSignalFilter('all')
                                        setPendingTrendFilter('all'); setTrendFilter('all')
                                        setPendingPositionFilter('all'); setPositionFilter('all')
                                        setPendingRiskFilter('all'); setRiskFilter('all')
                                    }}
                                >
                                    ✕ 清除
                                </button>
                            )}
                            {/* 信号计算进度 */}
                            {signalProgress.total > 0 && signalProgress.done < signalProgress.total && (
                                <div className="signal-progress">
                                    <span style={{ fontSize: 12, color: '#63b3ed' }}>
                                        ⚡ 信号计算中 {signalProgress.done}/{signalProgress.total} ({Math.round(signalProgress.done / signalProgress.total * 100)}%)
                                    </span>
                                    <div className="signal-progress-bar">
                                        <div className="signal-progress-fill" style={{ width: `${Math.round((signalProgress.done / signalProgress.total) * 100)}%` }} />
                                    </div>
                                </div>
                            )}
                            {signalProgress.total > 0 && signalProgress.done >= signalProgress.total && (
                                <Tag color="green" style={{ borderRadius: 10, fontSize: 11, marginLeft: 8 }}>✓ 信号已就绪 · 评分前{signalProgress.total}只</Tag>
                            )}
                        </div>
                        {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div> : (
                            <Table
                                dataSource={multiSorted.map((s, i) => ({ ...s, key: i }))} columns={columns} size="small" scroll={{ x: 1000 }}
                                pagination={{ pageSize: 15, size: 'small', showTotal: t => `共 ${t} 条` ,showSizeChange: (current, pageSize) => this.pageSize = pageSize}}
                                onRow={r => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
                                showSorterTooltip={false}
                            />//showSizeChange: (current, pageSize) => this.pageSize = pageSize, // 改变每页数量时更新显示
                        )}
                    </div>
                </Col>
            </Row>

            {/* Drawer 详情 */}
            <Drawer
                title={selectedStock ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span>{selectedStock.name} ({selectedStock.code})</span>
                            <span className="fav-btn" onClick={(e) => toggleFav(selectedStock.code, e)} style={{ fontSize: 18, marginTop: -2 }}>
                                {favs.includes(selectedStock.code) ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined style={{ color: '#8b949e' }} />}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'normal' }}>
                            <span style={{ color: isDetailPolling ? 'var(--color-primary)' : 'var(--text-tertiary)' }}>实时刷新</span>
                            <Switch checked={isDetailPolling} onChange={setIsDetailPolling} size="small" />
                            {isDetailPolling && (
                                <Radio.Group value={detailPollInterval} onChange={e => setDetailPollInterval(e.target.value)} size="small" buttonStyle="solid">
                                    <Radio.Button value={5000} style={{ padding: '0 8px' }}>5s</Radio.Button>
                                    <Radio.Button value={10000} style={{ padding: '0 8px' }}>10s</Radio.Button>
                                    <Radio.Button value={30000} style={{ padding: '0 8px' }}>30s</Radio.Button>
                                </Radio.Group>
                            )}
                        </div>
                    </div>
                ) : '分析'}
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setIsDetailPolling(false) }}
                width={680}
                styles={{ body: { background: 'var(--bg-primary)', padding: 16 }, header: { background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' } }}>
                {detailLoading ? <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载K线..." /></div> :
                    detailAnalysis ? (
                        <div className="detail-content">
                            {/* 实时价格横条 */}
                            <div className="detail-price-bar">
                                <div className="detail-price-main">
                                    <span className="detail-price-value" style={{ color: getChangeColor(selectedStock.changePercent) }}>{selectedStock.price?.toFixed(2)}</span>
                                    <span className="detail-price-change" style={{ color: getChangeColor(selectedStock.changePercent) }}>
                                        {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.change?.toFixed(2) || '—'}
                                        &nbsp;({selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent?.toFixed(2)}%)
                                    </span>
                                </div>
                                <div className="detail-price-meta">
                                    <span>今开 {selectedStock.open?.toFixed(2) || '—'}</span>
                                    <span>最高 {selectedStock.high?.toFixed(2) || '—'}</span>
                                    <span>最低 {selectedStock.low?.toFixed(2) || '—'}</span>
                                    <span>换手 {selectedStock.turnoverRate?.toFixed(2) || '—'}%</span>
                                </div>
                            </div>

                            {/* 信号概览 */}
                            <div className="detail-signal-summary">
                                <div className="detail-signal-main">
                                    <span className="detail-signal-icon">{getSignalStyle(detailAnalysis.signal).icon}</span>
                                    <span className="detail-signal-text" style={{ color: getSignalStyle(detailAnalysis.signal).color }}>{detailAnalysis.signalText}</span>
                                    <span className="detail-signal-strength">{'●'.repeat(detailAnalysis.signalStrength)}{'○'.repeat(5 - detailAnalysis.signalStrength)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="detail-trend-badge" style={{ background: getTrendStyle(detailAnalysis.trend).bg, color: getTrendStyle(detailAnalysis.trend).color }}>{getTrendStyle(detailAnalysis.trend).icon} {detailAnalysis.trendText}</span>
                                    <span className="detail-risk-badge" style={{ background: getRiskStyle(detailAnalysis.riskLevel).bg, color: getRiskStyle(detailAnalysis.riskLevel).color }}>{detailAnalysis.riskText}</span>
                                    <span className="detail-pos-badge" style={{ background: getPositionStyle(detailAnalysis.positionLevel).bg, color: getPositionStyle(detailAnalysis.positionLevel).color }}>建议{detailAnalysis.position}</span>
                                </div>
                            </div>

                            {/* 一句话操作建议 */}
                            <div className="advice-card"><BulbOutlined style={{ color: '#f59e0b', marginRight: 8, fontSize: 16 }} />{detailAnalysis.advice}</div>

                            {/* 信号原因 */}
                            <div className="detail-reasons">
                                {detailAnalysis.volumeDesc && <Tag color="blue" className="reason-tag">📊 {detailAnalysis.volumeDesc} (量比{detailAnalysis.volumeRatio})</Tag>}
                                {detailAnalysis.reasons.map((r, i) => <Tag key={i} className="reason-tag">{r}</Tag>)}
                            </div>

                            {/* 历史回测表现 */}
                            {detailAnalysis.backtest && detailAnalysis.backtest.tradeCount > 0 && (
                                <div className="backtest-card" style={{ padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div><span style={{ color: 'var(--text-secondary)' }}>近一年信号出现次数:</span> <strong style={{ color: 'var(--text-primary)' }}>{detailAnalysis.backtest.tradeCount}</strong> 次</div>
                                    <div><span style={{ color: 'var(--text-secondary)' }}>历史胜率:</span> <strong style={{ color: detailAnalysis.backtest.winRate >= 60 ? '#ef4444' : 'var(--text-primary)', fontSize: 15 }}>{detailAnalysis.backtest.winRate}%</strong></div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <span style={{ color: '#ef4444' }}>均盈: +{detailAnalysis.backtest.avgWin}%</span>
                                        <span style={{ color: '#3fb950' }}>均亏: {detailAnalysis.backtest.avgLoss}%</span>
                                    </div>
                                </div>
                            )}

                            {/* K线图 + 历史信号 */}
                            <div className="detail-chart-wrap">
                                <div className="detail-chart-header">
                                    <Radio.Group value={klinePeriod} onChange={e => handlePeriodChange(e.target.value)} size="small" buttonStyle="solid">
                                        <Radio.Button value="day">日K</Radio.Button>
                                        <Radio.Button value="week">周K</Radio.Button>
                                        <Radio.Button value="month">月K</Radio.Button>
                                    </Radio.Group>
                                </div>
                                {klineOption ? <ReactECharts option={klineOption} style={{ height: 320 }} /> : <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>暂无K线数据或加载中...</div>}
                                <div className="chart-legend"><span>🔺 历史买入信号</span><span>🔻 历史卖出信号</span></div>
                            </div>

                            {/* 风控 */}
                            <div className="detail-risk-grid">
                                <div className="risk-card"><div className="risk-card-label">动态止损</div><div className="risk-card-value" style={{ color: '#3fb950' }}>{detailAnalysis.stopLoss}<span className="risk-card-pct">{detailAnalysis.stopLossPercent}%</span></div></div>
                                <div className="risk-card"><div className="risk-card-label">建议止盈</div><div className="risk-card-value" style={{ color: '#ef4444' }}>{detailAnalysis.takeProfit}<span className="risk-card-pct">+{detailAnalysis.takeProfitPercent}%</span></div></div>
                                <div className="risk-card"><div className="risk-card-label">支撑位</div><div className="risk-card-value">{detailAnalysis.support}</div></div>
                                <div className="risk-card"><div className="risk-card-label">阻力位</div><div className="risk-card-value">{detailAnalysis.resistance}</div></div>
                            </div>

                            {/* 技术指标 */}
                            <div className="detail-indicators">
                                <h4><LineChartOutlined /> 技术指标</h4>
                                <div className="indicator-grid">
                                    {[
                                        { label: 'MA5', value: detailAnalysis.indicators.ma5?.toFixed(2) },
                                        { label: 'MA20', value: detailAnalysis.indicators.ma20?.toFixed(2) },
                                        { label: 'MA60', value: detailAnalysis.indicators.ma60?.toFixed(2) },
                                        { label: 'RSI(14)', value: detailAnalysis.indicators.rsi?.toFixed(1), warn: detailAnalysis.indicators.rsi > 70 || detailAnalysis.indicators.rsi < 30 },
                                        { label: 'MACD DIF', value: detailAnalysis.indicators.dif?.toFixed(3) },
                                        { label: 'MACD DEA', value: detailAnalysis.indicators.dea?.toFixed(3) },
                                        { label: 'KDJ-K', value: detailAnalysis.indicators.k?.toFixed(1) },
                                        { label: 'KDJ-J', value: detailAnalysis.indicators.j?.toFixed(1), warn: detailAnalysis.indicators.j > 80 || detailAnalysis.indicators.j < 20 },
                                        { label: 'BOLL上轨', value: detailAnalysis.indicators.bollUpper?.toFixed(2) },
                                        { label: 'BOLL下轨', value: detailAnalysis.indicators.bollLower?.toFixed(2) },
                                        { label: '量比', value: detailAnalysis.indicators.volumeRatio?.toFixed(2), warn: detailAnalysis.indicators.volumeRatio >= 2 || detailAnalysis.indicators.volumeRatio <= 0.5 },
                                        { label: '强度评分(IPS)', value: detailAnalysis.indicators.ips, warn: detailAnalysis.indicators.ips < 0 },
                                        { label: 'ATR(14)', value: detailAnalysis.atr?.toFixed(4) },
                                    ].map(ind => (
                                        <div key={ind.label} className={`indicator-item ${ind.warn ? 'indicator-warn' : ''}`}><span className="indicator-label">{ind.label}</span><span className="indicator-value">{ind.value || '-'}</span></div>
                                    ))}
                                </div>
                            </div>

                            {/* 策略对比分析 */}
                            <div className="detail-strategy-compare">
                                <h4><StarOutlined /> 多策略交叉验证</h4>
                                <div className="strategy-compare-grid">
                                    {multiStrategyScores.map(s => (
                                        <div key={s.key} className="strategy-compare-item">
                                            <span className="sc-icon">{s.icon}</span>
                                            <span className="sc-name">{s.name}</span>
                                            <span className="sc-score" style={{ color: getScoreLevel(s.score).color }}>{s.score}分</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : <div style={{ textAlign: 'center', padding: 60, color: '#8b949e' }}>暂无K线数据</div>}
            </Drawer>
        </div>
    )
}
