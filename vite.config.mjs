import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        proxy: {
            '/road': 'http://localhost:3210',
            '/model': 'http://localhost:3210'
        }
    }
})
