import React, { useState, useMemo } from 'react'
import { Row, Col, Select, Radio, Space, Spin, Tag } from 'antd'
import { SearchOutlined, CloudOutlined, DatabaseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useKLine } from '../../hooks/useMarketData'
import { STOCKS } from '../../data/stockPool'
import { calcMA, calcBOLL, calcMACD, calcRSI, calcKDJ } from '../../data/indicators'
import { getChangeColor } from '../../utils/helpers'
import './Analysis.css'

export default function Analysis() {
    const [selectedStock, setSelectedStock] = useState(STOCKS[0].code)
    const [indicator, setIndicator] = useState('MA')
    const [subIndicator, setSubIndicator] = useState('MACD')

    const stock = STOCKS.find(s => s.code === selectedStock) || STOCKS[0]
    const { data: klineData, loading, isLive } = useKLine(selectedStock, 120)

    const chartData = useMemo(() => {
        if (!klineData || klineData.length === 0) return null

        const closes = klineData.map(d => d.close)
        const highs = klineData.map(d => d.high)
        const lows = klineData.map(d => d.low)
        const dates = klineData.map(d => d.dateStr)

        // 主图指标
        const ma5 = calcMA(closes, 5)
        const ma10 = calcMA(closes, 10)
        const ma20 = calcMA(closes, 20)
        const ma60 = calcMA(closes, 60)
        const boll = calcBOLL(closes, 20)

        // 副图指标
        const macd = calcMACD(closes)
        const rsi = calcRSI(closes)
        const kdj = calcKDJ(highs, lows, closes)

        return { closes, highs, lows, dates, ma5, ma10, ma20, ma60, boll, macd, rsi, kdj }
    }, [klineData])

    if (loading || !chartData || !klineData) {
        return (
            <div className="analysis-page">
                <div className="page-header">
                    <h2><span className="glow-text">技术分析</span></h2>
                    <p>专业K线图 · 技术指标叠加 · 多周期分析</p>
                </div>
                <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
            </div>
        )
    }

    const { dates, ma5, ma10, ma20, ma60, boll, macd, rsi, kdj } = chartData

    const mainOverlays = []
    if (indicator === 'MA') {
        mainOverlays.push(
            { name: 'MA5', data: ma5, lineStyle: { color: '#f0c060', width: 1 } },
            { name: 'MA10', data: ma10, lineStyle: { color: '#58a6ff', width: 1 } },
            { name: 'MA20', data: ma20, lineStyle: { color: '#bc8cff', width: 1 } },
            { name: 'MA60', data: ma60, lineStyle: { color: '#f85149', width: 1 } },
        )
    } else if (indicator === 'BOLL') {
        mainOverlays.push(
            { name: 'BOLL中轨', data: boll.mid, lineStyle: { color: '#f0c060', width: 1 } },
            { name: 'BOLL上轨', data: boll.upper, lineStyle: { color: '#f85149', width: 1, type: 'dashed' } },
            { name: 'BOLL下轨', data: boll.lower, lineStyle: { color: '#3fb950', width: 1, type: 'dashed' } },
        )
    }

    let subSeries = []
    let subYAxis = {}
    if (subIndicator === 'MACD') {
        subSeries = [
            { name: 'DIF', type: 'line', data: macd.dif, symbol: 'none', lineStyle: { color: '#58a6ff', width: 1 } },
            { name: 'DEA', type: 'line', data: macd.dea, symbol: 'none', lineStyle: { color: '#f0c060', width: 1 } },
            {
                name: 'MACD', type: 'bar', data: macd.histogram.map(v => ({
                    value: v, itemStyle: { color: v >= 0 ? '#f85149' : '#3fb950' }
                }))
            },
        ]
    } else if (subIndicator === 'RSI') {
        subSeries = [
            { name: 'RSI14', type: 'line', data: rsi, symbol: 'none', lineStyle: { color: '#bc8cff', width: 1.5 } },
        ]
        subYAxis = { min: 0, max: 100 }
    } else if (subIndicator === 'KDJ') {
        subSeries = [
            { name: 'K', type: 'line', data: kdj.k, symbol: 'none', lineStyle: { color: '#58a6ff', width: 1 } },
            { name: 'D', type: 'line', data: kdj.d, symbol: 'none', lineStyle: { color: '#f0c060', width: 1 } },
            { name: 'J', type: 'line', data: kdj.j, symbol: 'none', lineStyle: { color: '#bc8cff', width: 1 } },
        ]
    } else {
        subSeries = [
            {
                name: '成交量', type: 'bar', data: klineData.map((d) => ({
                    value: d.volume,
                    itemStyle: { color: d.close >= d.open ? 'rgba(248,81,73,0.6)' : 'rgba(63,185,80,0.6)' }
                }))
            },
        ]
    }

    const chartOption = {
        animation: true,
        grid: [
            { top: 40, right: 60, bottom: '38%', left: 60 },
            { top: '68%', right: 60, bottom: 30, left: 60 },
        ],
        xAxis: [
            {
                type: 'category', data: dates, gridIndex: 0,
                axisLabel: { show: false },
                axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
                splitLine: { show: false },
            },
            {
                type: 'category', data: dates, gridIndex: 1,
                axisLabel: { color: '#6e7681', fontSize: 10 },
                axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
                splitLine: { show: false },
            },
        ],
        yAxis: [
            {
                scale: true, gridIndex: 0,
                axisLabel: { color: '#6e7681', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(48,54,61,0.2)' } },
                axisLine: { show: false },
            },
            {
                scale: true, gridIndex: 1, ...subYAxis,
                axisLabel: { color: '#6e7681', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(48,54,61,0.15)' } },
                axisLine: { show: false },
            },
        ],
        dataZoom: [
            { type: 'inside', xAxisIndex: [0, 1], start: 30, end: 100 },
            {
                type: 'slider', xAxisIndex: [0, 1], bottom: 0, height: 20,
                borderColor: 'transparent', backgroundColor: 'rgba(22,27,34,0.8)',
                fillerColor: 'rgba(88,166,255,0.1)', handleStyle: { color: '#58a6ff' },
                textStyle: { color: '#6e7681' },
            },
        ],
        series: [
            {
                name: 'K线', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0,
                data: klineData.map(d => [d.open, d.close, d.low, d.high]),
                itemStyle: {
                    color: '#f85149', color0: '#3fb950',
                    borderColor: '#f85149', borderColor0: '#3fb950',
                },
            },
            ...mainOverlays.map(o => ({
                ...o, type: 'line', symbol: 'none', xAxisIndex: 0, yAxisIndex: 0, smooth: false,
            })),
            ...subSeries.map(s => ({ ...s, xAxisIndex: 1, yAxisIndex: 1 })),
        ],
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: 'rgba(88,166,255,0.3)' } },
            backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
            textStyle: { color: '#e6edf3', fontSize: 11 },
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
    }

    const lastK = klineData[klineData.length - 1]
    const prevK = klineData[klineData.length - 2]
    const change = lastK.close - prevK.close
    const changePct = (change / prevK.close) * 100

    return (
        <div className="analysis-page">
            <div className="page-header">
                <h2><span className="glow-text">技术分析</span></h2>
                <p>
                    专业K线图 · 技术指标叠加 · 多周期分析
                    <Tag color={isLive ? 'green' : 'default'} style={{ marginLeft: 12, borderRadius: 12 }}>
                        {isLive ? <><CloudOutlined /> 实时数据</> : <><DatabaseOutlined /> 模拟数据</>}
                    </Tag>
                </p>
            </div>

            <div className="glass-card chart-container">
                <div className="chart-toolbar">
                    <div className="toolbar-left">
                        <Select
                            value={selectedStock}
                            onChange={setSelectedStock}
                            showSearch
                            optionFilterProp="label"
                            suffixIcon={<SearchOutlined />}
                            style={{ width: 200 }}
                            options={STOCKS.slice(0, 40).map(s => ({
                                value: s.code, label: `${s.code} ${s.name}`,
                            }))}
                        />
                        <div className="stock-info">
                            <span className="stock-price" style={{ color: getChangeColor(change) }}>
                                {lastK.close.toFixed(2)}
                            </span>
                            <span className="stock-change" style={{ color: getChangeColor(change) }}>
                                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                    <div className="toolbar-right">
                        <Space>
                            <Radio.Group value={indicator} onChange={e => setIndicator(e.target.value)} size="small" buttonStyle="solid">
                                <Radio.Button value="MA">MA</Radio.Button>
                                <Radio.Button value="BOLL">BOLL</Radio.Button>
                                <Radio.Button value="NONE">无</Radio.Button>
                            </Radio.Group>
                            <Radio.Group value={subIndicator} onChange={e => setSubIndicator(e.target.value)} size="small" buttonStyle="solid">
                                <Radio.Button value="VOL">VOL</Radio.Button>
                                <Radio.Button value="MACD">MACD</Radio.Button>
                                <Radio.Button value="RSI">RSI</Radio.Button>
                                <Radio.Button value="KDJ">KDJ</Radio.Button>
                            </Radio.Group>
                        </Space>
                    </div>
                </div>

                <ReactECharts option={chartOption} style={{ height: 550 }} opts={{ renderer: 'canvas' }} />
            </div>

            <Row gutter={16} style={{ marginTop: 16 }}>
                {[
                    { label: '今开', value: lastK.open.toFixed(2) },
                    { label: '最高', value: lastK.high.toFixed(2), color: '#f85149' },
                    { label: '最低', value: lastK.low.toFixed(2), color: '#3fb950' },
                    { label: '成交量', value: (lastK.volume / 10000).toFixed(0) + '万手' },
                ].map((item, i) => (
                    <Col xs={12} md={6} key={i}>
                        <div className="glass-card mini-stat">
                            <div className="stat-label">{item.label}</div>
                            <div className="stat-value" style={{ color: item.color || 'var(--text-primary)', fontSize: 18 }}>{item.value}</div>
                        </div>
                    </Col>
                ))}
            </Row>
        </div>
    )
}
