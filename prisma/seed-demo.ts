/**
 * ДЕМО-СИД ДЛЯ ЛОКАЛЬНОГО СТЕНДА.
 *
 * Основной prisma/seed.ts создаёт только справочные данные (регионы,
 * технологии, админа) — в боевой базе он не должен создавать вузы и проекты.
 * Этот скрипт — отдельный и запускается вручную:
 *
 *   npm run db:seed:demo
 *
 * Данные помечены префиксом «ДЕМО» и имеют фиксированные id, поэтому скрипт
 * можно запускать повторно: записи обновляются, а не дублируются.
 * Удалить их можно одним запросом:
 *
 *   DELETE FROM projects WHERE id LIKE 'demo_%';
 *   DELETE FROM universities WHERE id LIKE 'demo_%';
 */

import { PrismaClient, ProjectCategory, ProjectStatus, PublicationStatus, UniversityType, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/** Тестовые учётки. Пароль — из DEMO_PASSWORD, иначе фиксированный демо-пароль. */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo12345'

const UNIVERSITIES = [
  {
    id: 'demo_uni_kaznau',
    name: 'Казахский национальный университет им. аль-Фараби',
    nameKz: 'Қазақ Ұлттық Университеті',
    shortName: 'КазНУ',
    regionCode: 'ALA',
    type: UniversityType.NATIONAL,
    address: 'пр. Сатпаева, 94, Алматы',
    website: 'https://www.kaznu.kz',
    email: 'info@kaznu.kz',
    phone: '+7 727 239 71 00',
    rector: 'Профессор А. Ж. Сарсенов',
    description: 'Крупнейший многопрофильный вуз Казахстана, основан в 1934 году.',
  },
  {
    id: 'demo_uni_satbayev',
    name: 'Казахский национальный исследовательский технический университет им. К. Сатпаева',
    nameKz: 'Қ. Сәтбаев атындағы ҚазҰлттық Техникалық Университеті',
    shortName: 'SATU',
    regionCode: 'ALA',
    type: UniversityType.NATIONAL,
    address: 'пр. Сатпаева, 22, Алматы',
    website: 'https://satbayev.university',
    email: 'info@satbayev.university',
    phone: '+7 727 272 58 41',
    rector: 'Профессор М. К. Койшигулов',
    description: 'Технический вуз: машиностроение, энергетика, информационные технологии.',
  },
  {
    id: 'demo_uni_enu',
    name: 'Евразийский национальный университет им. Л. Н. Гумилёва',
    nameKz: 'Л. Н. Гумилёв атындағы Евразиялық Ұлттық Университеті',
    shortName: 'ENU',
    regionCode: 'AST',
    type: UniversityType.NATIONAL,
    address: 'ул. Сатпаева 8, Астана',
    website: 'https://enu.kz',
    email: 'info@enu.kz',
    phone: '+7 7172 70 90 90',
    rector: 'Профессор С. А. Жумабаев',
    description: 'Первый вуз Независимого Казахстана, гуманитарный и естественно-научный профиль.',
  },
  {
    id: 'demo_uni_kbtu',
    name: 'Карагандинский государственный технический университет им. Т. Қарыгулова',
    nameKz: 'Т. Қарығұлов атындағы Қарағанды Мемлекеттік Техникалық Университеті',
    shortName: 'KBTU',
    regionCode: 'KAR',
    type: UniversityType.STATE,
    address: 'ул. Университетская, 22, Караганда',
    website: 'https://karuniversity.kz',
    email: 'info@karuniversity.kz',
    phone: '+7 7212 56 15 61',
    rector: 'Доцент А. А. Суюнов',
    description: 'Технический вуз с сильной горной и металлургической школой.',
  },
  {
    id: 'demo_uni_ainu',
    name: 'Атырауский институт нефти и газа имени К. С. Сатпаева',
    nameKz: 'К. С. Сәтбаев атындағы Атырау мұнай және газ институты',
    shortName: 'AIMG',
    regionCode: 'ATY',
    type: UniversityType.RESEARCH,
    address: 'мкр. Сауран, 3, Атырау',
    website: 'https://ainu.edu.kz',
    email: 'info@ainu.edu.kz',
    phone: '+7 7122 36 87 04',
    rector: 'Профессор Н. Қ. Ибраев',
    description: 'Профильный нефтегазовый вуз: добыча, переработка, цифровые месторождения.',
  },
]

const PROJECTS = [
  {
    id: 'demo_prj_weld',
    title: 'Нейросеть для обнаружения дефектов сварных соединений',
    description:
      'Система компьютерного зрения контролирует качество сварных швов на производственной линии: камера снимает соединение в реальном времени, нейросеть находит дефекты — трещины, непровары, пористость. Оператор получает сигнал с указанием места дефекта, статистика появляется в единой системе отчётности.',
    universityId: 'demo_uni_kaznau',
    leadName: 'Айдана Сериккызы',
    leadEmail: 'a.serikkyzy@demo.kz',
    teamSize: 7,
    category: ProjectCategory.COMPUTER_VISION,
    status: ProjectStatus.PILOT,
    techSlugs: ['computer-vision', 'machine-learning'],
    tags: ['сварка', 'контроль качества', 'производство', 'компьютерное зрение'],
    impact: 'Снижение брака на сварочном участке, сокращение ручного контроля.',
    results: 'Пилот на двух линиях: пропуски дефектов снизились втрое.',
    isBestPractice: true,
    isScalable: false,
  },
  {
    id: 'demo_prj_mining',
    title: 'Предиктивная диагностика горного оборудования',
    description:
      'Датчики вибрации и температуры с автобуса горного оборудования передают данные в цифровой двойк. Модель машинного обучения предсказывает отказ насоса и дробилки заранее, планируется техническое обслуживание без аварийных остановок.',
    universityId: 'demo_uni_kbtu',
    leadName: 'Ерлан Ахметов',
    leadEmail: 'e.akhmetov@demo.kz',
    teamSize: 9,
    category: ProjectCategory.ANALYTICS,
    status: ProjectStatus.IMPLEMENTED,
    techSlugs: ['machine-learning', 'other'],
    tags: ['горнодобыча', 'предиктивное обслуживание', 'датчики', 'цифровой двойник'],
    impact: 'Меньше внеплановых простоев оборудования на руднике.',
    results: 'Прогноз отказа насоса за 12 часов, обслуживание по графику.',
    isBestPractice: false,
    isScalable: true,
  },
  {
    id: 'demo_prj_hr',
    title: 'ИИ-ассистент для подбора персонала',
    description:
      'Система автоматически ранжирует резюме по компетенциям вакансии, формирует вопросы для собеседования и ведёт базу знаний о сотрудниках. Подбор перестал зависеть от первого впечатления рекрутера.',
    universityId: 'demo_uni_satbayev',
    leadName: 'Мадина Оспанова',
    leadEmail: 'm.ospanova@demo.kz',
    teamSize: 5,
    category: ProjectCategory.MANAGEMENT,
    status: ProjectStatus.IMPLEMENTED,
    techSlugs: ['nlp', 'gen-ai'],
    tags: ['подбор персонала', 'hr', 'рекрутинг', 'автоматизация'],
    impact: 'Сокращение времени подбора, меньше субъективных отказов.',
    results: 'Время отклика сократилось с 9 до 3 дней.',
    isBestPractice: true,
    isScalable: true,
  },
  {
    id: 'demo_prj_edu_kz',
    title: 'Жасанды интеллект негізіндегі оқу жүйесі',
    description:
      'Жасанды интеллект негізіндегі платформа үшін жаңа тарип бойынша оқу материалдарын жасайды, студенттің қорытындысын тексереді және оқу жоспарын бейімдейді. Жүйе қазақ тіліндегі пән мәтінімен жұмыс істейді.',
    universityId: 'demo_uni_enu',
    leadName: 'Айгерим Токтаркызы',
    leadEmail: 'a.toktar@demo.kz',
    teamSize: 6,
    category: ProjectCategory.EDUCATION,
    status: ProjectStatus.PILOT,
    techSlugs: ['gen-ai', 'nlp'],
    tags: ['білім беру', 'жасанды интеллект', 'оқу жүйесі', 'қазақ тілі'],
    impact: 'Студенттердің үйрену нәтижесі жақсарды, оқытушы уақыты босалды.',
    results: 'Пилот на 3 потоках, доля выполненных заданий выросла на 18%.',
    isBestPractice: false,
    isScalable: false,
  },
  {
    id: 'demo_prj_health',
    title: 'Система раннего выявления заболеваний по снимкам',
    description:
      'Нейросеть анализирует рентгеновские снимки и выделяет признаки патологии, формирует предварительное заключение для врача. Диагностика заболеваний ускоряется, а нагрузка на врача снижается.',
    universityId: 'demo_uni_kaznau',
    leadName: 'Санжар Кайратқызы',
    leadEmail: 's.kairat@demo.kz',
    teamSize: 8,
    category: ProjectCategory.SCIENCE,
    status: ProjectStatus.IMPLEMENTED,
    techSlugs: ['computer-vision', 'machine-learning'],
    tags: ['медицина', 'диагностика заболеваний', 'рентген', 'здравоохранение'],
    impact: 'Ранняя диагностика, снижение нагрузки на врачебный персонал.',
    results: 'Чувствительность модели на валидации — 91%.',
    isBestPractice: true,
    isScalable: false,
  },
  {
    id: 'demo_prj_energy',
    title: 'Оптимизация режима работы солнечной электростанции',
    description:
      'Модель прогнозирует выработку солнечной станции по погоде и подбирает режимы работы турбин и инверторов. Избыточная выработка и потери на сетке снижаются.',
    universityId: 'demo_uni_ainu',
    leadName: 'Нурлан Беков',
    leadEmail: 'n.bekov@demo.kz',
    teamSize: 4,
    category: ProjectCategory.ANALYTICS,
    status: ProjectStatus.SCALED,
    techSlugs: ['machine-learning'],
    tags: ['энергетика', 'возобновляемая энергия', 'оптимизация', 'солнечная станция'],
    impact: 'Рост выработки на 6% без дополнительного оборудования.',
    results: 'Тиражировано на 4 станциях суммарной мощностью 80 МВт.',
    isBestPractice: false,
    isScalable: true,
  },
  {
    id: 'demo_prj_draft',
    title: 'ДЕМО: черновик, ждущий проверки',
    description:
      'Черновик проекта, созданный представителем вуза. Не должен быть виден в публичной выдаче, реестре и карте — пока модератор не подтвердит публикацию.',
    universityId: 'demo_uni_enu',
    leadName: 'Тимур Аргынбаев',
    leadEmail: 't.argynbayev@demo.kz',
    teamSize: 3,
    category: ProjectCategory.MANAGEMENT,
    status: ProjectStatus.IDEA,
    techSlugs: ['gen-ai'],
    tags: ['черновик', 'проверка', 'демо'],
    impact: 'Проверка модерации: черновик не должен попасть в публичную часть.',
    results: '—',
    isBestPractice: false,
    isScalable: false,
    publication: PublicationStatus.DRAFT,
  },
]

async function main() {
  console.log('🌾 ДЕМО-СИД: вузы, проекты и тестовые учётки\n')

  // ── Регионы ───────────────────────────────────────────────
  const regions = await prisma.region.findMany()
  if (regions.length === 0) {
    console.error('❌ Регионов нет — сначала запустите обычный сид: npm run db:seed')
    process.exit(1)
  }
  const regionByCode = new Map(regions.map(r => [r.code, r.id]))

  // ── Вузы ──────────────────────────────────────────────────
  for (const u of UNIVERSITIES) {
    const regionId = regionByCode.get(u.regionCode)
    if (!regionId) {
      console.warn(`⚠️  Регион ${u.regionCode} не найден — пропускаем ${u.shortName}`)
      continue
    }
    await prisma.university.upsert({
      where: { id: u.id },
      update: {
        name: u.name, nameKz: u.nameKz, shortName: u.shortName, regionId,
        type: u.type, address: u.address, website: u.website, email: u.email,
        phone: u.phone, rector: u.rector, description: u.description,
      },
      create: {
        id: u.id,
        name: u.name, nameKz: u.nameKz, shortName: u.shortName, regionId,
        type: u.type, address: u.address, website: u.website, email: u.email,
        phone: u.phone, rector: u.rector, description: u.description,
      },
    })
  }
  console.log(`✅ Вузы: ${UNIVERSITIES.length}`)

  // ── Технологии ────────────────────────────────────────────
  const technologies = await prisma.technology.findMany()
  const techBySlug = new Map(technologies.map(t => [t.slug, t.id]))
  const missing = new Set(PROJECTS.flatMap(p => p.techSlugs).filter(slug => !techBySlug.has(slug)))
  if (missing.size > 0) {
    console.warn(`⚠️  Нет таких технологий в справочнике: ${[...missing].join(', ')}`)
  }

  // ── Проекты ───────────────────────────────────────────────
  for (const p of PROJECTS) {
    const technologyIds = p.techSlugs.map(slug => techBySlug.get(slug)).filter((id): id is string => Boolean(id))
    const publication = p.publication ?? PublicationStatus.PUBLISHED
    const data = {
      title: p.title,
      description: p.description,
      universityId: p.universityId,
      leadName: p.leadName,
      leadEmail: p.leadEmail,
      teamSize: p.teamSize,
      category: p.category,
      status: p.status,
      tags: p.tags,
      impact: p.impact,
      results: p.results,
      isBestPractice: p.isBestPractice,
      isScalable: p.isScalable,
      publication,
      publishedAt: publication === PublicationStatus.PUBLISHED ? new Date() : null,
    }

    await prisma.project.upsert({
      where: { id: p.id },
      update: { ...data, technologies: { set: technologyIds.map(id => ({ id })) } },
      create: { id: p.id, ...data, technologies: { connect: technologyIds.map(id => ({ id })) } },
    })
  }
  console.log(`✅ Проекты: ${PROJECTS.length}`)

  // ── Тестовые учётки ───────────────────────────────────────
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10)
  const users = [
    { email: 'demo-admin@demo.kz', name: 'ДЕМО Администратор', role: UserRole.ADMIN },
    { email: 'demo-editor@demo.kz', name: 'ДЕМО Редактор', role: UserRole.EDITOR },
    { email: 'demo-rep@demo.kz', name: 'ДЕМО Представитель вуза', role: UserRole.UNIVERSITY_REP, universityId: 'demo_uni_enu' },
    { email: 'demo-viewer@demo.kz', name: 'ДЕМО Наблюдатель', role: UserRole.VIEWER },
  ]
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, universityId: u.universityId ?? null, password: hashed },
      create: { email: u.email, name: u.name, role: u.role, universityId: u.universityId ?? null, password: hashed },
    })
  }
  console.log(`✅ Учётки: ${users.length}`)

  console.log('\n🎉 Демо-данные готовы.')
  console.log(`   Пароль всех демо-учёток: ${DEMO_PASSWORD}`)
  console.log('   Учётки: demo-admin@demo.kz, demo-editor@demo.kz, demo-rep@demo.kz, demo-viewer@demo.kz')
  console.log('\n   После сида нажмите в админке «Пересчитать направления»,')
  console.log('   чтобы проекты получили тематические направления.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
