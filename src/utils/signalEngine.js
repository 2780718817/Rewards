/**
 * 买卖信号引擎 v2
 * 多指标共振 + 量价分析 + 趋势判断 + 仓位建议 + 操作摘要 + 历史信号
 */

import { calcMA, calcMACD, calcRSI, calcKDJ, calcBOLL } from '../data/indicators'

// ============ ATR 计算 ============

function calcATR(highs, lows, closes, period = 14) {
    const trs = []
    for (let i = 0; i < closes.length; i++) {
        if (i === 0) { trs.push(highs[i] - lows[i]) }
        else {
            trs.push(Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            ))
        }
    }
    const atrs = []
    for (let i = 0; i < trs.length; i++) {
        if (i < period - 1) { atrs.push(null) }
        else {
            let sum = 0
            for (let j = 0; j < period; j++) sum += trs[i - j]
            atrs.push(+(sum / period).toFixed(4))
        }
    }
    return atrs
}

// ============ 量价分析 ============

/**
 * 计算均量比（当日成交量 / N日均量）
 */
function calcVolumeRatio(volumes, period = 5) {
    const ratios = []
    for (let i = 0; i < volumes.length; i++) {
        if (i < period) { ratios.push(1); continue }
        let sum = 0
        for (let j = 1; j <= period; j++) sum += volumes[i - j]
        const avg = sum / period
        ratios.push(avg > 0 ? +(volumes[i] / avg).toFixed(2) : 1)
    }
    return ratios
}

// ============ 趋势判断 ============

/**
 * 判断当前趋势
 * @returns { trend: 'up'|'down'|'sideways', trendText: string }
 */
function detectTrend(closes, ma20, ma60, n) {
    // MA20 近5日斜率
    let ma20Rising = false, ma20Falling = false
    if (ma20[n - 1] !== null && ma20[n - 5] !== null) {
        const slope = (ma20[n - 1] - ma20[n - 5]) / ma20[n - 5] * 100
        if (slope > 0.3) ma20Rising = true
        if (slope < -0.3) ma20Falling = true
    }

    const price = closes[n - 1]
    const aboveMa60 = ma60[n - 1] !== null && price > ma60[n - 1]
    const belowMa60 = ma60[n - 1] !== null && price < ma60[n - 1]

    if (ma20Rising && aboveMa60) return { trend: 'up', trendText: '上升趋势' }
    if (ma20Falling && belowMa60) return { trend: 'down', trendText: '下降趋势' }
    return { trend: 'sideways', trendText: '震荡整理' }
}

// ============ 多周期与形态学 (Professional Grade) ============

function toWeeklyKlines(dailyKlines) {
    if (!dailyKlines || dailyKlines.length === 0) return [];
    let currentWeek = [];
    const weeks = [];
    let currWeekLabel = '';

    for (const k of dailyKlines) {
        const dateObj = new Date(k.date);
        dateObj.setUTCDate(dateObj.getUTCDate() + 4 - (dateObj.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((dateObj - yearStart) / 86400000) + 1) / 7);
        const label = `${dateObj.getUTCFullYear()}-W${weekNo}`;

        if (label !== currWeekLabel) {
            if (currentWeek.length > 0) {
                weeks.push({
                    date: currentWeek[currentWeek.length - 1].date,
                    open: currentWeek[0].open,
                    high: Math.max(...currentWeek.map(c => c.high)),
                    low: Math.min(...currentWeek.map(c => c.low)),
                    close: currentWeek[currentWeek.length - 1].close,
                    volume: currentWeek.reduce((sum, c) => sum + c.volume, 0)
                });
            }
            currentWeek = [k];
            currWeekLabel = label;
        } else {
            currentWeek.push(k);
        }
    }
    if (currentWeek.length > 0) {
        weeks.push({
            date: currentWeek[currentWeek.length - 1].date,
            open: currentWeek[0].open,
            high: Math.max(...currentWeek.map(c => c.high)),
            low: Math.min(...currentWeek.map(c => c.low)),
            close: currentWeek[currentWeek.length - 1].close,
            volume: currentWeek.reduce((sum, c) => sum + c.volume, 0)
        });
    }
    return weeks;
}

function calcWeeklyTrend(dailyKlines) {
    const weekly = toWeeklyKlines(dailyKlines);
    if (weekly.length < 10) return { trend: 'unknown', text: '周线数据不足' };
    const closes = weekly.map(k => k.close);
    // 简易周线均线
    const ma5 = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < 4) ma5.push(null);
        else ma5.push((closes[i] + closes[i - 1] + closes[i - 2] + closes[i - 3] + closes[i - 4]) / 5);
    }
    const lastClose = closes[closes.length - 1];

    if (ma5[ma5.length - 1] && lastClose > ma5[ma5.length - 1] && ma5[ma5.length - 1] > ma5[ma5.length - 2]) return { trend: 'up', text: '周线多头' };
    if (ma5[ma5.length - 1] && lastClose < ma5[ma5.length - 1] && ma5[ma5.length - 1] < ma5[ma5.length - 2]) return { trend: 'down', text: '周线空头' };
    return { trend: 'sideways', text: '周线震荡' };
}

function detectPatterns(klines) {
    const n = klines.length;
    if (n < 4) return [];
    const patterns = [];
    const curr = klines[n - 1];
    const prev = klines[n - 2];

    const body = Math.abs(curr.close - curr.open);
    const upperShadow = curr.high - Math.max(curr.open, curr.close);
    const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
    const range = curr.high - curr.low;

    const prevIsRed = prev.close > prev.open;
    const prevIsGreen = prev.close < prev.open;
    const currIsRed = curr.close > curr.open;
    const currIsGreen = curr.close < curr.open;

    // 1. 放量阳包阴 
    if (prevIsGreen && currIsRed && curr.open < prev.close && curr.close > prev.open && curr.volume > prev.volume * 1.2) {
        patterns.push({ name: '放量阳包阴', type: 'buy', label: '形态: 放量阳包阴' });
    }

    // 2. 单针探底
    if (lowerShadow > body * 2 && upperShadow < body * 0.5 && range > curr.close * 0.02) {
        patterns.push({ name: '单针探底', type: 'buy', label: '形态: 单针探底' });
    }

    // 3. 倾盆大雨(阴包阳) 
    if (prevIsRed && currIsGreen && curr.open > prev.close && curr.close < prev.open && curr.volume > prev.volume * 1.2) {
        patterns.push({ name: '放量阴包阳', type: 'sell', label: '形态: 放量阴包阳' });
    }

    // 4. 长上影线避雷针
    if (upperShadow > body * 2 && lowerShadow < body * 0.5 && range > curr.close * 0.02 && curr.volume > prev.volume) {
        patterns.push({ name: '放量长上影', type: 'sell', label: '形态: 避雷针抛压' });
    }

    return patterns;
}

// ============ 历史胜率回测库 ============
function calcBacktestMetrics(signalMarks, closes, highs, lows) {
    const buys = signalMarks.filter(m => m.type === 'buy');
    let wins = 0, losses = 0;
    let sumWin = 0, sumLoss = 0;

    buys.forEach(b => {
        const i = b.index;
        if (!i || i > closes.length - 5) return;
        const entryPrice = closes[i];

        let maxHigh = entryPrice;
        let minLow = entryPrice;
        for (let j = i + 1; j <= Math.min(i + 15, closes.length - 1); j++) {
            if (highs[j] > maxHigh) maxHigh = highs[j];
            if (lows[j] < minLow) minLow = lows[j];
        }

        const returnPct = (maxHigh - entryPrice) / entryPrice * 100;
        const lossPct = (entryPrice - minLow) / entryPrice * 100;

        // 假设止盈 8%，止损 5%
        if (returnPct >= 8) {
            wins++; sumWin += 8;
        } else if (lossPct >= 5) {
            losses++; sumLoss -= 5;
        } else {
            const finalPnl = (closes[Math.min(i + 15, closes.length - 1)] - entryPrice) / entryPrice * 100;
            if (finalPnl > 0) { wins++; sumWin += finalPnl; }
            else { losses++; sumLoss += finalPnl; }
        }
    });

    const total = wins + losses;
    if (total === 0) return { tradeCount: 0, winRate: 0, avgWin: 0, avgLoss: 0 };

    const winRate = +(wins / total * 100).toFixed(1);
    const avgWin = wins > 0 ? +(sumWin / wins).toFixed(2) : 0;
    const avgLoss = losses > 0 ? +(sumLoss / losses).toFixed(2) : 0;

    return { tradeCount: total, winRate, avgWin, avgLoss };
}

// ============ 极致量化模型 (Squeeze & Momentum) ============

/**
 * 波动率极限收敛爆发模型 (BOLL Squeeze)
 * 检测布林带宽度是否处于过去半年的极低值，并且当前有放量向上突破迹象
 */
function detectBollSqueeze(closes, boll, volumes, volRatios) {
    const n = closes.length;
    if (n < 60) return null;

    // 计算过去所有的布林带宽度 (带宽 = (上轨 - 下轨) / 中轨)
    const bandwidths = [];
    for (let i = 0; i < n; i++) {
        if (boll.upper[i] && boll.lower[i] && boll.mid[i]) {
            bandwidths.push((boll.upper[i] - boll.lower[i]) / boll.mid[i]);
        } else {
            bandwidths.push(null);
        }
    }

    // 看最近 5 天内的最小带宽，是否属于过去 120 天的最低 5% 水平
    const recentBW = Math.min(...bandwidths.slice(-5).filter(b => b !== null));
    const pastBW = bandwidths.slice(-120).filter(b => b !== null);
    if (pastBW.length < 60) return null;

    const minPastBW = Math.min(...pastBW);
    const isSqueezing = recentBW <= minPastBW * 1.2; // 处于极度收敛状态

    const currPrice = closes[n - 1];
    const currUpper = boll.upper[n - 1];
    const isBreakingOut = currPrice > currUpper * 0.99; // 价格开始触碰或突破上轨
    const isVolumeSurge = volRatios[n - 1] > 1.8; // 成交量相比均量放大1.8倍以上

    if (isSqueezing && isBreakingOut && isVolumeSurge) {
        return { type: 'buy', label: '🔥 终极买点: 波动率极限收敛后放量突破(BB Squeeze)' };
    }
    return null;
}

/**
 * 个股内生相对强度 (Internal Price Strength, IPS)
 * 简化版 RPS：计算该股近 50 日涨跌幅，如果在全部历史表现中处于高位，说明处于主升段
 */
function calcInternalStrength(closes) {
    const n = closes.length;
    if (n < 50) return { score: 50, isStrong: false };
    const currentReturn = (closes[n - 1] - closes[n - 50]) / closes[n - 50];
    return {
        score: Math.round(currentReturn * 100), // 这里简单返回 50 日涨跌幅%作为强度分
        isStrong: currentReturn > 0.15 // 50 日涨幅超过 15% 视为强势
    };
}

// ============ 信号检测 ============

function detectCross(fast, slow, lookback = 3) {
    const n = fast.length
    if (n < 2) return 'hold'
    for (let i = n - 1; i >= Math.max(0, n - lookback); i--) {
        if (fast[i] === null || slow[i] === null || i === 0) continue
        if (fast[i - 1] === null || slow[i - 1] === null) continue
        const prevDiff = fast[i - 1] - slow[i - 1]
        const currDiff = fast[i] - slow[i]
        if (prevDiff <= 0 && currDiff > 0) return 'buy'
        if (prevDiff >= 0 && currDiff < 0) return 'sell'
    }
    return 'hold'
}

// ============ 背离检测 ============

/**
 * 使用摆动点(Swing High/Low)检测MACD/RSI背离 — #5改进版
 * 摆动高点：左右各5根K线都低于该点（避免相邻日产生虚假极值）
 * 顶背离：近期摆动高点价格更高，但指标值更低 → 卖出信号
 * 底背离：近期摆动低点价格更低，但指标值更高 → 买入信号
 */
function findSwingPoints(closes, lookback, wing = 5) {
    const n = closes.length
    const start = n - lookback
    const swingHighs = [], swingLows = []
    for (let i = start + wing; i < n - wing; i++) {
        const slice = closes.slice(i - wing, i + wing + 1)
        const pivot = closes[i]
        if (pivot === Math.max(...slice)) swingHighs.push(i)
        if (pivot === Math.min(...slice)) swingLows.push(i)
    }
    return { swingHighs, swingLows }
}

function detectDivergence(closes, indicator, lookback = 30) {
    const n = closes.length
    if (n < lookback + 10) return 'none'

    const { swingHighs, swingLows } = findSwingPoints(closes, lookback, 5)

    // 顶背离：取最近两个摆动高点（间隔≥5），价格更高但指标更低
    if (swingHighs.length >= 2) {
        const [i1, i2] = [swingHighs[swingHighs.length - 2], swingHighs[swingHighs.length - 1]]
        if (i2 - i1 >= 5) {
            const [p1, p2] = [closes[i1], closes[i2]]
            const [ind1, ind2] = [indicator[i1], indicator[i2]]
            if (p2 > p1 && ind1 !== null && ind2 !== null && ind2 < ind1) return 'top'
        }
    }

    // 底背离：取最近两个摆动低点（间隔≥5），价格更低但指标更高
    if (swingLows.length >= 2) {
        const [i1, i2] = [swingLows[swingLows.length - 2], swingLows[swingLows.length - 1]]
        if (i2 - i1 >= 5) {
            const [p1, p2] = [closes[i1], closes[i2]]
            const [ind1, ind2] = [indicator[i1], indicator[i2]]
            if (p2 < p1 && ind1 !== null && ind2 !== null && ind2 > ind1) return 'bottom'
        }
    }

    return 'none'
}

// ============ 历史信号标记 ============

/**
 * 遍历并标记历史上出现过的关键信号点
 */
function findHistoricalSignals(klines, ma5, ma20, macd, boll, volRatios) {
    const rawMarks = [];
    const n = klines.length;
    if (n < 2) return [];

    // 计算历史 BOLL 带宽用于 Squeeze 模型
    const bandwidths = [];
    for (let i = 0; i < n; i++) {
        if (boll.upper[i] && boll.lower[i] && boll.mid[i]) {
            bandwidths.push((boll.upper[i] - boll.lower[i]) / boll.mid[i]);
        } else {
            bandwidths.push(null);
        }
    }

    for (let i = 2; i < n; i++) {
        const date = klines[i].date;
        const curr = klines[i];
        const prev = klines[i - 1];

        // ---- MA金叉/死叉 ----
        if (ma5[i - 1] !== null && ma20[i - 1] !== null && ma5[i] !== null && ma20[i] !== null) {
            if (ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i]) rawMarks.push({ index: i, date, type: 'buy', source: 'MA金叉' });
            if (ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i]) rawMarks.push({ index: i, date, type: 'sell', source: 'MA死叉' });
        }

        // ---- MACD金叉/死叉 ----
        if (macd.dif[i - 1] !== null && macd.dea[i - 1] !== null && macd.dif[i] !== null && macd.dea[i] !== null) {
            if (macd.dif[i - 1] <= macd.dea[i - 1] && macd.dif[i] > macd.dea[i]) rawMarks.push({ index: i, date, type: 'buy', source: 'MACD金叉' });
            if (macd.dif[i - 1] >= macd.dea[i - 1] && macd.dif[i] < macd.dea[i]) rawMarks.push({ index: i, date, type: 'sell', source: 'MACD死叉' });
        }

        // ---- K线形态 (同步于 detectPatterns) ----
        const body = Math.abs(curr.close - curr.open);
        const upperShadow = curr.high - Math.max(curr.open, curr.close);
        const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
        const range = curr.high - curr.low;

        const prevIsRed = prev.close > prev.open;
        const prevIsGreen = prev.close < prev.open;
        const currIsRed = curr.close > curr.open;
        const currIsGreen = curr.close < curr.open;

        if (prevIsGreen && currIsRed && curr.open < prev.close && curr.close > prev.open && curr.volume > prev.volume * 1.2) {
            rawMarks.push({ index: i, date, type: 'buy', source: '阳包阴' });
        }
        if (lowerShadow > body * 2 && upperShadow < body * 0.5 && range > curr.close * 0.02) {
            rawMarks.push({ index: i, date, type: 'buy', source: '单针探底' });
        }
        if (prevIsRed && currIsGreen && curr.open > prev.close && curr.close < prev.open && curr.volume > prev.volume * 1.2) {
            rawMarks.push({ index: i, date, type: 'sell', source: '阴包阳' });
        }
        if (upperShadow > body * 2 && lowerShadow < body * 0.5 && range > curr.close * 0.02 && curr.volume > prev.volume) {
            rawMarks.push({ index: i, date, type: 'sell', source: '避雷针' });
        }

        // ---- BOLL Squeeze 破局点 ----
        if (i >= 120) {
            const recentBW = Math.min(...bandwidths.slice(i - 4, i + 1).filter(b => b !== null));
            const pastBW = bandwidths.slice(i - 119, i + 1).filter(b => b !== null);
            if (pastBW.length >= 60) {
                const minPastBW = Math.min(...pastBW);
                const isSqueezing = recentBW <= minPastBW * 1.2;
                const isBreakingOut = curr.close > boll.upper[i] * 0.99;
                const isVolumeSurge = volRatios[i] > 1.8;

                if (isSqueezing && isBreakingOut && isVolumeSurge) {
                    rawMarks.push({ index: i, date, type: 'buy', source: 'BOLL突破' });
                }
            }
        }
    }

    // ==== 机构级降噪优化：剔除连续重叠的冗余信号 ====
    // 很多时候形态学和指标会在相隔 1-2 天内连续触发同向信号，对于图表这是冗余噪音。
    // 我们在此应用时间窗去重机制 (Time Window Filtration)。
    const marks = [];
    if (rawMarks.length > 0) {
        marks.push(rawMarks[0]);
        for (let j = 1; j < rawMarks.length; j++) {
            const currentMark = rawMarks[j];
            const lastMark = marks[marks.length - 1];

            // 如果两个信号类型相同（同为买或同为卖），且它们出现的相隔天数小于 3 天，则丢弃后续的冗余信号
            if (currentMark.type === lastMark.type && (currentMark.index - lastMark.index) <= 3) {
                // 不去插入这根连续重叠的信号
                // 但是如果 currentMark 包含了诸如 '阳包阴' 这种更具爆发力的形态，可以选择覆盖更新（为保简单这里只留首个发起点）
            } else {
                marks.push(currentMark);
            }
        }
    }

    return marks;
}

// ============ 仓位建议 ============

function suggestPosition(signal, signalStrength, riskLevel, trend, rValue = 0.03) {
    // #2: R值控制 — R = 止损空间/价格；R越大风险越高，仓位越小
    // rValue 传入时已是小数（e.g. 0.03 = 3%止损）
    const trendAligned = (signal.startsWith('buy') && trend === 'up') || (signal.startsWith('sell') && trend === 'down')

    // R值仓位上限矩阵：止损>6%最多轻仓，3-6%最多半仓，<3%可重仓
    const maxLevel = rValue > 0.06 ? 1 : rValue > 0.03 ? 2 : 3

    if (signal === 'buy' && riskLevel === 'low' && trendAligned && maxLevel >= 3)
        return { position: '重仓', positionPct: '70-80%', positionLevel: 3 }
    if (signal === 'buy' && trendAligned && maxLevel >= 2)
        return { position: '半仓', positionPct: '40-60%', positionLevel: 2 }
    if (signal === 'buy' || signal === 'buy_weak')
        return { position: '轻仓', positionPct: '20-30%', positionLevel: 1 }
    if (signal === 'sell' || signal === 'sell_weak')
        return { position: '减仓', positionPct: '减至10%', positionLevel: 0 }
    return { position: '观望', positionPct: '空仓等待', positionLevel: -1 }
}

// ============ 操作摘要 ============

function generateAdvice(name, signal, signalText, reasons, trend, trendText, riskText, stopLoss, position, volumeDesc) {
    const trendPart = trend === 'up' ? '处于上升趋势' : trend === 'down' ? '处于下降趋势' : '横盘震荡'
    const volumePart = volumeDesc ? `，${volumeDesc}` : ''

    if (signal === 'buy') {
        return `${name}${trendPart}${volumePart}，${reasons[0]}，建议${position}买入，止损设在${stopLoss}。`
    }
    if (signal === 'buy_weak') {
        return `${name}${trendPart}${volumePart}，出现${reasons[0]}信号，可${position}试探，严守止损${stopLoss}。`
    }
    if (signal === 'sell') {
        return `${name}${trendPart}${volumePart}，${reasons[0]}，建议${position}或止盈离场。`
    }
    if (signal === 'sell_weak') {
        return `${name}${trendPart}${volumePart}，${reasons[0]}，宜${position}，关注是否进一步走弱。`
    }
    return `${name}${trendPart}${volumePart}，暂无明确方向信号，建议${position}等待机会。`
}

// ============ 核心分析函数 ============

export function analyzeStock(klines, currentPrice, stockName = '') {
    if (!klines || klines.length < 30) {
        return {
            signal: 'hold', signalText: '观望', signalStrength: 0,
            riskLevel: 'unknown', riskText: '数据不足',
            trend: 'sideways', trendText: '未知',
            volumeRatio: 1, volumeDesc: '',
            position: '观望', positionPct: '空仓', positionLevel: -1,
            advice: '数据不足，无法分析。',
            reasons: ['K线数据不足'],
            stopLoss: null, takeProfit: null,
            support: null, resistance: null,
            indicators: {}, series: {}, signalMarks: [], backtest: null,
        }
    }

    const closes = klines.map(k => k.close)
    const highs = klines.map(k => k.high)
    const lows = klines.map(k => k.low)
    const volumes = klines.map(k => k.volume)
    const dates = klines.map(k => k.date)
    const price = currentPrice || closes[closes.length - 1]
    const n = closes.length

    // ---- 技术指标 ----
    const ma5 = calcMA(closes, 5)
    const ma10 = calcMA(closes, 10)
    const ma20 = calcMA(closes, 20)
    const ma60 = calcMA(closes, 60)
    const macd = calcMACD(closes)
    const rsi = calcRSI(closes, 14)
    const kdj = calcKDJ(highs, lows, closes, 9)
    const boll = calcBOLL(closes, 20)
    const atrs = calcATR(highs, lows, closes, 14)
    const volRatios = calcVolumeRatio(volumes, 5)

    const lastRSI = rsi[n - 1], lastK = kdj.k[n - 1], lastD = kdj.d[n - 1], lastJ = kdj.j[n - 1]
    const lastATR = atrs[n - 1]
    const lastBollUpper = boll.upper[n - 1], lastBollLower = boll.lower[n - 1], lastBollMid = boll.mid[n - 1]
    const lastDIF = macd.dif[n - 1], lastDEA = macd.dea[n - 1]
    const lastVolRatio = volRatios[n - 1]

    // ---- 趋势判断 ----
    const { trend, trendText } = detectTrend(closes, ma20, ma60, n)
    const weeklyTrend = calcWeeklyTrend(klines)
    const patterns = detectPatterns(klines)

    // ---- 专业量价模型 ----
    const bollSqueeze = detectBollSqueeze(closes, boll, volumes, volRatios)
    const strength = calcInternalStrength(closes)

    // ---- 量价描述 ----
    let volumeDesc = ''
    if (lastVolRatio >= 2.0) volumeDesc = '显著放量'
    else if (lastVolRatio >= 1.5) volumeDesc = '温和放量'
    else if (lastVolRatio <= 0.5) volumeDesc = '明显缩量'
    else if (lastVolRatio <= 0.7) volumeDesc = '缩量'

    // ---- 信号判断 ----
    let buySignals = 0, sellSignals = 0
    const reasons = []

    // 1. MA金叉/死叉
    const maCross = detectCross(ma5, ma20, 3)
    if (maCross === 'buy') { buySignals++; reasons.push('MA5上穿MA20（金叉）') }
    if (maCross === 'sell') { sellSignals++; reasons.push('MA5下穿MA20（死叉）') }

    // 2. MA排列
    if (ma5[n - 1] && ma10[n - 1] && ma20[n - 1]) {
        if (ma5[n - 1] > ma10[n - 1] && ma10[n - 1] > ma20[n - 1]) { buySignals++; reasons.push('均线多头排列') }
        if (ma5[n - 1] < ma10[n - 1] && ma10[n - 1] < ma20[n - 1]) { sellSignals++; reasons.push('均线空头排列') }
    }

    // 3. MACD
    const macdCross = detectCross(macd.dif, macd.dea, 3)
    if (macdCross === 'buy') { buySignals++; reasons.push('MACD金叉 (DIF上穿DEA)') }
    if (macdCross === 'sell') { sellSignals++; reasons.push('MACD死叉 (DIF下穿DEA)') }

    // 4. RSI
    if (lastRSI !== null) {
        if (lastRSI < 30) { buySignals++; reasons.push(`RSI超卖 (${lastRSI})`) }
        if (lastRSI > 70) { sellSignals++; reasons.push(`RSI超买 (${lastRSI})`) }
    }

    // 5. KDJ
    const kdjCross = detectCross(kdj.k, kdj.d, 3)
    if (kdjCross === 'buy' && lastJ !== null && lastJ < 20) { buySignals++; reasons.push('KDJ超卖金叉') }  // #1: 门槛20更严格
    if (kdjCross === 'sell' && lastJ !== null && lastJ > 80) { sellSignals++; reasons.push('KDJ超买死叉') }  // #1: 门槛80更严格

    // 6. 布林带
    if (lastBollLower !== null && lastBollUpper !== null) {
        if (price <= lastBollLower * 1.01) { buySignals++; reasons.push('触及布林下轨') }
        if (price >= lastBollUpper * 0.99) { sellSignals++; reasons.push('触及布林上轨') }
    }

    // 7. 量价配合 — 放量增强信号可信度
    if (lastVolRatio >= 1.5) {
        if (closes[n - 1] > closes[n - 2]) { buySignals++; reasons.push(`放量上涨 (量比${lastVolRatio})`) }
        if (closes[n - 1] < closes[n - 2]) { sellSignals++; reasons.push(`放量下跌 (量比${lastVolRatio})`) }
    }

    // 8. MACD/RSI 背离 — 最可靠的反转信号
    const macdDiv = detectDivergence(closes, macd.dif, 30)
    if (macdDiv === 'top') { sellSignals += 2; reasons.push('⚠️ MACD顶背离（强烈卖出信号）') }
    if (macdDiv === 'bottom') { buySignals += 2; reasons.push('⚠️ MACD底背离（强烈买入信号）') }
    const rsiDiv = detectDivergence(closes, rsi, 30)
    if (rsiDiv === 'top') { sellSignals++; reasons.push('RSI顶背离') }
    if (rsiDiv === 'bottom' && lastRSI !== null && lastRSI < 50) { buySignals++; reasons.push('RSI底背离') }  // #1: 必须在中轴以下

    // 9. 形态学判断及多周期共振叠加
    patterns.forEach(p => {
        if (p.type === 'buy') { buySignals += 2; reasons.push(`🌟 ${p.label}`); }
        if (p.type === 'sell') { sellSignals += 2; reasons.push(`⚠️ ${p.label}`); }
    });

    // 10. 终极模型：波动率收敛突破 (BB Squeeze) — #1: 需要周线配合才给满分
    if (bollSqueeze && bollSqueeze.type === 'buy') {
        if (weeklyTrend.trend === 'up') {
            buySignals += 5;  // 周线多头共振：满分5
            reasons.unshift(bollSqueeze.label + ' + 周线多头共振');
        } else {
            buySignals += 2;  // 周线未确认：仅给2分，不单独触发强买
            reasons.unshift(bollSqueeze.label + '（待周线确认）');
        }
    }

    // 11. 强弱过滤
    if (strength.isStrong && buySignals >= 2) {
        reasons.unshift(`🚀 强势股: 近50日涨幅达 ${strength.score}%`);
    }

    // ---- 综合判定（#4: 周线趋势具有否决权）----
    let signal, signalText, signalStrength
    if (buySignals >= 3 && buySignals > sellSignals) {
        signal = 'buy'; signalText = '买入'; signalStrength = Math.min(buySignals, 5)
        // 周线共振加强
        if (weeklyTrend.trend === 'up') {
            reasons.unshift('🌟 周线多头趋势共振确认'); signalStrength = 5;
        }
        // #4: 周线空头否决——逆势做多，降级为偏多
        if (weeklyTrend.trend === 'down') {
            signal = 'buy_weak'; signalText = '偏多'; signalStrength = Math.max(1, signalStrength - 2);
            reasons.unshift('⚠️ 周线空头中，日线买入信号可靠性降低');
        }
    } else if (sellSignals >= 3 && sellSignals > buySignals) {
        signal = 'sell'; signalText = '卖出'; signalStrength = Math.min(sellSignals, 5)
        // 周线共振加强
        if (weeklyTrend.trend === 'down') {
            reasons.unshift('⚠️ 周线空头趋势共振确认'); signalStrength = 5;
        }
        // #4: 周线多头否决——逆势做空，降级为偏空
        if (weeklyTrend.trend === 'up') {
            signal = 'sell_weak'; signalText = '偏空'; signalStrength = Math.max(1, signalStrength - 2);
            reasons.unshift('🌟 周线多头中，卖出信号仅作减仓参考');
        }
    } else if (buySignals >= 2 && buySignals > sellSignals) {
        signal = 'buy_weak'; signalText = '偏多'; signalStrength = buySignals
        if (weeklyTrend.trend === 'up') { reasons.unshift('🌟 周线多头支撑'); signalStrength = Math.min(signalStrength + 1, 5); }
    } else if (sellSignals >= 2 && sellSignals > buySignals) {
        signal = 'sell_weak'; signalText = '偏空'; signalStrength = sellSignals
        if (weeklyTrend.trend === 'down') { reasons.unshift('⚠️ 周线空头压制'); signalStrength = Math.min(signalStrength + 1, 5); }
    } else {
        signal = 'hold'; signalText = '观望'; signalStrength = 0
    }
    if (reasons.length === 0) reasons.push('无明确方向信号')

    // ---- 风控 ----
    const atr = lastATR || (price * 0.02)
    const recent20High = Math.max(...highs.slice(-20))
    const recent20Low = Math.min(...lows.slice(-20))

    // 动态追踪止损 (Chandelier Exit: 过去22天最高价 - 2.5ATR)
    let max22 = -Infinity;
    for (let i = Math.max(0, n - 22); i < n; i++) if (highs[i] > max22) max22 = highs[i];
    const trailingStop = +(max22 - 2.5 * atr).toFixed(2);

    // 结合静态止损支撑，取严格值
    // #6修复: 确保止损不高于当前价（Chandelier Exit 在某些情况接近或超过价格）
    const rawStop = Math.max(+(price - 2 * atr).toFixed(2), trailingStop);
    const stopLoss = +Math.min(rawStop, price * 0.97).toFixed(2);  // 止损最多在当前价3%以内
    const takeProfit = +(price + 3 * atr).toFixed(2)

    const volatility = atr / price
    let riskLevel, riskText
    if (volatility < 0.02) { riskLevel = 'low'; riskText = '低风险' }
    else if (volatility < 0.04) { riskLevel = 'medium'; riskText = '中风险' }
    else { riskLevel = 'high'; riskText = '高风险' }

    const stopLossPercent = +((stopLoss - price) / price * 100).toFixed(2)
    const takeProfitPercent = +((takeProfit - price) / price * 100).toFixed(2)

    // ---- 仓位建议 ----
    // 计算 R 值（止损空间占比），传给仓位建议
    const stopRange = price > 0 ? Math.abs(price - stopLoss) / price : 0.03
    const { position, positionPct, positionLevel } = suggestPosition(signal, signalStrength, riskLevel, trend, stopRange)

    // ---- 操作摘要 ----
    const advice = generateAdvice(stockName || '该股', signal, signalText, reasons, trend, trendText, riskText, stopLoss, position, volumeDesc)

    // ---- 历史信号标记与回测 ----
    const signalMarks = findHistoricalSignals(klines, ma5, ma20, macd, boll, volRatios)
    const backtest = calcBacktestMetrics(signalMarks, closes, highs, lows)

    if (backtest.winRate >= 60 && backtest.tradeCount >= 3 && signal === 'buy') {
        reasons.unshift(`🏆 历史回测胜率高达 ${backtest.winRate}%`);
    }

    return {
        signal, signalText, signalStrength,
        riskLevel, riskText,
        trend, trendText,
        volumeRatio: lastVolRatio, volumeDesc,
        position, positionPct, positionLevel,
        advice,
        reasons,
        stopLoss, stopLossPercent, takeProfit, takeProfitPercent,
        support: +recent20Low.toFixed(2), resistance: +recent20High.toFixed(2),
        atr: +atr.toFixed(4),
        indicators: {
            ma5: ma5[n - 1], ma10: ma10[n - 1], ma20: ma20[n - 1], ma60: ma60[n - 1],
            dif: lastDIF, dea: lastDEA, rsi: lastRSI,
            k: lastK, d: lastD, j: lastJ,
            bollUpper: lastBollUpper, bollMid: lastBollMid, bollLower: lastBollLower,
            volumeRatio: lastVolRatio,
            ips: strength.score
        },
        series: { ma5, ma10, ma20, ma60, macd, rsi, kdj, boll, volRatios },
        signalMarks, backtest,
    }
}

// ============ 样式映射 ============

export function getSignalStyle(signal) {
    switch (signal) {
        case 'buy': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', text: '买入', icon: '🟢' }
        case 'buy_weak': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '偏多', icon: '🟡' }
        case 'sell': return { color: '#3fb950', bg: 'rgba(63,185,80,0.15)', text: '卖出', icon: '🔴' }
        case 'sell_weak': return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', text: '偏空', icon: '🟠' }
        default: return { color: '#8b949e', bg: 'rgba(139,148,158,0.10)', text: '观望', icon: '⚪' }
    }
}

export function getRiskStyle(riskLevel) {
    switch (riskLevel) {
        case 'low': return { color: '#3fb950', bg: 'rgba(63,185,80,0.15)', text: '低' }
        case 'medium': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', text: '中' }
        case 'high': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', text: '高' }
        default: return { color: '#8b949e', bg: 'rgba(139,148,158,0.10)', text: '-' }
    }
}

export function getTrendStyle(trend) {
    switch (trend) {
        case 'up': return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '上升', icon: '📈' }
        case 'down': return { color: '#3fb950', bg: 'rgba(63,185,80,0.12)', text: '下降', icon: '📉' }
        default: return { color: '#8b949e', bg: 'rgba(139,148,158,0.10)', text: '震荡', icon: '📊' }
    }
}

export function getPositionStyle(positionLevel) {
    if (positionLevel >= 3) return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '重仓' }
    if (positionLevel >= 2) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: '半仓' }
    if (positionLevel >= 1) return { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', text: '轻仓' }
    if (positionLevel === 0) return { color: '#3fb950', bg: 'rgba(63,185,80,0.12)', text: '减仓' }
    return { color: '#8b949e', bg: 'rgba(139,148,158,0.10)', text: '空仓' }
}
