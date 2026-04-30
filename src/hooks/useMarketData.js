/**
 * 行情数据 React Hooks
 * 提供 loading / error / data 状态管理 + 自动定时刷新
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    getIndicesData,
    getKLineData,
    getStockListData,
    getAllStocksForScreener,
    getSectorData,
    getFlowData,
    getNorthboundData,
    getMarketBreadthData,
} from '../services/stockService'

/**
 * 通用数据拉取 Hook
 * @param {Function} fetcher - async 数据获取函数
 * @param {number} refreshInterval - 刷新间隔（毫秒），0=不刷新
 * @param {Array} deps - 额外依赖项
 */
function useAsyncData(fetcher, refreshInterval = 0, deps = []) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(null)
    const timerRef = useRef(null)
    const mountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await fetcher()
            if (!mountedRef.current) return
            setData(result.data)
            setIsLive(result.isLive)
            setLastUpdate(new Date())
            setLoading(false)
        } catch (err) {
            if (!mountedRef.current) return
            console.error('[useAsyncData]', err)
            setLoading(false)
        }
    }, [fetcher])

    useEffect(() => {
        mountedRef.current = true
        setLoading(true)
        fetchData()

        if (refreshInterval > 0) {
            timerRef.current = setInterval(fetchData, refreshInterval)
        }

        return () => {
            mountedRef.current = false
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [fetchData, refreshInterval, ...deps])

    return { data, loading, isLive, lastUpdate, refetch: fetchData }
}

// ============ 具体 Hooks ============

/**
 * 三大指数实时行情 — 30秒自动刷新
 */
export function useIndices() {
    return useAsyncData(getIndicesData, 30000)
}

/**
 * 个股K线数据
 * @param {string} stockCode - 股票代码如 "600519"
 * @param {number} count - K线数量
 */
export function useKLine(stockCode, count = 250) {
    const fetcher = useCallback(() => getKLineData(stockCode, count), [stockCode, count])
    return useAsyncData(fetcher, 0, [stockCode, count])
}

/**
 * A股股票列表 — 60秒自动刷新
 */
export function useStockList(page = 1, pageSize = 100) {
    const fetcher = useCallback(() => getStockListData(page, pageSize), [page, pageSize])
    return useAsyncData(fetcher, 60000, [page, pageSize])
}

/**
 * 全A股列表（选股器专用）
 * @param {boolean} autoRefresh - true=10分钟自动刷新，false=只手动刷新
 * autoRefresh 切换时只启停定时器，不重新拉取数据
 */
export function useAllStocks(autoRefresh = true) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(null)
    const timerRef = useRef(null)
    const mountedRef = useRef(true)
    const INTERVAL = 10 * 60 * 1000

    // 内部：定时自动刷新用（利用缓存，不显示 loading）
    const fetchOnce = useCallback(async () => {
        try {
            const result = await getAllStocksForScreener(false)
            if (!mountedRef.current) return
            setData(result.data)
            setIsLive(result.isLive)
            setLastUpdate(new Date())
            setLoading(false)
        } catch (err) {
            if (!mountedRef.current) return
            console.error('[useAllStocks]', err)
            setLoading(false)
        }
    }, [])

    // 对外：手动刷新用（force=true 跳过缓存，先显示 loading）
    const refetch = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getAllStocksForScreener(true)
            if (!mountedRef.current) return
            setData(result.data)
            setIsLive(result.isLive)
            setLastUpdate(new Date())
        } catch (err) {
            if (!mountedRef.current) return
            console.error('[useAllStocks] 手动刷新失败', err)
        } finally {
            if (mountedRef.current) setLoading(false)
        }
    }, [])

    // 首次挂载：拉一次数据
    useEffect(() => {
        mountedRef.current = true
        fetchOnce()
        return () => { mountedRef.current = false }
    }, [fetchOnce])

    // autoRefresh 变化：只控制定时器，不重拉数据
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (autoRefresh) {
            timerRef.current = setInterval(fetchOnce, INTERVAL)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [autoRefresh, fetchOnce])

    return { data, loading, isLive, lastUpdate, refetch }
}

/**
 * 行业板块数据
 * @param {boolean} autoRefresh - true=30秒自动刷新，false=只手动刷新
 */
export function useSectorData(autoRefresh = true) {
    return useAsyncData(getSectorData, autoRefresh ? 30000 : 0)
}

/**
 * 资金流向数据（当前为mock）
 */
export function useFlowData() {
    return useAsyncData(getFlowData, 0)
}

/**
 * 北向资金数据（当前为mock）
 */
export function useNorthboundData(days = 30) {
    const fetcher = useCallback(() => getNorthboundData(days), [days])
    return useAsyncData(fetcher, 0, [days])
}

/**
 * 涨跌统计（当前为mock）
 */
export function useMarketBreadth() {
    return useAsyncData(getMarketBreadthData, 0)
}
