import type { Metadata } from 'next'
import { getSiteUrl, SITE_NAME } from '@/lib/seo'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { LangProvider } from '@/context/LangContext'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' })

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang()
  const title = t('meta', 'title', lang)
  const description = t('meta', 'description', lang)
  const ogDescription = t('meta', 'ogDescription', lang)
  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: title,
      template: '%s — AiSana',
    },
    description,
    keywords: lang === 'kz'
      ? ['AiSana', 'ЖИ', 'университеттер', 'Қазақстан', 'жасанды интеллект']
      : ['AiSana', 'ИИ', 'университеты', 'Казахстан', 'искусственный интеллект'],
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: lang === 'kz' ? 'kk_KZ' : 'ru_RU',
      title,
      description: ogDescription,
      // Превью ссылки в WhatsApp, Telegram и соцсетях
      images: [{
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: t('meta', 'ogAlt', lang),
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: ['/images/og-image.png'],
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Язык — из cookie: <html lang> и первый рендер должны совпасть с выбором пользователя
  const lang = await getRequestLang()
  return (
    <html lang={lang === 'kz' ? 'kk' : 'ru'} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Перенос старого выбора языка из localStorage в cookie — до первой
            отрисовки, чтобы страница не мигала. Скрипт темы добавится в PR темы. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('lang');if((l==='kz'||l==='ru')&&!/(?:^|;\\s*)lang=/.test(document.cookie)){document.cookie='lang='+l+'; path=/; max-age=31536000; samesite=lax';document.documentElement.lang=l==='kz'?'kk':'ru'}}catch(e){}})()`,
          }}
        />
        <LangProvider initialLang={lang}>
          {children}
          <Toaster />
        </LangProvider>
        <Analytics />
      </body>
    </html>
  )
}
