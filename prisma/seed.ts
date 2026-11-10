import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding required data (regions, technologies, admin)...')

  // ── Technologies ─────────────────────────────────────────
  // Обобщённые группы — должны совпадать с TECH_ALIASES в src/lib/project-import.ts
  const techGroups = [
    { name: 'Генеративный ИИ (LLM)', slug: 'gen-ai' },
    { name: 'Машинное обучение',     slug: 'machine-learning' },
    { name: 'Компьютерное зрение',   slug: 'computer-vision' },
    { name: 'NLP',                   slug: 'nlp' },
    { name: 'RAG и векторный поиск', slug: 'rag' },
    { name: 'Чат-боты',              slug: 'chatbots' },
    { name: 'Другое',                slug: 'other' },
  ]
  await Promise.all(
    techGroups.map(({ name, slug }) =>
      prisma.technology.upsert({
        where: { slug },
        update: { name },
        create: { name, slug },
      })
    )
  )
  console.log(`✅ Technologies: ${techGroups.length}`)

  // ── Regions ───────────────────────────────────────────────
  const regionsData = [
    { name: 'Астана',                          nameKz: 'Астана',                        code: 'AST', center: '51.1801,71.4460' },
    { name: 'Алматы',                          nameKz: 'Алматы',                        code: 'ALA', center: '43.2220,76.8512' },
    { name: 'Алматинская область',             nameKz: 'Алматы облысы',                 code: 'ALM', center: '44.0000,77.0000' },
    { name: 'Акмолинская область',             nameKz: 'Ақмола облысы',                 code: 'AKM', center: '51.7167,69.3833' },
    { name: 'Актюбинская область',             nameKz: 'Ақтөбе облысы',                 code: 'AKT', center: '50.2839,57.1669' },
    { name: 'Атырауская область',              nameKz: 'Атырау облысы',                 code: 'ATY', center: '47.0945,51.9236' },
    { name: 'Восточно-Казахстанская область',  nameKz: 'Шығыс Қазақстан облысы',       code: 'VKO', center: '49.9714,82.6059' },
    { name: 'Жамбылская область',              nameKz: 'Жамбыл облысы',                 code: 'ZHM', center: '42.9000,71.3667' },
    { name: 'Западно-Казахстанская область',   nameKz: 'Батыс Қазақстан облысы',       code: 'ZKO', center: '51.2333,51.3667' },
    { name: 'Карагандинская область',          nameKz: 'Қарағанды облысы',              code: 'KAR', center: '49.8028,73.1028' },
    { name: 'Костанайская область',            nameKz: 'Қостанай облысы',               code: 'KST', center: '53.2144,63.6196' },
    { name: 'Кызылординская область',          nameKz: 'Қызылорда облысы',              code: 'KZL', center: '44.8479,65.5093' },
    { name: 'Мангистауская область',           nameKz: 'Маңғыстау облысы',              code: 'MAN', center: '43.6667,51.1833' },
    { name: 'Павлодарская область',            nameKz: 'Павлодар облысы',               code: 'PAV', center: '52.2873,76.9674' },
    { name: 'Северо-Казахстанская область',    nameKz: 'Солтүстік Қазақстан облысы',   code: 'SKO', center: '54.8667,69.1333' },
    { name: 'Туркестанская область',           nameKz: 'Түркістан облысы',              code: 'TUR', center: '42.3000,68.2667' },
    { name: 'Шымкент',                         nameKz: 'Шымкент',                       code: 'SHY', center: '42.3000,69.5967' },
    { name: 'Абайская область',                nameKz: 'Абай облысы',                   code: 'ABA', center: '49.9714,80.2000' },
    { name: 'Жетысуская область',              nameKz: 'Жетісу облысы',                 code: 'ZHT', center: '44.5000,78.5000' },
    { name: 'Улытауская область',              nameKz: 'Ұлытау облысы',                 code: 'ULY', center: '48.0000,66.0000' },
  ]

  await Promise.all(
    regionsData.map(r =>
      prisma.region.upsert({
        where: { code: r.code },
        update: {},
        create: r,
      })
    )
  )
  console.log(`✅ Regions: ${regionsData.length}`)

  // ── Admin user ────────────────────────────────────────────
  // Only create if no admin exists at all
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  })

  if (!existingAdmin) {
    // Пароль админа берём из ADMIN_PASSWORD. Если переменной нет — генерируем
    // случайный и печатаем его в лог: дефолтный пароль в репозитории — это
    // готовый вход в админку для всех, кто склонирует проект.
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url')
    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email: 'admin@mnvo.kz',
        name: 'Администратор МНВО',
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
    })
    console.log('✅ Admin created: admin@mnvo.kz')
    if (process.env.ADMIN_PASSWORD) {
      console.log('   Пароль взят из ADMIN_PASSWORD')
    } else {
      console.log(`   Пароль (сохраните его): ${password}`)
    }
  } else {
    console.log(`✅ Admin already exists: ${existingAdmin.email}`)
  }

  console.log('\n🎉 Seed complete — ваши данные не тронуты.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
