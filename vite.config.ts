import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        outDir: 'public'
    },
    publicDir: false,
    server: {
        proxy: {
            '/road': 'http://localhost:3210',
            '/model': 'http://localhost:3210',
            '/traffic_vehicles': 'http://localhost:3210'
        }
    }
})
