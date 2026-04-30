import React, { useMemo } from 'react'
import { Row, Col, Tag, Spin } from 'antd'
import {
    ArrowUpOutlined, ArrowDownOutlined, RiseOutlined,
    FallOutlined, FundOutlined, SwapOutlined, CloudOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useIndices, useSectorData, useMarketBreadth, useNorthboundData, useFlowData } from '../../hooks/useMarketData'
import { formatNumber, formatPercent, getChangeColor } from '../../utils/helpers'
import './Dashboard.css'

function LiveBadge({ isLive, lastUpdate }) {
    return (
        <span className="live-badge" style={{ color: isLive ? '#3fb950' : '#8b949e', fontSize: 11 }}>
            {isLive ? <CloudOutlined /> : <DatabaseOutlined />}
            {' '}{isLive ? '实时' : '模拟'}
            {lastUpdate && <span style={{ marginLeft: 6, color: '#6e7681' }}>{lastUpdate.toLocaleTimeString()}</span>}
        </span>
    )
}

export default function Dashboard() {
    const { data: indices, loading: idxLoading, isLive: idxLive, lastUpdate: idxUpdate } = useIndices()
    const { data: sectors, loading: secLoading, isLive: secLive } = useSectorData()
    const { data: breadth } = useMarketBreadth()
    const { data: northbound } = useNorthboundData(30)
    const { data: flowData } = useFlowData()

    // 涨跌分布图
    const breadthOption = useMemo(() => {
        if (!breadth) return {}
        return {
            grid: { top: 10, right: 16, bottom: 30, left: 16 },
            xAxis: {
                type: 'category',
                data: ['涨停', '涨>5%', '涨3-5%', '涨0-3%', '平盘', '跌0-3%', '跌3-5%', '跌>5%', '跌停'],
                axisLabel: { color: '#8b949e', fontSize: 10, rotate: 30 },
                axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
            },
            yAxis: { show: false },
            series: [{
                type: 'bar',
                data: [
                    { value: breadth.limitUp, itemStyle: { color: '#f85149' } },
                    { value: Math.round(breadth.up * 0.25), itemStyle: { color: '#f8716a' } },
                    { value: Math.round(breadth.up * 0.35), itemStyle: { color: '#f89a95' } },
                    { value: Math.round(breadth.up * 0.4), itemStyle: { color: '#f8b4b0' } },
                    { value: breadth.flat, itemStyle: { color: '#8b949e' } },
                    { value: Math.round(breadth.down * 0.4), itemStyle: { color: '#7ee08c' } },
                    { value: Math.round(breadth.down * 0.35), itemStyle: { color: '#56d364' } },
                    { value: Math.round(breadth.down * 0.25), itemStyle: { color: '#3fb950' } },
                    { value: breadth.limitDown, itemStyle: { color: '#238636' } },
                ],
                barWidth: '60%',
                label: { show: true, position: 'top', color: '#8b949e', fontSize: 10 },
            }],
            tooltip: {
                backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
                textStyle: { color: '#e6edf3' },
            },
        }
    }, [breadth])

    // 北向资金图
    const northboundOption = useMemo(() => {
        if (!northbound) return {}
        return {
            grid: { top: 10, right: 16, bottom: 28, left: 50 },
            xAxis: {
                data: northbound.map(d => d.date.slice(5)),
                axisLabel: { color: '#6e7681', fontSize: 10 },
                axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
            },
            yAxis: {
                axisLabel: { color: '#6e7681', fontSize: 10, formatter: v => (v / 1).toFixed(0) + '亿' },
                splitLine: { lineStyle: { color: 'rgba(48,54,61,0.3)' } },
                axisLine: { show: false },
            },
            series: [{
                type: 'bar',
                data: northbound.map(d => ({
                    value: d.daily,
                    itemStyle: { color: d.daily >= 0 ? '#f85149' : '#3fb950' },
                })),
            }],
            tooltip: {
                backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
                textStyle: { color: '#e6edf3' },
                formatter: p => `${p.name}<br/>净流入: <b style="color:${p.value >= 0 ? '#f85149' : '#3fb950'}">${p.value.toFixed(2)}亿</b>`,
            },
        }
    }, [northbound])

    // 资金流向图
    const flowOption = useMemo(() => {
        if (!flowData) return {}
        return {
            grid: { top: 10, right: 16, bottom: 28, left: 60 },
            xAxis: { show: false },
            yAxis: {
                type: 'category',
                data: flowData.map(f => f.name),
                axisLabel: { color: '#8b949e', fontSize: 12 },
                axisLine: { show: false }, axisTick: { show: false },
            },
            series: [
                {
                    name: '流入', type: 'bar', stack: 'flow',
                    data: flowData.map(f => +(f.inflow / 1e8).toFixed(1)),
                    itemStyle: { color: '#f85149', borderRadius: [0, 4, 4, 0] },
                    label: { show: true, position: 'right', color: '#f85149', fontSize: 10, formatter: p => p.value + '亿' },
                },
                {
                    name: '流出', type: 'bar', stack: 'flow2',
                    data: flowData.map(f => -(f.outflow / 1e8).toFixed(1)),
                    itemStyle: { color: '#3fb950', borderRadius: [4, 0, 0, 4] },
                    label: { show: true, position: 'left', color: '#3fb950', fontSize: 10, formatter: p => Math.abs(p.value) + '亿' },
                },
            ],
            tooltip: {
                backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
                textStyle: { color: '#e6edf3' },
            },
        }
    }, [flowData])

    return (
        <div className="dashboard">
            {/* 指数卡片 */}
            <div className="section-header" style={{ marginBottom: 12 }}>
                <LiveBadge isLive={idxLive} lastUpdate={idxUpdate} />
            </div>
            {idxLoading || !indices ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
            ) : (
                <div className="grid-3 index-cards-grid">
                    {indices.slice(0, 3).map((idx, i) => (
                        <div key={idx.code} className="glass-card index-card animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="index-card-header">
                                <span className="index-name">{idx.name}</span>
                                <Tag color={idx.changePercent >= 0 ? 'red' : 'green'} style={{ borderRadius: 12 }}>
                                    {idx.changePercent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                    {' '}{formatPercent(idx.changePercent)}
                                </Tag>
                            </div>
                            <div className="index-price" style={{ color: getChangeColor(idx.changePercent) }}>
                                {idx.price.toFixed(2)}
                            </div>
                            <div className="index-change">
                                <span style={{ color: getChangeColor(idx.changePercent) }}>
                                    {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}
                                </span>
                                <span className="index-volume">成交 {formatNumber(idx.volume)}手</span>
                            </div>
                            {idx.timeline && idx.timeline.length > 0 && (
                                <div className="index-chart">
                                    <ReactECharts
                                        option={{
                                            grid: { top: 8, right: 8, bottom: 20, left: 45 },
                                            xAxis: {
                                                data: idx.timeline.filter((_, i) => i % 30 === 0).map(t => t.time),
                                                axisLine: { lineStyle: { color: 'rgba(48,54,61,0.6)' } },
                                                axisLabel: { color: '#6e7681', fontSize: 10 },
                                                splitLine: { show: false },
                                            },
                                            yAxis: {
                                                min: Math.min(...idx.timeline.map(t => t.price)) * 0.999,
                                                max: Math.max(...idx.timeline.map(t => t.price)) * 1.001,
                                                axisLabel: { color: '#6e7681', fontSize: 10 },
                                                splitLine: { lineStyle: { color: 'rgba(48,54,61,0.3)' } },
                                                axisLine: { show: false },
                                            },
                                            series: [{
                                                type: 'line',
                                                data: idx.timeline.map(t => t.price),
                                                smooth: true, symbol: 'none',
                                                lineStyle: { color: getChangeColor(idx.changePercent), width: 1.5 },
                                                areaStyle: {
                                                    color: {
                                                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                        colorStops: [
                                                            { offset: 0, color: idx.changePercent >= 0 ? 'rgba(248,81,73,0.2)' : 'rgba(63,185,80,0.2)' },
                                                            { offset: 1, color: 'transparent' },
                                                        ],
                                                    },
                                                },
                                            }],
                                            tooltip: {
                                                trigger: 'axis',
                                                backgroundColor: '#1c2128', borderColor: 'rgba(48,54,61,0.6)',
                                                textStyle: { color: '#e6edf3', fontSize: 12 },
                                            },
                                        }}
                                        style={{ height: 90 }}
                                        opts={{ renderer: 'svg' }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 第二行 */}
            <Row gutter={16} style={{ marginTop: 16 }}>
                <Col xs={24} lg={14}>
                    <div className="glass-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <h3 className="card-title"><FundOutlined /> 涨跌分布</h3>
                        {breadth && (
                            <>
                                <div className="breadth-summary">
                                    <span className="num-up">{breadth.up} 家上涨</span>
                                    <span className="num-flat">{breadth.flat} 家平盘</span>
                                    <span className="num-down">{breadth.down} 家下跌</span>
                                </div>
                                <ReactECharts option={breadthOption} style={{ height: 220 }} opts={{ renderer: 'svg' }} />
                            </>
                        )}
                    </div>
                </Col>
                <Col xs={24} lg={10}>
                    <div className="glass-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                        <h3 className="card-title"><SwapOutlined /> 资金流向</h3>
                        {flowData && <ReactECharts option={flowOption} style={{ height: 260 }} opts={{ renderer: 'svg' }} />}
                    </div>
                </Col>
            </Row>

            {/* 第三行 */}
            <Row gutter={16} style={{ marginTop: 16 }}>
                <Col xs={24} lg={10}>
                    <div className="glass-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                        <h3 className="card-title"><RiseOutlined /> 北向资金 (近30日)</h3>
                        {northbound && <ReactECharts option={northboundOption} style={{ height: 240 }} opts={{ renderer: 'svg' }} />}
                    </div>
                </Col>
                <Col xs={24} lg={14}>
                    <div className="glass-card sector-ranking animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                        <h3 className="card-title">
                            <FallOutlined /> 板块排行
                            <LiveBadge isLive={secLive} />
                        </h3>
                        {secLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                        ) : sectors && (
                            <div className="sector-list">
                                {sectors.slice(0, 12).map((s, i) => (
                                    <div key={s.name} className="sector-item">
                                        <span className="sector-rank" style={{ color: i < 3 ? '#f85149' : '#8b949e' }}>{i + 1}</span>
                                        <span className="sector-name">{s.name}</span>
                                        <span className="sector-leader">{s.leader}</span>
                                        <span className={`sector-change ${s.changePercent >= 0 ? 'num-up' : 'num-down'}`}>
                                            {formatPercent(s.changePercent)}
                                        </span>
                                        <div className="sector-bar">
                                            <div
                                                className="sector-bar-fill"
                                                style={{
                                                    width: `${Math.min(Math.abs(s.changePercent) * 18, 100)}%`,
                                                    background: s.changePercent >= 0
                                                        ? 'linear-gradient(90deg, rgba(248,81,73,0.3), rgba(248,81,73,0.7))'
                                                        : 'linear-gradient(90deg, rgba(63,185,80,0.3), rgba(63,185,80,0.7))',
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Col>
            </Row>
        </div>
    )
}
