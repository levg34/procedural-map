import { defineConfig } from 'vite'

const backend = 'http://localhost:3210'

export default defineConfig({
    build: {
        outDir: 'public'
    },
    publicDir: false,
    server: {
        proxy: {
            '/api': backend,
            '/model': backend
        }
    }
})
