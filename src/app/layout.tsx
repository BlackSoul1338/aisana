import type { Metadata } from 'next'
import { getSiteUrl, SITE_NAME } from '@/lib/seo'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'
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
        {/* Тема и перенос старого выбора языка из localStorage в cookie —
            до первой отрисовки, чтобы страница не мигала */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme');var q=window.matchMedia('(prefers-color-scheme: dark)');var d=m==='dark'||((!m||m==='system')&&q.matches);document.documentElement.classList.toggle('dark',d);q.addEventListener('change',function(){var cur=localStorage.getItem('theme');if(!cur||cur==='system')document.documentElement.classList.toggle('dark',q.matches)});var l=localStorage.getItem('lang');if((l==='kz'||l==='ru')&&!/(?:^|;\\s*)lang=/.test(document.cookie)){document.cookie='lang='+l+'; path=/; max-age=31536000; samesite=lax';document.documentElement.lang=l==='kz'?'kk':'ru'}}catch(e){}})()`,
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
