import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ConfigProvider
            locale={zhCN}
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#58a6ff',
                    colorBgContainer: '#161b22',
                    colorBgElevated: '#1c2128',
                    colorBorder: 'rgba(48, 54, 61, 0.6)',
                    colorText: '#e6edf3',
                    colorTextSecondary: '#8b949e',
                    borderRadius: 10,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                },
            }}
        >
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ConfigProvider>
    </React.StrictMode>
)
