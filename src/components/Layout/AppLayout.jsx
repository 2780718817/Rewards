import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Input, Space, Badge, Avatar } from 'antd'
import {
    DashboardOutlined, ExperimentOutlined, LineChartOutlined,
    FilterOutlined, HeatMapOutlined, SafetyOutlined,
    SearchOutlined, BellOutlined, SettingOutlined,
    ThunderboltOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import './AppLayout.css'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/strategy', icon: <ExperimentOutlined />, label: '量化策略' },
    { key: '/analysis', icon: <LineChartOutlined />, label: '技术分析' },
    { key: '/screener', icon: <FilterOutlined />, label: '智能选股' },
    { key: '/heatmap', icon: <HeatMapOutlined />, label: '市场热图' },
    { key: '/risk', icon: <SafetyOutlined />, label: '风控中心' },
]

export default function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(false)
    const [alertCount, setAlertCount] = useState(0)

    useEffect(() => {
        const handleAlertUpdate = (e) => {
            setAlertCount(e.detail?.count || 0)
        }
        window.addEventListener('quant-alert-update', handleAlertUpdate)
        return () => window.removeEventListener('quant-alert-update', handleAlertUpdate)
    }, [])

    const currentTitle = menuItems.find(i => i.key === location.pathname)?.label || '仪表盘'

    return (
        <Layout className="app-layout" style={{ minHeight: '100vh' }}>
            <Sider
                collapsible
                collapsed={collapsed}
                trigger={null}
                width={220}
                collapsedWidth={68}
                className="app-sider"
            >
                <div className="sider-logo">
                    <ThunderboltOutlined className="logo-icon" />
                    {!collapsed && <span className="logo-text">QuantMaster</span>}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="sider-menu"
                />
                <div className="sider-footer">
                    {!collapsed && (
                        <Text className="sider-version">v1.0.0 · 量化大师</Text>
                    )}
                </div>
            </Sider>

            <Layout>
                <Header className="app-header">
                    <div className="header-left">
                        <span className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </span>
                        <h1 className="header-title">{currentTitle}</h1>
                    </div>
                    <div className="header-right">
                        <Input
                            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
                            placeholder="搜索股票 / 代码 (Ctrl+K)"
                            className="header-search"
                            style={{ width: 260 }}
                        />
                        <Badge count={alertCount} size="small" offset={[-2, 2]}>
                            <BellOutlined className="header-icon" />
                        </Badge>
                        <SettingOutlined className="header-icon" />
                        <Avatar size={32} style={{ background: 'linear-gradient(135deg, #58a6ff, #bc8cff)' }}>
                            Q
                        </Avatar>
                    </div>
                </Header>

                <Content className="app-content">
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    )
}
