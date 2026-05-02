/**
 * 行情 API 基础请求封装
 * 主数据源: 腾讯行情 (qt.gtimg.cn / web.ifzq.gtimg.cn)
 * 备用数据源: 东方财富 (push2.eastmoney.com)
 * 通过 Vite proxy 中转，解决 CORS 跨域问题
 */

// ====== 基础设施 ======

/**
 * 通用 JSON 请求
 */
async function requestJSON(url, timeout = 5000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
    } catch (err) {
        clearTimeout(timer)
        console.warn(`[API] JSON请求失败: ${url.slice(0, 80)}...`, err.message)
        return null
    }
}

/**
 * 通用文本请求 (腾讯行情返回 GBK 编码，需手动解码)
 */
async function requestText(url, timeout = 4000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // 腾讯行情API返回GBK编码，必须用TextDecoder手动解码
        const buf = await res.arrayBuffer()
        const decoder = new TextDecoder('gbk')
        return decoder.decode(buf)
    } catch (err) {
        clearTimeout(timer)
        console.warn(`[API] Text请求失败: ${url.slice(0, 80)}...`, err.message)
        return null
    }
}

// ====== 腾讯行情 API ======

/**
 * 将股票代码转为腾讯格式
 * 沪市 6xx/9xx/000xxx(指数) → sh+code, 深市 0xx/3xx/399xxx(指数) → sz+code
 */
export function toQQCode(code) {
    if (!code) return ''
    code = code.toLowerCase()
    // 若自带 sh/sz/bj 前缀，直接返回
    if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('bj')) {
        return code
    }
    // 指数特殊处理
    if (code === '000001' && !code.includes('sz')) {
        // 在我们系统中，000001一般作为股票列表里的平安银行。如果是上证指数一般用 sh000001 调用。
        // 为了兼容性，如果你确实想查000001平安银行，应该是 sz000001。默认返回 sz000001。
        return `sz${code}`
    }
    if (code === '000300' || code === '000905' || code === '000688') {
        return `sh${code}`
    }
    // 沪市
    if (code.startsWith('6') || code.startsWith('9') || code.startsWith('11') || code.startsWith('5')) {
        return `sh${code}`
    }
    // 北交所
    if (code.startsWith('8') || code.startsWith('4')) {
        return `bj${code}`
    }
    // 深市
    return `sz${code}`
}

/**
 * 批量获取实时行情 (腾讯 qt.gtimg.cn)
 * @param {string[]} codes - 股票代码数组 如 ['sh600519', 'sz000858']
 * @returns {Array|null} 解析后的行情数组
 *
 * 腾讯行情返回格式（~分隔）:
 * 0:未知 1:名称 2:代码 3:当前价 4:昨收 5:开盘 6:成交量(手) 7:外盘 8:内盘
 * 9:买一价 10:买一量 ... 29:最高 30:日期时间 31:涨跌额 32:涨跌幅 33:最高价(重) 34:最低价
 * 35:价格/成交量/成交额 36:成交量(手) 37:成交额(万) 38:换手率 39:市盈率
 * 44:最高 45:最低 46:振幅 47:流通市值 48:总市值 49:市净率
 */
export async function fetchQQQuotes(qqCodes) {
    const url = `/api/qq/qt?date=2026-05-02&q=${qqCodes.join(',')}`
    const text = await requestText(url)
    if (!text) return null

    const results = []
    // 每行格式: v_sh600519="1~贵州茅台~600519~1455.02~...";
    const lines = text.split(';').filter(l => l.includes('~'))
    for (const line of lines) {
        const match = line.match(/="(.+)"/)
        if (!match) continue
        const parts = match[1].split('~')
        if (parts.length < 50) continue

        results.push({
            name: parts[1],
            code: parts[2],
            price: parseFloat(parts[3]) || 0,
            prevClose: parseFloat(parts[4]) || 0,
            open: parseFloat(parts[5]) || 0,
            volume: parseInt(parts[6]) || 0,
            high: parseFloat(parts[33]) || 0,
            low: parseFloat(parts[34]) || 0,
            change: parseFloat(parts[31]) || 0,
            changePercent: parseFloat(parts[32]) || 0,
            turnover: parseFloat(parts[37]) || 0,       // 成交额(万)
            turnoverRate: parseFloat(parts[38]) || 0,    // 换手率
            pe: parseFloat(parts[39]) || 0,              // 市盈率
            pb: parseFloat(parts[46]) || parseFloat(parts[49]) || 0,  // 市净率
            amplitude: parseFloat(parts[43]) || 0,       // 振幅
            totalCap: parseFloat(parts[44]) || parseFloat(parts[48]) || 0,  // 总市值(亿)
            flowCap: parseFloat(parts[45]) || parseFloat(parts[47]) || 0,   // 流通市值(亿)
        })
    }

    return results.length > 0 ? results : null
}

/**
 * 获取 K 线数据 (腾讯 web.ifzq.gtimg.cn)
 * @param {string} qqCode - 如 'sh600519'
 * @param {number} count - K线数量
 * @returns {object|null} { code, name, klines: [{date,open,close,high,low,volume},...] }
 */
export async function fetchQQKLine(qqCode, count = 250, period = 'day') {
    // 使用不复权K线，确保价格与实时行情一致
    // period: 'day' | 'week' | 'month'
    const url = `/api/qq/ifzq/appstock/app/fqkline/get?_var=kline_day&param=${qqCode},${period},,,${count},`
    const text = await requestText(url)
    if (!text) return null

    try {
        // 返回格式: kline_day={...json...}
        const jsonStr = text.replace(/^[^=]+=/, '')
        const json = JSON.parse(jsonStr)
        const codeKey = Object.keys(json.data || {})[0]
        if (!codeKey) return null

        const stockData = json.data[codeKey]
        const klines = stockData[period] || stockData.day || stockData.qfqday || []
        if (klines.length === 0) return null

        return {
            code: codeKey,
            name: stockData.qt?.[codeKey]?.[1] || codeKey,
            klines: klines.map(k => ({
                date: k[0],
                open: parseFloat(k[1]),
                close: parseFloat(k[2]),
                high: parseFloat(k[3]),
                low: parseFloat(k[4]),
                volume: parseInt(k[5]) || 0,
            })),
        }
    } catch (err) {
        console.warn('[API] 解析K线数据失败:', err.message)
        return null
    }
}

// ====== 东方财富 API (备用 + 全A股列表) ======

const PUSH2_BASE = '/api/em/push2'
const PUSH2HIS_BASE = '/api/em/push2his'

function buildUrl(base, path, params = {}) {
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    return `${base}${path}${qs ? '?' + qs : ''}`
}

/**
 * [东方财富] 获取指数行情 (备用)
 */
export async function fetchEMIndices(secids = '1.000001,0.399001,0.399006') {
    const url = buildUrl(PUSH2_BASE, '/api/qt/ulist.np/get', {
        fltt: 2, secids, fields: 'f2,f3,f4,f5,f6,f7,f8,f12,f13,f14',
    })
    return requestJSON(url)
}

/**
 * [东方财富] K线数据 (备用)
 */
export async function fetchEMKLine(secid, { klt = '101', lmt = 250, beg = '0', end = '20500101', fqt = '1' } = {}) {
    const url = buildUrl(PUSH2HIS_BASE, '/api/qt/stock/kline/get', {
        secid, fields1: 'f1,f2,f3,f4,f5,f6',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        klt, fqt, beg, end, lmt,
    })
    return requestJSON(url)
}

/**
 * [东方财富] 分页拉取全A股列表（每页100条）
 * push2delay 接口单次最多返回100条，需要分页获取
 */
async function fetchEMAllStocksOnce() {
    const PAGE_SIZE = 100
    const fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048'
    const fields = 'f12,f13,f14,f2,f3,f4,f5,f6,f8,f9,f23,f20,f21'
    const baseParams = {
        pz: PAGE_SIZE, po: 1, np: 1,
        ut: 'bd1d9ddb04089700cf9c27f6f7426281',
        fltt: 2, invt: 2, fid: 'f3',
        wbp2u: '|0|0|0|web',
        fs, fields,
    }

    const parseItems = (diff) => {
        const marketMap = { 1: 'sh', 0: 'sz' }
        return (diff || []).map(item => ({
            code: String(item.f12).padStart(6, '0'),
            name: item.f14 || '',
            market: marketMap[item.f13] ?? 'sz',
            price: item.f2 === '-' ? 0 : (item.f2 || 0),
            changePercent: item.f3 === '-' ? 0 : (item.f3 || 0),
            change: item.f4 === '-' ? 0 : (item.f4 || 0),
            volume: item.f5 || 0,
            turnover: item.f6 || 0,
            turnoverRate: item.f8 === '-' ? 0 : (item.f8 || 0),
            pe: item.f9 === '-' ? 0 : (item.f9 || 0),
            pb: item.f23 === '-' ? 0 : (item.f23 || 0),
            totalCap: item.f20 || 0,
            flowCap: item.f21 || 0,
        }))
    }

    // 第1页：获取总数
    const firstUrl = buildUrl(PUSH2_BASE, '/api/qt/clist/get', { ...baseParams, pn: 1, _: Date.now() })
    const firstJson = await requestJSON(firstUrl, 12000)
    if (!firstJson?.data?.diff) return []

    const total = firstJson.data.total || 0
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const allItems = [...parseItems(firstJson.data.diff)]

    if (totalPages <= 1) return allItems

    // 剩余页并发拉取（分批，每批10个并发，避免频率过高）
    const BATCH = 10
    for (let startPage = 2; startPage <= totalPages; startPage += BATCH) {
        const endPage = Math.min(startPage + BATCH - 1, totalPages)
        const pageNums = []
        for (let p = startPage; p <= endPage; p++) pageNums.push(p)

        const batchResults = await Promise.all(
            pageNums.map(pn => {
                const url = buildUrl(PUSH2_BASE, '/api/qt/clist/get', { ...baseParams, pn, _: Date.now() })
                return requestJSON(url, 12000)
            })
        )
        batchResults.forEach(json => {
            if (json?.data?.diff) allItems.push(...parseItems(json.data.diff))
        })
    }

    return allItems
}

// 全A股列表内存缓存 (10分钟有效)
let _allStocksCache = null
let _allStocksCacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

/**
 * 获取全A股列表（沪深京合并，带缓存）
 * @param {boolean} force - true 时跳过缓存强制重新请求
 * @returns {Promise<Array>} 所有A股数组
 */
export async function fetchAllAStocks(force = false) {
    const now = Date.now()
    if (!force && _allStocksCache && now - _allStocksCacheTime < CACHE_TTL) {
        return _allStocksCache
    }

    // 强制刺新时清空缓存
    if (force) {
        _allStocksCache = null
        _allStocksCacheTime = 0
    }

    console.log('[全A股] 开始分页拉取全量数据...')
    const all = await fetchEMAllStocksOnce()
    const filtered = all.filter(s => s.code && s.name && s.name !== '-')
    console.log(`[全A股] 共获取 ${filtered.length} 只股票`)

    if (filtered.length > 100) {
        _allStocksCache = filtered
        _allStocksCacheTime = now
    }

    return filtered
}
