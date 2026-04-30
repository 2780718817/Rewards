import React, { useMemo } from 'react'
import { Row, Col, Tag, Spin } from 'antd'
import { HeatMapOutlined, CloudOutlined, DatabaseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useSectorData } from '../../hooks/useMarketData'
import { formatPercent } from '../../utils/helpers'
import './Heatmap.css'

export default function Heatmap() {
    const { data: sectors, loading, isLive } = useSectorData()

    const getColor = (change) => {
        if (change > 5) return '#c93030'
        if (change > 3) return '#d44040'
        if (change > 1.5) return '#e05555'
        if (change > 0.5) return '#f07070'
        if (change > 0) return '#f8a0a0'
        if (change === 0) return '#4a5568'
        if (change > -0.5) return '#90d4a0'
        if (change > -1.5) return '#60c878'
        if (change > -3) return '#40b860'
        if (change > -5) return '#30a050'
        return '#208040'
    }

    // 构建 treemap 数据
    const treemapData = useMemo(() => {
        if (!sectors) return []
        return sectors.map(sector => ({
            name: sector.name,
            value: sector.totalCap || Math.abs(sector.changePercent) * 100 + 50,
            changePercent: sector.changePercent,
            children: sector.stocks && sector.stocks.length > 0
                ? sector.stocks.map(s => ({
                    name: s.name,
                    value: s.marketCap || 10,
                    changePercent: s.changePercent,
                    code: s.code,
                }))
                : undefined,
        }))
    }, [sectors])

    const treemapOption = useMemo(() => {
        if (!treemapData.length) return {}
        return {
            series: [{
                type: 'treemap',
                width: '100%',
                height: '100%',
                roam: false,
                nodeClick: false,
                breadcrumb: {
                    show: true,
                    itemStyle: { color: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', textStyle: { color: '#8b949e' } },
                },
                label: {
                    show: true,
                    color: '#fff',
                    fontSize: 11,
                    formatter: (p) => {
                        const change = p.data.changePercent
                        return `${p.name}\n${formatPercent(change)}`
                    },
                },
                upperLabel: {
                    show: true,
                    height: 28,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    formatter: (p) => {
                        const change = p.data.changePercent
                        return `${p.name}  ${formatPercent(change)}`
                    },
                },
                itemStyle: {
                    borderColor: '#0d1117',
                    borderWidth: 2,
                    gapWidth: 2,
                },
                levels: [
                    {
                        itemStyle: { borderWidth: 3, borderColor: '#0d1117', gapWidth: 3 },
                        upperLabel: { show: true },
                    },
                    {
                        itemStyle: { borderWidth: 1, borderColor: '#0d1117', gapWidth: 1 },
                        colorMappingBy: 'value',
                    },
                ],
                data: treemapData.map(d => ({
                    ...d,
                    itemStyle: { color: getColor(d.changePercent) },
                    children: d.children ? d.children.map(c => ({
                        ...c,
                        itemStyle: { color: getColor(c.changePercent) },
                    })) : undefined,
                })),
            }],
            tooltip: {
                backgroundColor: '#1c2128',
                borderColor: 'rgba(48,54,61,0.6)',
                textStyle: { color: '#e6edf3', fontSize: 12 },
                formatter: (p) => {
                    const d = p.data
                    const change = d.changePercent
                    const color = change >= 0 ? '#f85149' : '#3fb950'
                    return `<b>${d.name}</b> ${d.code || ''}<br/>涨跌幅: <span style="color:${color};font-weight:600">${formatPercent(change)}</span>`
                },
            },
        }
    }, [treemapData])

    if (loading || !sectors) {
        return (
            <div className="heatmap-page">
                <div className="page-header">
                    <h2><span className="glow-text">市场热力图</span></h2>
                    <p>行业板块全景 · 按市值映射 · 涨跌颜色标注</p>
                </div>
                <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
            </div>
        )
    }

    const topSectors = sectors.slice(0, 5)
    const bottomSectors = [...sectors].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5)

    return (
        <div className="heatmap-page">
            <div className="page-header">
                <h2><span className="glow-text">市场热力图</span></h2>
                <p>
                    行业板块全景 · 按市值映射 · 涨跌颜色标注
                    <Tag color={isLive ? 'green' : 'default'} style={{ marginLeft: 12, borderRadius: 12 }}>
                        {isLive ? <><CloudOutlined /> 实时数据</> : <><DatabaseOutlined /> 模拟数据</>}
                    </Tag>
                </p>
            </div>

            <div className="glass-card heatmap-container">
                <div className="heatmap-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HeatMapOutlined style={{ color: 'var(--color-primary)', fontSize: 18 }} />
                        <span style={{ fontWeight: 600 }}>行业板块热力图</span>
                    </div>
                </div>
                <ReactECharts option={treemapOption} style={{ height: 520 }} opts={{ renderer: 'canvas' }} />
            </div>

            <Row gutter={16} style={{ marginTop: 16 }}>
                <Col xs={24} md={12}>
                    <div className="glass-card">
                        <h3 className="card-title" style={{ color: '#f85149' }}>🔥 领涨板块</h3>
                        {topSectors.map((s, i) => (
                            <div key={s.name} className="rank-row">
                                <span className="rank-num" style={{ color: i < 3 ? '#f85149' : '#8b949e' }}>{i + 1}</span>
                                <span className="rank-name">{s.name}</span>
                                <span className="rank-count">{s.stockCount > 0 ? s.stockCount + '只' : s.leader || ''}</span>
                                <span className="rank-change num-up">{formatPercent(s.changePercent)}</span>
                            </div>
                        ))}
                    </div>
                </Col>
                <Col xs={24} md={12}>
                    <div className="glass-card">
                        <h3 className="card-title" style={{ color: '#3fb950' }}>💎 领跌板块</h3>
                        {bottomSectors.map((s, i) => (
                            <div key={s.name} className="rank-row">
                                <span className="rank-num" style={{ color: i < 3 ? '#3fb950' : '#8b949e' }}>{i + 1}</span>
                                <span className="rank-name">{s.name}</span>
                                <span className="rank-count">{s.stockCount > 0 ? s.stockCount + '只' : s.leader || ''}</span>
                                <span className="rank-change num-down">{formatPercent(s.changePercent)}</span>
                            </div>
                        ))}
                    </div>
                </Col>
            </Row>
        </div>
    )
}
