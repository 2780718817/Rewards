// 核心模拟数据引擎
// 基于随机游走模型 + 趋势因子 生成高度真实的A股市场数据

import { STOCKS, INDICES } from './stockPool'
import { seededRandom, generateTradingDays, randomInRange } from '../utils/helpers'

const rng = seededRandom(42)

/**
 * 生成K线历史数据
 */
export function generateKLineData(basePrice, count = 250, volatility = 0.025) {
    const days = generateTradingDays(count)
    const data = []
    let price = basePrice

    for (let i = 0; i < count; i++) {
        const trend = Math.sin(i / 40) * 0.002 + (rng() - 0.48) * 0.003
        const change = price * (trend + (rng() - 0.5) * volatility)
        const open = +(price + change * (rng() - 0.5)).toFixed(2)
        const close = +(price + change).toFixed(2)
        const high = +(Math.max(open, close) * (1 + rng() * 0.015)).toFixed(2)
        const low = +(Math.min(open, close) * (1 - rng() * 0.015)).toFixed(2)
        const volume = Math.round(randomInRange(5000, 80000, rng) * (basePrice / 50))

        data.push({
            date: days[i],
            dateStr: days[i].toISOString().slice(0, 10),
            open, high, low, close, volume,
        })
        price = close
    }
    return data
}

/**
 * 为所有股票生成实时行情快照
 */
export function generateMarketSnapshot() {
    const snapshot = STOCKS.map((stock, idx) => {
        const seed = seededRandom(idx * 7 + 13)
        const change = (seed() - 0.48) * 6
        const price = +(stock.marketCap / (stock.pe > 0 ? stock.pe : 50) * (1 + change / 100) * 0.1).toFixed(2)
        const prevClose = +(price / (1 + change / 100)).toFixed(2)
        const volume = Math.round(randomInRange(10000, 500000, seed) * 100)
        const turnover = +(price * volume).toFixed(0)
        const mainFlow = +((seed() - 0.5) * turnover * 0.3).toFixed(0)

        return {
            ...stock,
            price,
            prevClose,
            change: +(price - prevClose).toFixed(2),
            changePercent: +change.toFixed(2),
            volume,
            turnover,
            mainFlow,
            high: +(price * (1 + Math.abs(seed() * 0.02))).toFixed(2),
            low: +(price * (1 - Math.abs(seed() * 0.02))).toFixed(2),
            amplitude: +(Math.abs(change) * 1.3).toFixed(2),
            pe: stock.pe,
            pb: +(seed() * 8 + 0.5).toFixed(2),
            roe: +(seed() * 30 + 2).toFixed(1),
            revenueGrowth: +((seed() - 0.3) * 60).toFixed(1),
        }
    })
    return snapshot
}

/**
 * 生成指数数据（含日内分时）
 */
export function generateIndexData() {
    return INDICES.map((idx, i) => {
        const seed = seededRandom(i * 31 + 7)
        const change = (seed() - 0.46) * 2.5
        const price = +(idx.base * (1 + change / 100)).toFixed(2)
        const prevClose = +idx.base.toFixed(2)
        const volume = Math.round(randomInRange(2000, 6000, seed) * 1e8)

        // 日内分时数据 (240分钟)
        const timeline = []
        let p = prevClose
        for (let m = 0; m < 240; m++) {
            const t = m < 120 ? m : m + 90 // 跳过午休
            const progress = m / 240
            const target = price
            const drift = (target - prevClose) * progress
            p = prevClose + drift + (seed() - 0.5) * idx.base * 0.003
            const hour = Math.floor((9 * 60 + 30 + t) / 60)
            const min = (9 * 60 + 30 + t) % 60
            timeline.push({
                time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
                price: +p.toFixed(2),
                volume: Math.round(volume / 240 * (0.5 + seed())),
            })
        }

        return {
            ...idx,
            price,
            prevClose,
            change: +(price - prevClose).toFixed(2),
            changePercent: +change.toFixed(2),
            volume,
            turnover: Math.round(volume * price / 1000),
            timeline,
        }
    })
}

/**
 * 生成行业板块涨跌数据
 */
export function generateSectorData() {
    const stocksByIndustry = {}
    const snapshot = generateMarketSnapshot()
    snapshot.forEach(s => {
        if (!stocksByIndustry[s.industry]) stocksByIndustry[s.industry] = []
        stocksByIndustry[s.industry].push(s)
    })

    return Object.entries(stocksByIndustry).map(([name, stocks]) => {
        const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length
        const totalCap = stocks.reduce((sum, s) => sum + s.marketCap, 0)
        const totalFlow = stocks.reduce((sum, s) => sum + s.mainFlow, 0)
        const leader = stocks.sort((a, b) => b.changePercent - a.changePercent)[0]

        return {
            name,
            changePercent: +avgChange.toFixed(2),
            totalCap,
            mainFlow: totalFlow,
            stockCount: stocks.length,
            leader: leader.name,
            leaderChange: leader.changePercent,
            stocks,
        }
    }).sort((a, b) => b.changePercent - a.changePercent)
}

/**
 * 生成资金流向数据
 */
export function generateFlowData() {
    const categories = ['超大单', '大单', '中单', '小单']
    return categories.map((name, i) => {
        const seed = seededRandom(i * 17 + 3)
        const inflow = Math.round(randomInRange(50, 300, seed) * 1e8)
        const outflow = Math.round(randomInRange(50, 300, seed) * 1e8)
        return { name, inflow, outflow, net: inflow - outflow }
    })
}

/**
 * 生成北向资金数据
 */
export function generateNorthboundData(days = 30) {
    const tradingDays = generateTradingDays(days)
    const data = []
    let cumulative = 0
    for (let i = 0; i < days; i++) {
        const seed = seededRandom(i * 23 + 11)
        const daily = +((seed() - 0.45) * 150).toFixed(2)
        cumulative += daily
        data.push({
            date: tradingDays[i].toISOString().slice(0, 10),
            daily: +daily.toFixed(2),
            cumulative: +cumulative.toFixed(2),
        })
    }
    return data
}

/**
 * 运行简单策略回测
 * @param {object} strategy - 策略配置
 * @param {Array} klineData - K线数据
 */
export function runBacktest(strategy, klineData) {
    const { maShort = 5, maLong = 20, initialCapital = 1000000 } = strategy
    let capital = initialCapital
    let shares = 0
    let position = 0
    const trades = []
    const equityCurve = []
    const benchmarkCurve = []
    const benchmarkStart = klineData[0].close

    // 计算均线
    const closes = klineData.map(d => d.close)
    const maShortArr = []
    const maLongArr = []
    for (let i = 0; i < closes.length; i++) {
        if (i >= maShort - 1) {
            let sum = 0; for (let j = 0; j < maShort; j++) sum += closes[i - j]
            maShortArr.push(sum / maShort)
        } else maShortArr.push(null)
        if (i >= maLong - 1) {
            let sum = 0; for (let j = 0; j < maLong; j++) sum += closes[i - j]
            maLongArr.push(sum / maLong)
        } else maLongArr.push(null)
    }

    let maxEquity = initialCapital
    let maxDrawdown = 0
    let wins = 0
    let totalTrades = 0

    for (let i = 1; i < klineData.length; i++) {
        const price = klineData[i].close
        const prevMaS = maShortArr[i - 1]
        const prevMaL = maLongArr[i - 1]
        const currMaS = maShortArr[i]
        const currMaL = maLongArr[i]

        // 金叉买入
        if (prevMaS !== null && prevMaL !== null && prevMaS <= prevMaL && currMaS > currMaL && position === 0) {
            shares = Math.floor(capital / price / 100) * 100
            if (shares > 0) {
                const cost = shares * price
                capital -= cost
                position = 1
                trades.push({ date: klineData[i].dateStr, type: 'BUY', price, shares, cost })
            }
        }
        // 死叉卖出
        else if (prevMaS !== null && prevMaL !== null && prevMaS >= prevMaL && currMaS < currMaL && position === 1) {
            const revenue = shares * price
            const lastBuy = trades[trades.length - 1]
            const profit = revenue - lastBuy.cost
            if (profit > 0) wins++
            totalTrades++
            capital += revenue
            trades.push({ date: klineData[i].dateStr, type: 'SELL', price, shares, revenue, profit })
            shares = 0
            position = 0
        }

        const equity = capital + shares * price
        maxEquity = Math.max(maxEquity, equity)
        const dd = (maxEquity - equity) / maxEquity
        maxDrawdown = Math.max(maxDrawdown, dd)

        equityCurve.push({
            date: klineData[i].dateStr,
            value: +equity.toFixed(2),
        })
        benchmarkCurve.push({
            date: klineData[i].dateStr,
            value: +(initialCapital * price / benchmarkStart).toFixed(2),
        })
    }

    const finalEquity = capital + shares * klineData[klineData.length - 1].close
    const totalReturn = (finalEquity - initialCapital) / initialCapital * 100
    const benchmarkReturn = (klineData[klineData.length - 1].close / benchmarkStart - 1) * 100
    const annualizedReturn = (Math.pow(1 + totalReturn / 100, 252 / klineData.length) - 1) * 100

    // 计算夏普比率 (简化版)
    const dailyReturns = []
    for (let i = 1; i < equityCurve.length; i++) {
        dailyReturns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value)
    }
    const avgReturn = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length
    const stdReturn = Math.sqrt(dailyReturns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / dailyReturns.length)
    const sharpeRatio = stdReturn === 0 ? 0 : (avgReturn * 252 - 0.03) / (stdReturn * Math.sqrt(252))

    return {
        summary: {
            initialCapital,
            finalEquity: +finalEquity.toFixed(2),
            totalReturn: +totalReturn.toFixed(2),
            benchmarkReturn: +benchmarkReturn.toFixed(2),
            annualizedReturn: +annualizedReturn.toFixed(2),
            maxDrawdown: +(maxDrawdown * 100).toFixed(2),
            sharpeRatio: +sharpeRatio.toFixed(2),
            totalTrades,
            winRate: totalTrades === 0 ? 0 : +(wins / totalTrades * 100).toFixed(1),
        },
        equityCurve,
        benchmarkCurve,
        trades,
    }
}

/**
 * 涨跌家数统计 
 */
export function getMarketBreadth() {
    const snapshot = generateMarketSnapshot()
    let up = 0, down = 0, flat = 0
    snapshot.forEach(s => {
        if (s.changePercent > 0.1) up++
        else if (s.changePercent < -0.1) down++
        else flat++
    })
    // 扩展到全市场比例
    return {
        up: Math.round(up * 52),
        down: Math.round(down * 52),
        flat: Math.round(flat * 52),
        limitUp: Math.round(up * 3.2),
        limitDown: Math.round(down * 2.1),
    }
}
