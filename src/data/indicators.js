// 技术指标计算库 - 纯函数实现

/**
 * 简单移动平均 MA
 * @param {number[]} data - 收盘价序列
 * @param {number} period - 周期
 */
export function calcMA(data, period) {
    const result = []
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null)
        } else {
            let sum = 0
            for (let j = 0; j < period; j++) sum += data[i - j]
            result.push(+(sum / period).toFixed(2))
        }
    }
    return result
}

/**
 * 指数移动平均 EMA
 */
export function calcEMA(data, period) {
    const k = 2 / (period + 1)
    const result = [data[0]]
    for (let i = 1; i < data.length; i++) {
        result.push(+(data[i] * k + result[i - 1] * (1 - k)).toFixed(2))
    }
    return result
}

/**
 * 布林带 BOLL
 */
export function calcBOLL(data, period = 20, multiplier = 2) {
    const ma = calcMA(data, period)
    const upper = []
    const lower = []
    for (let i = 0; i < data.length; i++) {
        if (ma[i] === null) {
            upper.push(null)
            lower.push(null)
        } else {
            let sum = 0
            for (let j = 0; j < period; j++) sum += Math.pow(data[i - j] - ma[i], 2)
            const std = Math.sqrt(sum / period)
            upper.push(+(ma[i] + multiplier * std).toFixed(2))
            lower.push(+(ma[i] - multiplier * std).toFixed(2))
        }
    }
    return { mid: ma, upper, lower }
}

/**
 * MACD 指标
 */
export function calcMACD(data, short = 12, long = 26, signal = 9) {
    const emaShort = calcEMA(data, short)
    const emaLong = calcEMA(data, long)
    const dif = emaShort.map((v, i) => +(v - emaLong[i]).toFixed(2))
    const dea = calcEMA(dif, signal)
    const histogram = dif.map((v, i) => +((v - dea[i]) * 2).toFixed(2))
    return { dif, dea, histogram }
}

/**
 * RSI 相对强弱指数
 */
export function calcRSI(data, period = 14) {
    const result = []
    let gainSum = 0
    let lossSum = 0

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(null)
            continue
        }
        const change = data[i] - data[i - 1]
        const gain = change > 0 ? change : 0
        const loss = change < 0 ? -change : 0

        if (i < period) {
            gainSum += gain
            lossSum += loss
            result.push(null)
        } else if (i === period) {
            gainSum += gain
            lossSum += loss
            const avgGain = gainSum / period
            const avgLoss = lossSum / period
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
            result.push(+(100 - 100 / (1 + rs)).toFixed(2))
        } else {
            const prevAvgGain = (result[i - 1] / 100) || 0.5
            const avgGain = (prevAvgGain * (period - 1) + gain) / period
            const avgLoss = ((1 - prevAvgGain) * (period - 1) + loss) / period
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
            result.push(+(100 - 100 / (1 + rs)).toFixed(2))
        }
    }
    return result
}

/**
 * KDJ 指标
 */
export function calcKDJ(highs, lows, closes, period = 9) {
    const kValues = []
    const dValues = []
    const jValues = []
    let prevK = 50
    let prevD = 50

    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            kValues.push(null)
            dValues.push(null)
            jValues.push(null)
            continue
        }
        let high = -Infinity, low = Infinity
        for (let j = i - period + 1; j <= i; j++) {
            high = Math.max(high, highs[j])
            low = Math.min(low, lows[j])
        }
        const rsv = high === low ? 50 : ((closes[i] - low) / (high - low)) * 100
        const k = +(2 / 3 * prevK + 1 / 3 * rsv).toFixed(2)
        const d = +(2 / 3 * prevD + 1 / 3 * k).toFixed(2)
        const j = +(3 * k - 2 * d).toFixed(2)
        kValues.push(k)
        dValues.push(d)
        jValues.push(j)
        prevK = k
        prevD = d
    }
    return { k: kValues, d: dValues, j: jValues }
}

/**
 * 成交量加权平均价 VWAP
 */
export function calcVWAP(closes, volumes) {
    const result = []
    let cumVol = 0
    let cumPV = 0
    for (let i = 0; i < closes.length; i++) {
        cumVol += volumes[i]
        cumPV += closes[i] * volumes[i]
        result.push(+(cumPV / cumVol).toFixed(2))
    }
    return result
}
