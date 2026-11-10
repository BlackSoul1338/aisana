/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Убираем заголовок X-Powered-By: Next.js — не сообщаем версию стека
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Базовые заголовки безопасности для публичного портала.
        // HSTS включится, когда сайт откроется по https (домен + сертификат).
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // GeoJSON карты меняется только вместе с деплоем — кэшируем надолго,
        // повторные заходы на главную вообще не качают карту заново
        source: '/data/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // /uploads/* намеренно НЕ кэшируем здесь: файлы приватные, отдаёт их
      // роут /uploads/[filename] с проверкой сессии и собственным заголовком
      // Cache-Control: private. Заголовок из next.config.js применился бы
      // раньше роута и выставил приватному файлу public, immutable.
    ]
  },
}

module.exports = nextConfig
