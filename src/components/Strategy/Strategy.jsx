import React, { useState } from 'react'
import { Row, Col, Select, InputNumber, Button, Statistic, Tag, Table, Divider } from 'antd'
import { PlayCircleOutlined, ThunderboltOutlined, TrophyOutlined, CloudOutlined, DatabaseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { runBacktest } from '../../data/mockEngine'
import { getKLineData } from '../../services/stockService'
import { STOCKS } from '../../data/stockPool'
import { formatPercent, getChangeColor } from '../../utils/helpers'
import './Strategy.css'

const presetStrategies = [
    { name: '双均线金叉', desc: '短期均线上穿长期均线买入，下穿卖出', maShort: 5, maLong: 20 },
    { name: '趋势追踪', desc: '10日均线上穿60日均线买入', maShort: 10, maLong: 60 },
    { name: '稳健型', desc: '20日均线上穿120日均线买入', maShort: 20, maLong: 120 },
]

export default function Strategy() {
    const [selectedStock, setSelectedStock] = useState(STOCKS[0].code)
    const [maShort, setMaShort] = useState(5)
    const [maLong, setMaLong] = useState(20)
    const [initialCapital, setInitialCapital] = useState(1000000)
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [dataSource, setDataSource] = useState(null) // 'live' | 'mock'

    const stock = STOCKS.find(s => s.code === selectedStock) || STOCKS[0]

    const handleBacktest = async () => {
        setLoading(true)
        try {
            const { data: kline, isLive } = await getKLineData(selectedStock, 250)
            setDataSource(isLive ? 'live' : 'mock')
            const r = runBacktest({ maShort, maLong, initialCapital }, kline)
            setResult(r)
        } catch (err) {
            console.error('回测失败:', err)
        } finally {
            setLoading(false)
        }
    }

    const equityOption = result ? {
        grid: { top: 30, right: 20, bottom: 30, left: 65 },
        legend: {
            data: ['策略净值', '基准(买入持有)'],
            textStyle: { color: '#8b949e' },
            top: 0,
        },
        xAxis: {
            data: result.equityCurve.map(d => d.date.slice(5)),
            axisLabel: { color: '#6e7681', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
        },
        yAxis: {
            axisLabel: { color: '#6e7681', fontSize: 10, formatter: v => (v / 10000).toFixed(0) + '万' },
            splitLine: { lineStyle: { color: 'rgba(48,54,61,0.3)' } },
            axisLine: { show: false },
        },
        series: [
            {
                name: '策略净值', type: 'line', data: result.equityCurve.map(d => d.value),
                smooth: true, symbol: 'none',
                lineStyle: { color: '#58a6ff', width: 2 },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(88,166,255,0.15)' }, { offset: 1, color: 'transparent' }] } },
            },
            {
                name: '基准(买入持有)', type: 'line', data: result.benchmarkCurve.map(d => d.value),
                smooth: true, symbol: 'none',
                lineStyle: { color: '#8b949e', width: 1.5, type: 'dashed' },
            },
        ],
        tooltip: {
            trigger: 'axis', backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
            textStyle: { color: '#e6edf3', fontSize: 12 },
        },
    } : null

    const tradeColumns = [
        { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
        {
            title: '操作', dataIndex: 'type', key: 'type', width: 80,
            render: v => <Tag color={v === 'BUY' ? 'red' : 'green'}>{v === 'BUY' ? '买入' : '卖出'}</Tag>
        },
        {
            title: '价格', dataIndex: 'price', key: 'price', width: 90,
            render: v => <span style={{ fontFamily: 'var(--font-mono)' }}>{v.toFixed(2)}</span>
        },
        { title: '数量', dataIndex: 'shares', key: 'shares', width: 80 },
        {
            title: '盈亏', dataIndex: 'profit', key: 'profit', width: 100,
            render: v => v !== undefined ? <span style={{ color: getChangeColor(v), fontFamily: 'var(--font-mono)' }}>{v >= 0 ? '+' : ''}{v.toFixed(0)}</span> : '--'
        },
    ]

    return (
        <div className="strategy-page">
            <div className="page-header">
                <h2><span className="glow-text">量化策略回测引擎</span></h2>
                <p>
                    配置交易策略参数，基于历史数据进行策略回测与分析
                    {dataSource && (
                        <Tag color={dataSource === 'live' ? 'green' : 'default'} style={{ marginLeft: 12, borderRadius: 12 }}>
                            {dataSource === 'live' ? <><CloudOutlined /> 实时数据</> : <><DatabaseOutlined /> 模拟数据</>}
                        </Tag>
                    )}
                </p>
            </div>

            <Row gutter={16}>
                <Col xs={24} lg={8}>
                    <div className="glass-card strategy-config">
                        <h3 className="card-title"><ThunderboltOutlined /> 策略配置</h3>

                        <div className="preset-strategies">
                            {presetStrategies.map(s => (
                                <div
                                    key={s.name}
                                    className={`preset-item ${maShort === s.maShort && maLong === s.maLong ? 'active' : ''}`}
                                    onClick={() => { setMaShort(s.maShort); setMaLong(s.maLong) }}
                                >
                                    <div className="preset-name">{s.name}</div>
                                    <div className="preset-desc">{s.desc}</div>
                                </div>
                            ))}
                        </div>

                        <Divider style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />

                        <div className="config-field">
                            <label>标的股票</label>
                            <Select
                                value={selectedStock}
                                onChange={setSelectedStock}
                                showSearch
                                optionFilterProp="label"
                                style={{ width: '100%' }}
                                options={STOCKS.slice(0, 30).map(s => ({
                                    value: s.code, label: `${s.code} ${s.name}`,
                                }))}
                            />
                        </div>

                        <div className="config-row">
                            <div className="config-field">
                                <label>短期均线</label>
                                <InputNumber value={maShort} onChange={setMaShort} min={2} max={60} style={{ width: '100%' }} />
                            </div>
                            <div className="config-field">
                                <label>长期均线</label>
                                <InputNumber value={maLong} onChange={setMaLong} min={10} max={250} style={{ width: '100%' }} />
                            </div>
                        </div>

                        <div className="config-field">
                            <label>初始资金</label>
                            <InputNumber
                                value={initialCapital} onChange={setInitialCapital}
                                min={100000} step={100000}
                                formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <Button
                            type="primary" icon={<PlayCircleOutlined />} block size="large"
                            onClick={handleBacktest} loading={loading}
                            className="run-btn"
                        >
                            运行回测
                        </Button>
                    </div>
                </Col>

                <Col xs={24} lg={16}>
                    {result ? (
                        <>
                            <div className="grid-4 stats-grid">
                                {[
                                    { label: '总收益率', value: formatPercent(result.summary.totalReturn), color: getChangeColor(result.summary.totalReturn) },
                                    { label: '年化收益', value: formatPercent(result.summary.annualizedReturn), color: getChangeColor(result.summary.annualizedReturn) },
                                    { label: '最大回撤', value: `-${result.summary.maxDrawdown}%`, color: '#d29922' },
                                    { label: '夏普比率', value: result.summary.sharpeRatio.toFixed(2), color: result.summary.sharpeRatio > 1 ? '#3fb950' : '#f85149' },
                                ].map((s, i) => (
                                    <div key={i} className="glass-card stat-card animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid-4 stats-grid" style={{ marginTop: 12 }}>
                                {[
                                    { label: '交易次数', value: result.summary.totalTrades },
                                    { label: '胜率', value: result.summary.winRate + '%' },
                                    { label: '基准收益', value: formatPercent(result.summary.benchmarkReturn) },
                                    { label: '最终资金', value: '¥' + (result.summary.finalEquity / 10000).toFixed(1) + '万' },
                                ].map((s, i) => (
                                    <div key={i} className="glass-card stat-card">
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value" style={{ fontSize: 18 }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="glass-card" style={{ marginTop: 16 }}>
                                <h3 className="card-title"><TrophyOutlined /> 收益曲线</h3>
                                <ReactECharts option={equityOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
                            </div>

                            <div className="glass-card" style={{ marginTop: 16 }}>
                                <h3 className="card-title">交易记录</h3>
                                <Table
                                    dataSource={result.trades.map((t, i) => ({ ...t, key: i }))}
                                    columns={tradeColumns}
                                    size="small"
                                    pagination={{ pageSize: 8, size: 'small' }}
                                    style={{ marginTop: 8 }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="glass-card empty-state">
                            <PlayCircleOutlined className="empty-icon" />
                            <h3>配置策略参数并运行回测</h3>
                            <p>选择标的股票、设置均线参数，点击"运行回测"查看策略表现</p>
                        </div>
                    )}
                </Col>
            </Row>
        </div>
    )
}
