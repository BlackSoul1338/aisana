'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Map, FolderKanban, Star, LayoutDashboard, Settings, Building2, Sparkles, Menu, X } from 'lucide-react'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { useLang } from '@/context/LangContext'

export function Navbar() {
  const { t } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)
  // Логотип: положите файл в public/images/logo.png.
  // Пока файла нет (или он не загрузился) — показывается запасной значок,
  // шапка не «ломается» пустой картинкой.
  const [logoFailed, setLogoFailed] = useState(false)

  // Скролл колёсиком листает навигацию, а не страницу: иначе при наведении на
  // шапку вертикальный скролл дёргает страницу вниз-вверх. React вешает wheel
  // как passive, поэтому preventDefault не сработает — вешаем свой { passive: false }.
  // Пока навигация помещается — страница листается как обычно.
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return
      event.preventDefault()
      el.scrollLeft += Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Роль нужна, чтобы не показывать разделы, куда пользователя всё равно не пустят.
  // Это только удобство интерфейса — доступ проверяется на сервере.
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/me')
      .then(res => (res.ok ? res.json() : { user: null }))
      .then(data => { if (active) setRole(data?.user?.role ?? null) })
      .catch(() => { if (active) setRole(null) })
    return () => { active = false }
  }, [])

  const signedIn = role !== null
  const isStaff = role === 'ADMIN' || role === 'EDITOR'

  const navLinks = [
    { href: '/',               label: t('nav', 'map'),          icon: Map,            show: true },
    { href: '/dashboard',      label: t('nav', 'dashboard'),    icon: LayoutDashboard, show: signedIn },
    { href: '/universities',   label: t('nav', 'universities'), icon: Building2,      show: signedIn },
    { href: '/projects',       label: t('nav', 'projects'),     icon: FolderKanban,   show: signedIn },
    { href: '/best-practices', label: t('nav', 'bestProjects'), icon: Star,           show: isStaff },
  ].filter(link => link.show)

  return (
    <header className="gov-header border-b border-white/10 z-30 relative">
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {logoFailed ? (
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <Sparkles size={16} className="text-[#F5A623]" />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/images/logo.png"
              alt="AiSana"
              onError={() => setLogoFailed(true)}
              className="h-8 w-auto max-w-[140px] object-contain shrink-0"
            />
          )}
          <div className="hidden md:block">
            <p className="text-white font-semibold text-sm leading-tight">AiSana</p>
            <p className="text-white/50 text-[10px] leading-tight">{t('nav', 'tagline')}</p>
          </div>
        </Link>

        <div className="hidden lg:block h-6 w-px bg-white/10" />

        {/* Navigation: на узких экранах листается колесом мыши, скроллбар скрыт */}
        <nav ref={navRef} className="nav-scroll hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm whitespace-nowrap"
            >
              <Icon size={14} className="shrink-0" />
              <span>{label}</span>
            </Link>
          ))}

          {/* ИИ-поиск: только администраторы и редакторы портала */}
          {isStaff && (
            <Link
              href="/ai-search"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-300/80 hover:text-amber-300 hover:bg-white/10 transition-all text-sm whitespace-nowrap border border-amber-400/20 ml-1"
            >
              <Sparkles size={14} className="shrink-0" />
              <span>{t('nav', 'aiSearch')}</span>
            </Link>
          )}
        </nav>

        {/* Переключатели языка и темы */}
        <LangSwitcher />
        <ThemeSwitcher />

        {/* Админ-панель для вошедших, иначе — приглашение войти */}
        <Link
          href={role === 'BUSINESS' ? '/business' : signedIn ? '/admin' : '/login'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm shrink-0"
        >
          <Settings size={14} />
          <span className="hidden md:block">{role === 'BUSINESS' ? 'Кабинет партнёра' : t('nav', 'admin')}</span>
        </Link>

        {/* Бургер (мобильные) */}
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label={menuOpen ? t('nav', 'menuClose') : t('nav', 'menuOpen')}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Мобильное меню */}
      {menuOpen && (
        <nav className="lg:hidden absolute top-14 inset-x-0 gov-header border-b border-white/10 shadow-xl z-40 p-3 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </Link>
          ))}
          {isStaff && (
            <Link
              href="/ai-search"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-amber-300/90 hover:text-amber-300 hover:bg-white/10 transition-all text-sm border border-amber-400/20"
            >
              <Sparkles size={15} className="shrink-0" />
              {t('nav', 'aiSearch')}
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
