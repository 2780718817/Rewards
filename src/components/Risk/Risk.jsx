import React, { useMemo } from 'react'
import { Row, Col, Table, Tag, Spin } from 'antd'
import { SafetyOutlined, PieChartOutlined, WarningOutlined, ExperimentOutlined, CloudOutlined, DatabaseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useStockList } from '../../hooks/useMarketData'
import { formatPercent, getChangeColor, formatNumber, seededRandom } from '../../utils/helpers'
import './Risk.css'

export default function Risk() {
    const { data: allStocks, loading, isLive } = useStockList(1, 100)

    // 模拟持仓（从股票列表中选取部分股票作为持仓）
    const portfolio = useMemo(() => {
        if (!allStocks || allStocks.length === 0) return []
        const validStocks = allStocks.filter(s => s.price != null && s.price > 0)
        if (validStocks.length === 0) return []
        const picks = [0, 2, 7, 14, 19, 25, 35, 45].filter(i => i < validStocks.length)
        return picks.map((idx, i) => {
            const s = validStocks[idx] || validStocks[0]
            const rng = seededRandom(i * 13 + 5)
            const shares = Math.round(rng() * 5000 / 100) * 100 + 100
            const costPrice = +(s.price * (1 + (rng() - 0.5) * 0.15)).toFixed(2)
            const marketValue = +(s.price * shares).toFixed(2)
            const costValue = +(costPrice * shares).toFixed(2)
            const profit = +(marketValue - costValue).toFixed(2)
            const profitPct = +((marketValue / costValue - 1) * 100).toFixed(2)
            return { ...s, shares, costPrice, marketValue, costValue, profit, profitPct }
        })
    }, [allStocks])

    // 相关性矩阵 — 必须在 early return 之前调用以遵守 React Hooks 规则
    const corrNames = useMemo(() => portfolio.slice(0, 6).map(p => p.name), [portfolio])
    const corrMatrix = useMemo(() => {
        const n = corrNames.length
        if (n === 0) return []
        const data = []
        const rng = seededRandom(77)
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const val = i === j ? 1 : +(rng() * 1.4 - 0.3).toFixed(2)
                data.push([i, j, Math.max(-1, Math.min(1, val))])
            }
        }
        return data
    }, [corrNames.length])

    if (loading || !allStocks || portfolio.length === 0) {
        return (
            <div className="risk-page">
                <div className="page-header">
                    <h2><span className="glow-text">风控中心</span></h2>
                    <p>持仓分析 · VaR风险度量 · 相关性矩阵 · 情景压力测试</p>
                </div>
                <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
            </div>
        )
    }

    const totalValue = portfolio.reduce((s, p) => s + p.marketValue, 0)
    const totalCost = portfolio.reduce((s, p) => s + p.costValue, 0)
    const totalProfit = totalValue - totalCost
    const totalProfitPct = totalCost > 0 ? ((totalValue / totalCost - 1) * 100) : 0

    // 持仓分布饼图
    const pieOption = {
        tooltip: {
            backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
            textStyle: { color: '#e6edf3' },
            formatter: p => `${p.name}<br/>市值: ¥${formatNumber(p.value)}<br/>占比: ${p.percent.toFixed(1)}%`,
        },
        series: [{
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: '#0d1117', borderWidth: 2, borderRadius: 4 },
            label: { color: '#8b949e', fontSize: 11, formatter: '{b}\n{d}%' },
            labelLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
            data: portfolio.map((p, i) => ({
                name: p.name,
                value: p.marketValue,
                itemStyle: { color: ['#58a6ff', '#bc8cff', '#f85149', '#3fb950', '#d29922', '#f0c060', '#e679a0', '#6cb4ee'][i] },
            })),
        }],
    }

    const corrOption = {
        grid: { top: 10, right: 30, bottom: 60, left: 70 },
        xAxis: {
            type: 'category', data: corrNames, position: 'bottom',
            axisLabel: { color: '#8b949e', fontSize: 10, rotate: 30 },
            axisLine: { show: false }, axisTick: { show: false },
        },
        yAxis: {
            type: 'category', data: corrNames,
            axisLabel: { color: '#8b949e', fontSize: 10 },
            axisLine: { show: false }, axisTick: { show: false },
        },
        visualMap: {
            min: -1, max: 1, show: true, orient: 'horizontal',
            left: 'center', bottom: 0,
            inRange: { color: ['#3fb950', '#1c2128', '#f85149'] },
            textStyle: { color: '#6e7681' },
        },
        series: [{
            type: 'heatmap',
            data: corrMatrix,
            label: { show: true, color: '#e6edf3', fontSize: 10, formatter: p => p.value[2].toFixed(2) },
            itemStyle: { borderColor: '#0d1117', borderWidth: 2, borderRadius: 3 },
        }],
        tooltip: {
            backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
            textStyle: { color: '#e6edf3' },
            formatter: p => `${corrNames[p.value[0]]} × ${corrNames[p.value[1]]}<br/>相关系数: <b>${p.value[2].toFixed(2)}</b>`,
        },
    }

    // VaR 计算
    const var95 = +(totalValue * 0.018).toFixed(0)
    const var99 = +(totalValue * 0.028).toFixed(0)

    // 情景分析
    const scenarios = [
        { name: '牛市冲击', desc: '市场上涨15%', impact: +(totalValue * 0.15).toFixed(0), pct: 15 },
        { name: '温和上涨', desc: '市场上涨5%', impact: +(totalValue * 0.05).toFixed(0), pct: 5 },
        { name: '震荡盘整', desc: '市场波动±2%', impact: +(totalValue * -0.01).toFixed(0), pct: -1 },
        { name: '温和下跌', desc: '市场下跌5%', impact: +(totalValue * -0.06).toFixed(0), pct: -6 },
        { name: '系统崩溃', desc: '市场暴跌15%', impact: +(totalValue * -0.18).toFixed(0), pct: -18 },
        { name: '黑天鹅', desc: '市场暴跌30%', impact: +(totalValue * -0.35).toFixed(0), pct: -35 },
    ]

    const scenarioOption = {
        grid: { top: 10, right: 30, bottom: 30, left: 80 },
        xAxis: { show: false },
        yAxis: {
            type: 'category',
            data: scenarios.map(s => s.name),
            axisLabel: { color: '#8b949e', fontSize: 12 },
            axisLine: { show: false }, axisTick: { show: false },
            inverse: true,
        },
        series: [{
            type: 'bar',
            data: scenarios.map(s => ({
                value: s.impact,
                itemStyle: {
                    color: s.impact >= 0
                        ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(248,81,73,0.3)' }, { offset: 1, color: 'rgba(248,81,73,0.8)' }] }
                        : { type: 'linear', x: 1, y: 0, x2: 0, y2: 0, colorStops: [{ offset: 0, color: 'rgba(63,185,80,0.3)' }, { offset: 1, color: 'rgba(63,185,80,0.8)' }] },
                    borderRadius: s.impact >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
                },
            })),
            label: {
                show: true, position: 'right', color: '#8b949e', fontSize: 11,
                formatter: p => (p.value >= 0 ? '+' : '') + formatNumber(p.value),
            },
        }],
        tooltip: {
            backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
            textStyle: { color: '#e6edf3' },
        },
    }

    const portfolioColumns = [
        {
            title: '股票', key: 'stock', width: 120, fixed: 'left',
            render: (_, r) => <><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', marginRight: 6 }}>{r.code}</span>{r.name}</>
        },
        {
            title: '现价', dataIndex: 'price', key: 'price', width: 80,
            render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{v.toFixed(2)}</span>
        },
        { title: '持仓', dataIndex: 'shares', key: 'shares', width: 70 },
        {
            title: '市值', dataIndex: 'marketValue', key: 'mv', width: 100,
            render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{formatNumber(v)}</span>
        },
        {
            title: '盈亏', dataIndex: 'profit', key: 'profit', width: 100,
            render: v => <span style={{ color: getChangeColor(v), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{formatNumber(v)}</span>
        },
        {
            title: '收益率', dataIndex: 'profitPct', key: 'profitPct', width: 90, sorter: (a, b) => a.profitPct - b.profitPct,
            render: v => <span style={{ color: getChangeColor(v), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatPercent(v)}</span>
        },
        {
            title: '占比', key: 'weight', width: 70,
            render: (_, r) => {
                const w = (r.marketValue / totalValue * 100).toFixed(1)
                return <span style={{ fontFamily: 'var(--font-mono)' }}>{w}%</span>
            }
        },
    ]

    return (
        <div className="risk-page">
            <div className="page-header">
                <h2><span className="glow-text">风控中心</span></h2>
                <p>
                    持仓分析 · VaR风险度量 · 相关性矩阵 · 情景压力测试
                    <Tag color={isLive ? 'green' : 'default'} style={{ marginLeft: 12, borderRadius: 12 }}>
                        {isLive ? <><CloudOutlined /> 实时数据</> : <><DatabaseOutlined /> 模拟数据</>}
                    </Tag>
                </p>
            </div>

            {/* 总览 */}
            <div className="grid-4" style={{ marginBottom: 16 }}>
                {[
                    { label: '总市值', value: `¥${formatNumber(totalValue)}`, icon: <PieChartOutlined />, color: '#58a6ff' },
                    { label: '总盈亏', value: `${totalProfit >= 0 ? '+' : ''}¥${formatNumber(totalProfit)}`, icon: totalProfit >= 0 ? <ExperimentOutlined /> : <WarningOutlined />, color: getChangeColor(totalProfit) },
                    { label: '收益率', value: formatPercent(totalProfitPct), color: getChangeColor(totalProfitPct) },
                    { label: '持仓数量', value: `${portfolio.length} 只`, color: '#bc8cff' },
                ].map((s, i) => (
                    <div key={i} className="glass-card stat-card animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s`, textAlign: 'center' }}>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <Row gutter={16}>
                {/* 持仓分布 */}
                <Col xs={24} md={10}>
                    <div className="glass-card">
                        <h3 className="card-title"><PieChartOutlined /> 持仓分布</h3>
                        <ReactECharts option={pieOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
                    </div>
                </Col>

                {/* VaR */}
                <Col xs={24} md={14}>
                    <div className="glass-card">
                        <h3 className="card-title"><WarningOutlined /> VaR 风险度量</h3>
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <div className="var-card">
                                    <div className="var-level">95% VaR (1日)</div>
                                    <div className="var-value">¥ {formatNumber(var95)}</div>
                                    <div className="var-desc">有5%概率日内亏损超过此值</div>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div className="var-card danger">
                                    <div className="var-level">99% VaR (1日)</div>
                                    <div className="var-value">¥ {formatNumber(var99)}</div>
                                    <div className="var-desc">有1%概率日内亏损超过此值</div>
                                </div>
                            </Col>
                        </Row>
                        <h3 className="card-title"><ExperimentOutlined /> 情景压力测试</h3>
                        <ReactECharts option={scenarioOption} style={{ height: 200 }} opts={{ renderer: 'svg' }} />
                    </div>
                </Col>
            </Row>

            {/* 相关性矩阵 */}
            <div className="glass-card" style={{ marginTop: 16 }}>
                <h3 className="card-title"><SafetyOutlined /> 资产相关性矩阵</h3>
                <ReactECharts option={corrOption} style={{ height: 350 }} opts={{ renderer: 'canvas' }} />
            </div>

            {/* 持仓明细 */}
            <div className="glass-card" style={{ marginTop: 16 }}>
                <h3 className="card-title">持仓明细</h3>
                <Table
                    dataSource={portfolio.map((p, i) => ({ ...p, key: i }))}
                    columns={portfolioColumns}
                    size="small"
                    scroll={{ x: 700 }}
                    pagination={false}
                />
            </div>
        </div>
    )
}
