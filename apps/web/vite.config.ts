import { defineConfig, loadEnv, lazyPlugins } from 'vite-plus';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/

// This file is outside the Vite import graph, so it can't read
// import.meta.env — load the same .env files Vite itself would for this mode.
const apiProxyURL =
    loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
        .VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export default defineConfig({
    // fetchJson (awsAPI.ts) is now exercised directly by a real unit test
    // rather than only through mocked hooks, so the module's top-level
    // `VITE_API_BASE_URL` guard needs something to read in test mode too.
    test: { globals: true, env: { VITE_API_BASE_URL: 'http://localhost/api' } },
    define: {
        global: {},
    },
    plugins: lazyPlugins(() => [
        react(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: null,
            manifestFilename: 'manifest.json',
            includeAssets: [
                'favicon.ico',
                'favicon-16x16.png',
                'favicon-32x32.png',
                'apple-touch-icon.png',
                'apple-touch-icon-180x180.png',
                'apple-touch-icon-167x167.png',
                'apple-touch-icon-152x152.png',
                'apple-touch-icon-120x120.png',
                'robots.txt',
            ],
            manifest: {
                name: 'Quizaroni',
                short_name: 'Quizaroni',
                description:
                    "Turn any topic into flashcards you'll actually enjoy studying. Create study sets, study with 5 modes and spaced repetition, and share publicly — free forever.",
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait-primary',
                background_color: '#2b2b2b',
                theme_color: '#2b2b2b',
                categories: ['education', 'productivity'],
                icons: [
                    {
                        src: '/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/icon-512x512-maskable.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                screenshots: [
                    {
                        src: '/screenshot-home.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        form_factor: 'wide',
                    },
                    {
                        src: '/screenshot-mobile.png',
                        sizes: '720x1280',
                        type: 'image/png',
                        form_factor: 'narrow',
                    },
                ],
            },
            workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                globPatterns: [
                    '**/*.{js,css,html,ico,png,svg,wasm,json,woff,woff2,ttf,eot}',
                ],
                globIgnores: [
                    '**/splash/**',
                    '**/screenshot-*.png',
                    '**/og-image.png',
                ],
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/, /^\/sitemap\.xml/],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'dicebear-avatars',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
        }),
    ]),
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
            src: path.resolve('src/'),
            views: path.resolve('src/views/'),
            state: path.resolve('src/state/'),
            shared: path.resolve('src/shared/'),
            resources: path.resolve('src/resources/'),
            i18n: path.resolve('src/i18n/'),
            components: path.resolve('src/shared/components/'),
            constants: path.resolve('src/shared/constants/'),
            hooks: path.resolve('src/shared/hooks/'),
            styles: path.resolve('src/shared/styles/'),
            theme: path.resolve('src/shared/theme/'),
            utilities: path.resolve('src/shared/utilities/'),
        },
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-dom/client'],
        // Rolldown's dep optimizer auto-splits @emotion/react / @mui/styled-engine
        // into a shared chunk but drops the cross-chunk init-guard import, causing
        // `init_emotion_react_browser_development_esm is not defined`. Force emotion
        // + mui into one chunk via rolldown's native advancedChunks so the init
        // guards stay in-scope.
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'mui-emotion',
                            test: /[\\/]node_modules[\\/](\.pnpm[\\/])?(@emotion|@mui|hoist-non-react-statics)/,
                        },
                    ],
                },
            },
        },
    },
    server: {
        host: '127.0.0.1',
        proxy: {
            '/api': {
                target: apiProxyURL,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
        port: 3000,
    },
});
