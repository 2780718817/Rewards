// 工具函数

/**
 * 格式化数字为带单位的字符串
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '--'
    if (Math.abs(num) >= 1e8) return (num / 1e8).toFixed(2) + '亿'
    if (Math.abs(num) >= 1e4) return (num / 1e4).toFixed(2) + '万'
    return num.toFixed(2)
}

/**
 * 格式化金额
 */
export function formatMoney(num) {
    if (num === null || num === undefined) return '--'
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化百分比
 */
export function formatPercent(num) {
    if (num === null || num === undefined) return '--'
    const prefix = num > 0 ? '+' : ''
    return prefix + num.toFixed(2) + '%'
}

/**
 * 获取涨跌颜色 class
 */
export function getChangeClass(value) {
    if (value > 0) return 'num-up'
    if (value < 0) return 'num-down'
    return 'num-flat'
}

/**
 * 获取涨跌颜色值
 */
export function getChangeColor(value) {
    if (value > 0) return '#f85149'
    if (value < 0) return '#3fb950'
    return '#8b949e'
}

/**
 * 种子随机数生成器 (用于稳定的随机数据)
 */
export function seededRandom(seed) {
    let s = seed
    return function () {
        s = (s * 16807 + 0) % 2147483647
        return s / 2147483647
    }
}

/**
 * 生成范围内的随机数
 */
export function randomInRange(min, max, rng = Math.random) {
    return min + rng() * (max - min)
}

/**
 * 日期格式化
 */
export function formatDate(date, fmt = 'YYYY-MM-DD') {
    const d = new Date(date)
    const map = {
        'YYYY': d.getFullYear(),
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'DD': String(d.getDate()).padStart(2, '0'),
        'HH': String(d.getHours()).padStart(2, '0'),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'ss': String(d.getSeconds()).padStart(2, '0'),
    }
    let result = fmt
    for (const [k, v] of Object.entries(map)) {
        result = result.replace(k, v)
    }
    return result
}

/**
 * 生成交易日序列
 */
export function generateTradingDays(count, endDate = new Date()) {
    const days = []
    const d = new Date(endDate)
    while (days.length < count) {
        const dow = d.getDay()
        if (dow !== 0 && dow !== 6) {
            days.unshift(new Date(d))
        }
        d.setDate(d.getDate() - 1)
    }
    return days
}
