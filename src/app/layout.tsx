import type { Metadata } from 'next'
import { getSiteUrl, SITE_NAME } from '@/lib/seo'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { LangProvider } from '@/context/LangContext'
import { Analytics } from '@vercel/analytics/next'

// Шрифт лежит в репозитории, а не тянется с Google Fonts при сборке:
// сборка в закрытом контуре (и в podman) иначе падает по таймауту.
// Файл — subset Inter (latin + cyrillic, включая ә ғ қ ң ө ұ ү һ і).
const inter = localFont({
  src: './fonts/inter-var.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'AiSana — карта ИИ-решений ВУЗов Казахстана',
    template: '%s — AiSana',
  },
  description: 'Единый портал мониторинга и анализа ИИ-проектов университетов Казахстана',
  keywords: ['AiSana', 'ИИ', 'университеты', 'Казахстан', 'искусственный интеллект'],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    title: 'AiSana — карта ИИ-решений ВУЗов Казахстана',
    description: 'Единый портал мониторинга и анализа ИИ-проектов университетов Казахстана',
    // Превью ссылки в WhatsApp, Telegram и соцсетях
    images: [{
      url: '/images/og-image.png',
      width: 1200,
      height: 630,
      alt: 'AiSana — национальная карта ИИ-решений вузов Казахстана',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AiSana — карта ИИ-решений ВУЗов Казахстана',
    description: 'Единый портал мониторинга и анализа ИИ-проектов университетов Казахстана',
    images: ['/images/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <LangProvider>
          {children}
          <Toaster />
        </LangProvider>
        <Analytics />
      </body>
    </html>
  )
}
