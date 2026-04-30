import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    //port: 3000,
    //host: '0.0.0.0',
    open: true,
    proxy: {
      // 腾讯实时行情 (主要数据源)
      '/api/qq/qt': {
        target: 'https://qt.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qq\/qt/, ''),
        headers: {
          'Referer': 'https://finance.qq.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      // 腾讯K线数据
      '/api/qq/ifzq': {
        target: 'https://web.ifzq.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qq\/ifzq/, ''),
        headers: {
          'Referer': 'https://web.ifzq.gtimg.cn',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      // 东方财富 (保留作为fallback)
      '/api/em/push2his': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/em\/push2his/, ''),
        headers: {
          'Referer': 'https://finance.eastmoney.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      '/api/em/push2': {
        target: 'https://push2delay.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/em\/push2/, ''),
        headers: {
          'Referer': 'https://quote.eastmoney.com',
          'Origin': 'https://quote.eastmoney.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    },
  },
})
