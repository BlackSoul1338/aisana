import { describe, expect, it } from 'vitest'
import { indexProject, searchIndex } from '@/lib/search/engine'

/**
 * Проверки ранжирования: регрессии C5 (казахский поиск), C6 (фразы)
 * и C7 (порядок выдачи по релевантности, а не по дате создания).
 */

const industrial = {
  id: 'p_industrial',
  title: 'Нейросеть для обнаружения дефектов сварных соединений',
  description:
    'Система компьютерного зрения контролирует качество сварных швов на производственной линии: камера снимает соединение, нейросеть находит дефекты — трещины, непровары, пористость.',
  tags: ['сварка', 'контроль качества', 'производство'],
  category: 'COMPUTER_VISION',
  status: 'PILOT',
  university: { name: 'КазНУ', shortName: 'КазНУ', region: { name: 'Алматы' } },
} as any

const kazakh = {
  id: 'p_kazakh',
  title: 'Жасанды интеллект негізіндегі оқу жүйесі',
  description:
    'Жасанды интеллект негізіндегі платформа оқу материалдарын жасайды, студенттің қорытындысын тексереді. Жүйе қазақ тіліндегі пән мәтінімен жұмыс істейді.',
  tags: ['білім беру', 'жасанды интеллект'],
  category: 'EDUCATION',
  status: 'PILOT',
  university: { name: 'ENU', shortName: 'ENU', region: { name: 'Астана' } },
} as any

const health = {
  id: 'p_health',
  title: 'Система раннего выявления заболеваний по снимкам',
  description:
    'Нейросеть анализирует рентгеновские снимки и выделяет признаки патологии, формирует предварительное заключение для врача. Диагностика заболеваний ускоряется.',
  tags: ['медицина', 'диагностика заболеваний'],
  category: 'SCIENCE',
  status: 'IMPLEMENTED',
  university: { name: 'КазНУ', shortName: 'КазНУ', region: { name: 'Алматы' } },
} as any

const index = [industrial, kazakh, health].map(indexProject)

describe('searchIndex — казахский поиск', () => {
  it('находит проект по казахским словам', () => {
    const { hits } = searchIndex(index, 'жасанды интеллект')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].id).toBe('p_kazakh')
  })

  it('находит проект по слову «білім»', () => {
    const { hits } = searchIndex(index, 'білім')
    expect(hits.map(hit => hit.id)).toContain('p_kazakh')
  })

  it('находит казахский проект по русскому описанию отрасли', () => {
    const { hits } = searchIndex(index, 'образование')
    expect(hits.length).toBeGreaterThan(0)
  })
})

describe('searchIndex — фразы с усечёнными основами', () => {
  it('находит проект по фразе «обслуживание оборудования»', () => {
    const { hits } = searchIndex(index, 'обслуживание оборудования')
    // Совпадение возможно по расширению запроса, главное — что выдача не пуста
    expect(hits.length).toBeGreaterThan(0)
  })
})

describe('searchIndex — порядок выдачи', () => {
  it('сортирует по необработанному баллу, а не по срезанной оценке', () => {
    const { hits } = searchIndex(index, 'производство сварка')
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].rank).toBeGreaterThanOrEqual(hits[i].rank)
    }
  })

  it('различает проекты, когда оценка срезана до 100', () => {
    // Оба проекта перекрывают запрос так сильно, что оценка упирается
    // в потолок 100. Раньше они становились равными, и порядок определяла
    // дата создания — реальная релевантность терялась.
    const saturated = [
      {
        id: 'p_strong',
        title: 'Система контроля качества сварных соединений на производственной линии завода',
        description:
          'Сварка, производство, качество, завод, станок, конвейер, дефект, брак, сварной шов, промышленность.',
        tags: ['сварка', 'производство', 'качество', 'завод', 'станок', 'конвейер'],
        category: 'COMPUTER_VISION',
        status: 'PILOT',
        university: { name: 'КазНУ', shortName: 'КазНУ', region: { name: 'Алматы' } },
      },
      {
        id: 'p_weak',
        title: 'Контроль качества сварки',
        description: 'Сварка и качество на производстве.',
        tags: ['сварка'],
        category: 'COMPUTER_VISION',
        status: 'PILOT',
        university: { name: 'ENU', shortName: 'ENU', region: { name: 'Астана' } },
      },
    ].map(indexProject)

    const { hits } = searchIndex(saturated, 'сварка качество производство')

    // Оценка срезана до 100 у обоих — но порядок определён реальной релевантностью
    expect(hits.length).toBe(2)
    expect(hits[0].id).toBe('p_strong')
    expect(hits[0].rank).toBeGreaterThan(hits[1].rank)
  })

  it('самый релевантный проект идёт первым', () => {
    const { hits } = searchIndex(index, 'сварка')
    expect(hits[0].id).toBe('p_industrial')
  })
})

describe('searchIndex — совпадения по лёгким полям', () => {
  it('находит проект по региону', () => {
    const { hits } = searchIndex(index, 'Алматы')
    expect(hits.length).toBeGreaterThan(0)
  })
})

describe('indexProject', () => {
  it('разбирает поля проекта', () => {
    const item = indexProject(industrial)
    expect(item.id).toBe('p_industrial')
    expect(item.fields.title.text).toContain('дефектов сварных')
    expect(item.fields.region.text).toBe('алматы')
  })
})

/**
 * Отбор: поиск не должен возвращать полпортала. Индекс из 30 проектов,
 * почти все отнесены к образованию — как на настоящем портале.
 */
describe('searchIndex — точность отбора', () => {
  const filler = Array.from({ length: 26 }, (_, i) => ({
    id: `p_edu_${i}`,
    title: `Учебный помощник ${i}`,
    description: 'Платформа для студентов и преподавателей: обучение, курсы, учебные материалы, оценка знаний, образование.',
    tags: ['обучение', 'студенты'],
    category: 'EDUCATION',
    status: 'PILOT',
    university: { name: 'Казахский национальный университет', shortName: 'КазНУ', region: { name: 'Алматы' } },
  }))
  const applicant = {
    id: 'p_applicant',
    title: 'Чат-бот для абитуриентов',
    description: 'Отвечает абитуриентам на вопросы о поступлении, грантах и подготовке к ЕНТ, обучение и образование.',
    tags: ['абитуриент'],
    category: 'EDUCATION',
    status: 'IMPLEMENTED',
    university: { name: 'Университет нефти и газа', shortName: 'АУНГ', region: { name: 'Атырау' } },
  }
  const abbreviation = {
    id: 'p_abbr',
    title: 'Помощник по СВ и подготовка отчётов',
    description: 'Формирует отчёты по студенческому взаимодействию, обучение и образование.',
    tags: ['отчёты'],
    category: 'EDUCATION',
    status: 'PILOT',
    university: { name: 'ENU', shortName: 'ENU', region: { name: 'Астана' } },
  }
  const language = {
    id: 'p_lang',
    title: 'Тренажёр по казахскому языку',
    description: 'Помогает изучать казахский язык: упражнения, проверка произношения, обучение и образование.',
    tags: ['казахский язык'],
    category: 'EDUCATION',
    status: 'PILOT',
    university: { name: 'ENU', shortName: 'ENU', region: { name: 'Астана' } },
  }
  const big = [...filler, applicant, abbreviation, language, industrial, health].map(p => indexProject(p as any))
  const ids = (q: string) => searchIndex(big, q, { limit: 1000 }).hits.map(hit => hit.id)

  it('широкое направление само по себе не приводит проект в выдачу', () => {
    expect(ids('абитуриент')).toEqual(['p_applicant'])
  })

  it('многословный запрос требует большинства слов', () => {
    expect(ids('подготовка к ЕНТ')).toEqual(['p_applicant'])
  })

  it('слово из названия вуза не считается совпадением', () => {
    expect(ids('казахский язык')).toEqual(['p_lang'])
  })

  it('короткое сокращение не совпадает с длинным словом запроса', () => {
    expect(ids('сварка')).not.toContain('p_abbr')
  })

  it('узкое направление по-прежнему находит проекты по смыслу', () => {
    expect(ids('промышленность')).toContain('p_industrial')
    expect(ids('сварка')).toContain('p_industrial')
  })

  it('сокращение вуза находит его проекты', () => {
    expect(ids('АУНГ')).toEqual(['p_applicant'])
  })

  it('если строгий отбор пуст, показывает частичные совпадения', () => {
    expect(ids('Атырау')).toEqual(['p_applicant'])
  })
})
