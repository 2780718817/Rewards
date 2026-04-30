// A股核心股票池 - 沪深300 + 重要标的 (200+只)
// 包含股票代码、名称、所属行业

export const INDUSTRIES = [
    '银行', '白酒', '医药', '新能源', '半导体', '消费电子', '互联网',
    '汽车', '房地产', '保险', '证券', '钢铁', '煤炭', '有色金属',
    '电力', '军工', '传媒', '农业', '食品饮料', '化工', '机械',
    '建材', '纺织服装', '交通运输', '通信', '计算机', '光伏', '锂电池', '人工智能', '机器人',
    '石油', '家电', '环保', '航空', '酒店旅游', '零售',
]

export const STOCKS = [/*
    // ===== 白酒 =====
    { code: '600519', name: '贵州茅台', industry: '白酒' },
    { code: '000858', name: '五粮液', industry: '白酒' },
    { code: '600809', name: '山西汾酒', industry: '白酒' },
    { code: '000568', name: '泸州老窖', industry: '白酒' },
    { code: '002304', name: '洋河股份', industry: '白酒' },
    { code: '000799', name: '酒鬼酒', industry: '白酒' },
    { code: '603369', name: '今世缘', industry: '白酒' },
    { code: '000596', name: '古井贡酒', industry: '白酒' },

    // ===== 银行 =====
    { code: '601398', name: '工商银行', industry: '银行' },
    { code: '601288', name: '农业银行', industry: '银行' },
    { code: '601988', name: '中国银行', industry: '银行' },
    { code: '601939', name: '建设银行', industry: '银行' },
    { code: '600036', name: '招商银行', industry: '银行' },
    { code: '601166', name: '兴业银行', industry: '银行' },
    { code: '000001', name: '平安银行', industry: '银行' },
    { code: '600000', name: '浦发银行', industry: '银行' },
    { code: '601818', name: '光大银行', industry: '银行' },
    { code: '600015', name: '华夏银行', industry: '银行' },
    { code: '601998', name: '中信银行', industry: '银行' },
    { code: '002142', name: '宁波银行', industry: '银行' },
    { code: '600919', name: '江苏银行', industry: '银行' },

    // ===== 保险 =====
    { code: '601318', name: '中国平安', industry: '保险' },
    { code: '601628', name: '中国人寿', industry: '保险' },
    { code: '601601', name: '中国太保', industry: '保险' },
    { code: '002318', name: '中国财险', industry: '保险' },

    // ===== 证券 =====
    { code: '600030', name: '中信证券', industry: '证券' },
    { code: '601688', name: '华泰证券', industry: '证券' },
    { code: '600837', name: '海通证券', industry: '证券' },
    { code: '601211', name: '国泰君安', industry: '证券' },
    { code: '000166', name: '申万宏源', industry: '证券' },
    { code: '601066', name: '中信建投', industry: '证券' },

    // ===== 医药 =====
    { code: '600276', name: '恒瑞医药', industry: '医药' },
    { code: '300760', name: '迈瑞医疗', industry: '医药' },
    { code: '603259', name: '药明康德', industry: '医药' },
    { code: '300015', name: '爱尔眼科', industry: '医药' },
    { code: '000661', name: '长春高新', industry: '医药' },
    { code: '300347', name: '泰格医药', industry: '医药' },
    { code: '300896', name: '爱美客', industry: '医药' },
    { code: '603882', name: '金域医学', industry: '医药' },
    { code: '300122', name: '智飞生物', industry: '医药' },
    { code: '002007', name: '华兰生物', industry: '医药' },
    { code: '300529', name: '健帆生物', industry: '医药' },

    // ===== 半导体 =====
    { code: '688981', name: '中芯国际', industry: '半导体' },
    { code: '002371', name: '北方华创', industry: '半导体' },
    { code: '002049', name: '紫光国微', industry: '半导体' },
    { code: '688012', name: '中微公司', industry: '半导体' },
    { code: '603501', name: '韦尔股份', industry: '半导体' },
    { code: '688008', name: '澜起科技', industry: '半导体' },
    { code: '300782', name: '卓胜微', industry: '半导体' },
    { code: '603986', name: '兆易创新', industry: '半导体' },
    { code: '600584', name: '长电科技', industry: '半导体' },
    { code: '688396', name: '华润微', industry: '半导体' },
    { code: '301269', name: '华大九天', industry: '半导体' },
    { code: '300395', name: '菲利华', industry: '半导体' },

    // ===== 消费电子/家电 =====
    { code: '000333', name: '美的集团', industry: '家电' },
    { code: '000651', name: '格力电器', industry: '家电' },
    { code: '600690', name: '海尔智家', industry: '家电' },
    { code: '002032', name: '苏泊尔', industry: '家电' },
    { code: '002475', name: '立讯精密', industry: '消费电子' },
    { code: '002415', name: '海康威视', industry: '消费电子' },
    { code: '002241', name: '歌尔股份', industry: '消费电子' },
    { code: '688036', name: '传音控股', industry: '消费电子' },
    { code: '002916', name: '深南电路', industry: '消费电子' },
    { code: '300476', name: '胜宏科技', industry: '消费电子' },
    { code: '688169', name: '石头科技', industry: '消费电子' },

    // ===== 汽车 =====
    { code: '002594', name: '比亚迪', industry: '汽车' },
    { code: '601127', name: '赛力斯', industry: '汽车' },
    { code: '600104', name: '上汽集团', industry: '汽车' },
    { code: '000625', name: '长安汽车', industry: '汽车' },
    { code: '601238', name: '广汽集团', industry: '汽车' },
    { code: '002920', name: '德赛西威', industry: '汽车' },
    { code: '300750', name: '宁德时代', industry: '锂电池' },

    // ===== 锂电池 =====
    { code: '300014', name: '亿纬锂能', industry: '锂电池' },
    { code: '002460', name: '赣锋锂业', industry: '锂电池' },
    { code: '002466', name: '天齐锂业', industry: '锂电池' },
    { code: '002812', name: '恩捷股份', industry: '锂电池' },
    { code: '002709', name: '天赐材料', industry: '锂电池' },

    // ===== 光伏 =====
    { code: '601012', name: '隆基绿能', industry: '光伏' },
    { code: '600438', name: '通威股份', industry: '光伏' },
    { code: '300274', name: '阳光电源', industry: '光伏' },
    { code: '002459', name: '晶澳科技', industry: '光伏' },
    { code: '688599', name: '天合光能', industry: '光伏' },

    // ===== 互联网/计算机 =====
    { code: '300059', name: '东方财富', industry: '互联网' },
    { code: '300033', name: '同花顺', industry: '互联网' },
    { code: '688111', name: '金山办公', industry: '计算机' },
    { code: '300496', name: '中科创达', industry: '计算机' },
    { code: '002065', name: '东华软件', industry: '计算机' },
    { code: '688561', name: '奇安信', industry: '计算机' },
    { code: '002555', name: '三七互娱', industry: '传媒' },
    { code: '300418', name: '昆仑万维', industry: '传媒' },

    // ===== 人工智能/机器人 =====
    { code: '002230', name: '科大讯飞', industry: '人工智能' },
    { code: '688256', name: '寒武纪', industry: '人工智能' },
    { code: '002747', name: '埃斯顿', industry: '机器人' },
    { code: '300124', name: '汇川技术', industry: '机器人' },
    { code: '688169', name: '绿的谐波', industry: '机器人' },

    // ===== 通信 =====
    { code: '600050', name: '中国联通', industry: '通信' },
    { code: '601728', name: '中国电信', industry: '通信' },
    { code: '600941', name: '中国移动', industry: '通信' },
    { code: '300308', name: '中际旭创', industry: '通信' },
    { code: '300394', name: '天孚通信', industry: '通信' },
    { code: '300628', name: '亿联网络', industry: '通信' },

    // ===== 电力 =====
    { code: '600900', name: '长江电力', industry: '电力' },
    { code: '601985', name: '中国核电', industry: '电力' },
    { code: '600406', name: '国电南瑞', industry: '电力' },
    { code: '600089', name: '特变电工', industry: '电力' },
    { code: '003816', name: '中国广核', industry: '电力' },
    { code: '600023', name: '浙能电力', industry: '电力' },

    // ===== 化工 =====
    { code: '600309', name: '万华化学', industry: '化工' },
    { code: '601857', name: '中国石油', industry: '石油' },
    { code: '600028', name: '中国石化', industry: '石油' },
    { code: '600346', name: '恒力石化', industry: '化工' },
    { code: '002601', name: '龙蟒佰利', industry: '化工' },
    { code: '000830', name: '鲁西化工', industry: '化工' },

    // ===== 有色金属 =====
    { code: '601899', name: '紫金矿业', industry: '有色金属' },
    { code: '600219', name: '南山铝业', industry: '有色金属' },
    { code: '002460', name: '赣锋锂业', industry: '有色金属' },
    { code: '601600', name: '中国铝业', industry: '有色金属' },
    { code: '000878', name: '云南铜业', industry: '有色金属' },

    // ===== 钢铁 =====
    { code: '600019', name: '宝钢股份', industry: '钢铁' },
    { code: '000709', name: '河钢股份', industry: '钢铁' },
    { code: '600010', name: '包钢股份', industry: '钢铁' },

    // ===== 煤炭 =====
    { code: '601225', name: '陕西煤业', industry: '煤炭' },
    { code: '601088', name: '中国神华', industry: '煤炭' },
    { code: '600188', name: '兖矿能源', industry: '煤炭' },

    // ===== 军工 =====
    { code: '600760', name: '中航沈飞', industry: '军工' },
    { code: '600893', name: '航发动力', industry: '军工' },
    { code: '002179', name: '中航光电', industry: '军工' },
    { code: '600150', name: '中国船舶', industry: '军工' },
    { code: '601989', name: '中国重工', industry: '军工' },

    // ===== 食品饮料 =====
    { code: '600887', name: '伊利股份', industry: '食品饮料' },
    { code: '601888', name: '中国中免', industry: '食品饮料' },
    { code: '300999', name: '金龙鱼', industry: '食品饮料' },
    { code: '603288', name: '海天味业', industry: '食品饮料' },
    { code: '002568', name: '百润股份', industry: '食品饮料' },
    { code: '600872', name: '中炬高新', industry: '食品饮料' },

    // ===== 房地产 =====
    { code: '000002', name: '万科A', industry: '房地产' },
    { code: '001979', name: '招商蛇口', industry: '房地产' },
    { code: '600048', name: '保利发展', industry: '房地产' },
    { code: '000069', name: '华侨城A', industry: '房地产' },

    // ===== 交通运输 =====
    { code: '002352', name: '顺丰控股', industry: '交通运输' },
    { code: '601919', name: '中远海控', industry: '交通运输' },
    { code: '601816', name: '京沪高铁', industry: '交通运输' },
    { code: '600115', name: '中国东航', industry: '航空' },
    { code: '600029', name: '南方航空', industry: '航空' },
    { code: '601111', name: '中国国航', industry: '航空' },

    // ===== 农业 =====
    { code: '002714', name: '牧原股份', industry: '农业' },
    { code: '002311', name: '海大集团', industry: '农业' },
    { code: '300498', name: '温氏股份', industry: '农业' },

    // ===== 建材 =====
    { code: '600585', name: '海螺水泥', industry: '建材' },
    { code: '002271', name: '东方雨虹', industry: '建材' },
    { code: '000786', name: '北新建材', industry: '建材' },

    // ===== 机械 =====
    { code: '600031', name: '三一重工', industry: '机械' },
    { code: '000157', name: '中联重科', industry: '机械' },
    { code: '002008', name: '大族激光', industry: '机械' },
    { code: '300677', name: '英科医疗', industry: '机械' },

    // ===== 零售 =====
    { code: '002024', name: '苏宁易购', industry: '零售' },
    { code: '601933', name: '永辉超市', industry: '零售' },

    // ===== 酒店旅游 =====
    { code: '600138', name: '中青旅', industry: '酒店旅游' },
    { code: '002186', name: '全聚德', industry: '酒店旅游' },

    // ===== 环保 =====
    { code: '300070', name: '碧水源', industry: '环保' },
    { code: '000967', name: '盈峰环境', industry: '环保' },
*/]

// 去重 (按code)
const seen = new Set()
const deduped = []
for (const s of STOCKS) {
    if (!seen.has(s.code)) { seen.add(s.code); deduped.push(s) }
}
// 直接覆盖
STOCKS.length = 0
deduped.forEach(s => STOCKS.push(s))

// 指数定义
export const INDICES = [
    { code: '000001', name: '上证指数', base: 3150 },
    { code: '399001', name: '深证成指', base: 10200 },
    { code: '399006', name: '创业板指', base: 2050 },
    { code: '000300', name: '沪深300', base: 3800 },
    { code: '000905', name: '中证500', base: 5600 },
    { code: '000688', name: '科创50', base: 980 },
]

// 按行业分组
export function getStocksByIndustry() {
    const map = {}
    STOCKS.forEach(s => {
        if (!map[s.industry]) map[s.industry] = []
        map[s.industry].push(s)
    })
    return map
}

// 获取行业列表及其股票数
export function getIndustrySummary() {
    const map = {}
    STOCKS.forEach(s => {
        if (!map[s.industry]) map[s.industry] = { name: s.industry, count: 0 }
        map[s.industry].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
}

// ==== 支持自定义添加任意代码 ====
const CUSTOM_STOCKS_KEY = 'qm_custom_stocks'

// 启动时初始化：加载本地自定义代码注入主池
try {
    const custom = JSON.parse(localStorage.getItem(CUSTOM_STOCKS_KEY) || '[]')
    for (let i = custom.length - 1; i >= 0; i--) {
        const c = custom[i]
        if (!STOCKS.find(s => s.code === c)) {
            STOCKS.unshift({ code: c, name: '自定义', industry: '自选池' })
        }
    }
} catch (e) { }

// 添加自选股到主池，返回清洗后的代码
export function addCustomStockToPool(code) {
    if (!code) return null
    const cleanCode = code.replace(/\D/g, '')
    if (cleanCode.length !== 6) return null
    if (STOCKS.find(s => s.code === cleanCode)) return cleanCode // 已在池中

    STOCKS.unshift({ code: cleanCode, name: '自定义', industry: '自选池' })
    try {
        const custom = JSON.parse(localStorage.getItem(CUSTOM_STOCKS_KEY) || '[]')
        custom.push(cleanCode)
        localStorage.setItem(CUSTOM_STOCKS_KEY, JSON.stringify(custom))
    } catch (e) { }

    return cleanCode
}
