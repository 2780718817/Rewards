/**
 * 业务数据服务 — 腾讯行情API(主) + 降级fallback
 * 每个函数先尝试调用真实API，失败时回退到 mockEngine.js
 */

import { fetchQQQuotes, fetchQQKLine, toQQCode, fetchEMIndices, fetchAllAStocks } from './api'
import {
    generateIndexData,
    generateKLineData,
    generateMarketSnapshot,
    generateSectorData,
    generateFlowData,
    generateNorthboundData,
    getMarketBreadth,
} from '../data/mockEngine'
import { STOCKS, INDICES } from '../data/stockPool'

/**
 * 获取三大指数实时行情
 * 返回格式与原 generateIndexData() 兼容
 */
export async function getIndicesData() {
    // 指数代码
    const indexCodes = ['sh000001', 'sz399001', 'sz399006']
    const quotes = await fetchQQQuotes(indexCodes)

    if (!quotes || quotes.length === 0) {
        console.warn('[降级] 指数数据使用模拟数据')
        return { data: generateIndexData(), isLive: false }
    }

    const baseMap = { '000001': 3300, '399001': 12800, '399006': 2600 }
    const nameMap = { '000001': '上证指数', '399001': '深证成指', '399006': '创业板指' }

    const data = quotes.map(q => ({
        code: q.code,
        name: nameMap[q.code] || q.name,
        base: baseMap[q.code] || q.price,
        price: q.price,
        prevClose: q.prevClose,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume,
        turnover: q.turnover,
        timeline: [],
    }))

    return { data, isLive: true }
}

/**
 * 获取个股K线数据
 * 返回格式与原 generateKLineData() 兼容
 */
export async function getKLineData(stockCode, count = 250) {
    const qqCode = toQQCode(stockCode)
    const result = await fetchQQKLine(qqCode, count)

    if (!result || !result.klines || result.klines.length === 0) {
        const stock = STOCKS.find(s => s.code === stockCode)
        const basePrice = stock ? stock.marketCap / (stock.pe > 0 ? stock.pe : 50) * 0.1 : 100
        console.warn(`[降级] ${stockCode} K线数据使用模拟数据`)
        return { data: generateKLineData(basePrice, count), isLive: false }
    }

    const data = result.klines.map(k => ({
        date: new Date(k.date),
        dateStr: k.date,
        open: k.open,
        close: k.close,
        high: k.high,
        low: k.low,
        volume: k.volume,
        amount: 0,
        amplitude: k.high && k.low ? +((k.high - k.low) / k.open * 100).toFixed(2) : 0,
        changePercent: k.open ? +((k.close - k.open) / k.open * 100).toFixed(2) : 0,
        change: +(k.close - k.open).toFixed(2),
        turnoverRate: 0,
    }))

    return { data, isLive: true, name: result.name }
}

/**
 * 获取A股股票列表（选股器、风控中心用）
 * 从股票池中批量获取实时行情
 */
export async function getStockListData(page = 1, pageSize = 100) {
    // 从 STOCKS 池中取一批代码，请求实时行情
    const start = (page - 1) * pageSize
    const batch = STOCKS.slice(start, start + pageSize)
    if (batch.length === 0) {
        return { data: generateMarketSnapshot(), isLive: false, total: 0 }
    }

    const qqCodes = batch.map(s => toQQCode(s.code))
    const quotes = await fetchQQQuotes(qqCodes)

    if (!quotes || quotes.length === 0) {
        console.warn('[降级] 股票列表使用模拟数据')
        return { data: generateMarketSnapshot(), isLive: false, total: 0 }
    }

    // 合并实时行情和股票池中的基础信息（行业等）
    const data = quotes.map(q => {
        const poolStock = batch.find(s => s.code === q.code) || {}
        return {
            code: q.code,
            name: q.name,
            price: q.price,
            changePercent: q.changePercent,
            change: q.change,
            volume: q.volume,
            turnover: q.turnover,
            amplitude: q.amplitude,
            turnoverRate: q.turnoverRate,
            pe: q.pe,
            pb: q.pb,
            roe: null,
            marketCap: q.totalCap,
            mainFlow: null,
            high: q.high,
            low: q.low,
            open: q.open,
            prevClose: q.prevClose,
            revenueGrowth: null,
            industry: poolStock.industry || null,
        }
    })

    return { data, isLive: true, total: STOCKS.length }
}

/**
 * 获取全量A股数据（选股器专用）
 * 优先从东方财富拉取全量，失败时降级到本地股票池
 * @returns {Promise<{data: Array, isLive: boolean, total: number}>}
 */
export async function getAllStocksForScreener(force = false) {
    try {
        const all = await fetchAllAStocks(force)
        if (all && all.length > 100) {
            // 补充本地股票池的行业信息
            const localMap = {}
            STOCKS.forEach(s => { localMap[s.code] = s.industry })

            const data = all.map(s => ({
                ...s,
                industry: localMap[s.code] || null,
                marketCap: s.totalCap,
                high: null,
                low: null,
                open: null,
                prevClose: null,
                roe: null,
                mainFlow: null,
                revenueGrowth: null,
            }))
            return { data, isLive: true, total: data.length }
        }
    } catch (e) {
        console.warn('[选股器] 全A股接口失败，降级到本地股票池', e.message)
    }

    // 降级: 使用本地股票池
    const fallback = STOCKS.map(s => ({
        code: s.code,
        name: s.name,
        industry: s.industry,
        price: 0, changePercent: 0, change: 0,
        volume: 0, turnover: 0, turnoverRate: 0,
        pe: 0, pb: 0, totalCap: 0, flowCap: 0, marketCap: 0,
        high: null, low: null, open: null, prevClose: null,
        roe: null, mainFlow: null, revenueGrowth: null,
    }))
    return { data: fallback, isLive: false, total: fallback.length }
}

/**
 * 获取行业板块数据（热力图/板块排行用）
 * 从股票池按行业汇总实时行情
 */
export async function getSectorData() {
    // 获取一批代表性个股的实时行情，然后按行业汇总
    const topStocks = STOCKS.slice(0, 60)
    const qqCodes = topStocks.map(s => toQQCode(s.code))
    const quotes = await fetchQQQuotes(qqCodes)

    if (!quotes || quotes.length === 0) {
        console.warn('[降级] 板块数据使用模拟数据')
        return { data: generateSectorData(), isLive: false }
    }

    // 按行业分组汇总
    const industryMap = {}
    quotes.forEach(q => {
        const poolStock = topStocks.find(s => s.code === q.code)
        if (!poolStock) return
        const ind = poolStock.industry
        if (!industryMap[ind]) {
            industryMap[ind] = {
                name: ind,
                code: ind,
                stocks: [],
                totalCap: 0,
                changeSum: 0,
                count: 0,
            }
        }
        industryMap[ind].stocks.push({
            code: q.code,
            name: q.name,
            price: q.price,
            changePercent: q.changePercent,
            marketCap: q.totalCap,
        })
        industryMap[ind].totalCap += q.totalCap || 0
        industryMap[ind].changeSum += q.changePercent || 0
        industryMap[ind].count++
    })

    const data = Object.values(industryMap)
        .map(ind => ({
            name: ind.name,
            code: ind.code,
            changePercent: +(ind.changeSum / ind.count).toFixed(2),
            change: 0,
            totalCap: ind.totalCap ? Math.round(ind.totalCap / 1e8) : 0,
            turnoverRate: 0,
            leader: ind.stocks[0]?.name || '-',
            leaderChange: ind.stocks[0]?.changePercent || 0,
            stockCount: ind.count,
            mainFlow: 0,
            stocks: ind.stocks,
        }))
        .sort((a, b) => b.changePercent - a.changePercent)

    return { data, isLive: true }
}

/**
 * 获取资金流向数据（无免费API，直接使用mock）
 */
export function getFlowData() {
    return { data: generateFlowData(), isLive: false }
}

/**
 * 获取北向资金数据（无免费API，直接使用mock）
 */
export function getNorthboundData(days = 30) {
    return { data: generateNorthboundData(days), isLive: false }
}

/**
 * 获取涨跌家数统计
 */
export function getMarketBreadthData() {
    return { data: getMarketBreadth(), isLive: false }
}
