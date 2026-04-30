import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './components/Dashboard/Dashboard'
import Strategy from './components/Strategy/Strategy'
import Analysis from './components/Analysis/Analysis'
import Screener from './components/Screener/Screener'
import Heatmap from './components/Heatmap/Heatmap'
import Risk from './components/Risk/Risk'

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="strategy" element={<Strategy />} />
                <Route path="analysis" element={<Analysis />} />
                <Route path="screener" element={<Screener />} />
                <Route path="heatmap" element={<Heatmap />} />
                <Route path="risk" element={<Risk />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    )
}
