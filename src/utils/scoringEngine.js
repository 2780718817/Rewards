/**
 * 多因子量化评分引擎
 * 核心算法：百分位排名 + 加权评分
 */

// ============ 策略模板 ============

export const STRATEGIES = [
    {
        key: 'momentum',
        name: '强势突破',
        icon: '🚀',
        desc: '量价齐升，短线机会',
        color: '#ef4444',
        factors: {
            changePercent: { weight: 0.30, ascending: false, label: '涨跌幅' },
            turnoverRate: { weight: 0.20, ascending: false, label: '换手率' },
            turnover:      { weight: 0.15, ascending: false, label: '成交额' },
            amplitude:     { weight: 0.15, ascending: false, label: '振幅' },
            volumeRatio:   { weight: 0.20, ascending: false, label: '量比(量价异动)' },  // #3: 量价异动
        },
    },
    {
        key: 'value',
        name: '价值洼地',
        icon: '🏛️',
        desc: '低估值蓝筹，长期价值',
        color: '#3b82f6',
        factors: {
            pe: { weight: 0.30, ascending: true, label: 'PE估值' },
            pb: { weight: 0.25, ascending: true, label: 'PB估值' },
            totalCap: { weight: 0.25, ascending: false, label: '市值规模' },
            turnoverRate: { weight: 0.10, ascending: true, label: '换手率' },
            changePercent: { weight: 0.10, ascending: false, label: '涨跌幅' },
        },
    },
    {
        key: 'bluechip',
        name: '白马稳健',
        icon: '🐎',
        desc: '大盘低波动，适合长持',
        color: '#10b981',
        factors: {
            totalCap: { weight: 0.30, ascending: false, label: '市值规模' },
            pe: { weight: 0.25, ascending: true, label: 'PE估值' },
            turnoverRate: { weight: 0.20, ascending: true, label: '低换手' },
            amplitude: { weight: 0.15, ascending: true, label: '低波动' },
            pb: { weight: 0.10, ascending: true, label: 'PB估值' },
        },
    },
    {
        key: 'smallcap',
        name: '小盘活跃',
        icon: '⚡',
        desc: '小市值高弹性，高风险高收益',
        color: '#f59e0b',
        factors: {
            totalCap:    { weight: 0.20, ascending: true, label: '小市值' },
            turnoverRate:{ weight: 0.20, ascending: false, label: '高换手' },
            amplitude:   { weight: 0.20, ascending: false, label: '高振幅' },
            changePercent:{ weight: 0.20, ascending: false, label: '涨跌幅' },
            volumeRatio: { weight: 0.20, ascending: false, label: '量比(量价异动)' },  // #3: 量价异动
        },
    },
    {
        key: 'custom',
        name: '自定义',
        icon: '🎯',
        desc: '自行调节因子权重',
        color: '#8b5cf6',
        factors: {
            pe: { weight: 0.20, ascending: true, label: 'PE估值' },
            pb: { weight: 0.20, ascending: true, label: 'PB估值' },
            changePercent: { weight: 0.20, ascending: false, label: '涨跌幅' },
            turnoverRate: { weight: 0.20, ascending: false, label: '换手率' },
            totalCap: { weight: 0.20, ascending: false, label: '市值规模' },
        },
    },
]

// ============ 因子元数据 ============

export const FACTOR_META = {
    pe: { label: 'PE估值', unit: '', format: v => v > 0 ? v.toFixed(1) : '亏损' },
    pb: { label: 'PB估值', unit: '', format: v => v.toFixed(2) },
    changePercent: { label: '涨跌幅', unit: '%', format: v => (v > 0 ? '+' : '') + v.toFixed(2) + '%' },
    turnoverRate: { label: '换手率', unit: '%', format: v => v.toFixed(2) + '%' },
    turnover: {
        label: '成交额', unit: '万', format: v => {
            if (v >= 10000) return (v / 10000).toFixed(1) + '亿'
            return v.toFixed(0) + '万'
        }
    },
    amplitude: { label: '振幅', unit: '%', format: v => v.toFixed(2) + '%' },
    volumeRatio: { label: '量比', unit: 'x', format: v => v.toFixed(2) + 'x' },  // #3新增
    totalCap: {
        label: '市值', unit: '亿', format: v => {
            if (v >= 1e12) return (v / 1e12).toFixed(0) + '万亿'
            if (v >= 1e8) return (v / 1e8).toFixed(0) + '亿'
            return (v / 1e4).toFixed(0) + '万'
        }
    },
}

// ============ 核心评分算法 ============

/**
 * 计算百分位排名 (0-100)
 * @param {number[]} values - 所有值
 * @param {boolean} ascending - true=值越小分越高(如PE越低越好)
 * @returns {number[]} 每个值的百分位分数(0-100)
 */
function percentileRank(values, ascending) {
    const n = values.length
    if (n === 0) return []

    // 创建 (原始索引, 值) 对并排序
    const indexed = values.map((v, i) => [i, v])
    // ascending=true: 值越小排名越前(分越高); ascending=false: 值越大分越高
    indexed.sort((a, b) => ascending ? a[1] - b[1] : b[1] - a[1])

    const scores = new Array(n)
    for (let rank = 0; rank < n; rank++) {
        const origIdx = indexed[rank][0]
        scores[origIdx] = ((n - 1 - rank) / (n - 1)) * 100
    }
    return scores
}

/**
 * 对一组股票执行多因子评分
 * @param {Array} stocks - 股票数据数组
 * @param {object} strategy - 策略对象 (含 factors)
 * @returns {Array} 带评分的股票数组，按综合分降序
 */
export function computeScores(stocks, strategy) {
    if (!stocks || stocks.length === 0) return []
    const { factors } = strategy

    const factorKeys = Object.keys(factors)

    // 1. 提取每个因子的值序列，处理无效值
    const factorValues = {}
    for (const key of factorKeys) {
        factorValues[key] = stocks.map(s => {
            const v = s[key]
            if (v === null || v === undefined || isNaN(v)) return null
            // PE/PB 亏损(负值)时给极大值，让其排在最后
            if ((key === 'pe') && v <= 0) return 9999
            return v
        })
    }

    // 2. 对每个因子做百分位排名
    const factorScores = {}
    for (const key of factorKeys) {
        const vals = factorValues[key]
        // 将 null 替换为中位数以避免影响排名
        const validVals = vals.filter(v => v !== null)
        const median = validVals.length > 0
            ? validVals.sort((a, b) => a - b)[Math.floor(validVals.length / 2)]
            : 0
        const filledVals = vals.map(v => v !== null ? v : median)
        factorScores[key] = percentileRank(filledVals, factors[key].ascending)
    }

    // 3. 加权求和得到综合分
    const results = stocks.map((stock, i) => {
        let totalScore = 0
        let totalWeight = 0
        const details = {}

        for (const key of factorKeys) {
            const score = factorScores[key][i]
            const weight = factors[key].weight
            totalScore += score * weight
            totalWeight += weight
            details[key] = Math.round(score)
        }

        const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0

        return {
            ...stock,
            _score: finalScore,
            _details: details,
        }
    })

    // 4. 按综合分降序排序
    results.sort((a, b) => b._score - a._score)

    return results
}

/**
 * 获取评分对应的等级和颜色
 */
export function getScoreLevel(score) {
    if (score >= 80) return { level: 'S', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
    if (score >= 60) return { level: 'A', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    if (score >= 40) return { level: 'B', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
    if (score >= 20) return { level: 'C', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
    return { level: 'D', color: '#4b5563', bg: 'rgba(75,85,99,0.15)' }
}
