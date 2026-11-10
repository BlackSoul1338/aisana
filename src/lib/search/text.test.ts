import { describe, expect, it } from 'vitest'
import { normalize, tokenize, hasSignal, hasQuerySignal, matchesStem } from '@/lib/search/text'

describe('normalize', () => {
  it('сохраняет русские буквы', () => {
    expect(normalize('Промышленность')).toBe('промышленность')
  })

  it('не теряет казахские буквы (регрессия C5)', () => {
    // Раньше класс [а-я] выбрасывал ә ғ қ ң ө ұ ү һ і — казахский запрос
    // находил пустоту, и казахское описание не классифицировалось
    expect(normalize('білім')).toBe('білім')
    expect(normalize('қазақстан')).toBe('қазақстан')
    expect(normalize('өнер')).toBe('өнер')
    expect(normalize('ә ғ қ ң ө ұ ү һ і')).toBe('ә ғ қ ң ө ұ ү һ і')
  })

  it('заменяет ё на е', () => {
    expect(normalize('ёжик')).toBe('ежик')
  })

  it('оставляет цифры и латиницу, убирает пунктуацию', () => {
    expect(normalize('Hello, World! 2024')).toBe('hello world 2024')
  })

  it('пустая строка и null', () => {
    expect(normalize('')).toBe('')
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

describe('tokenize', () => {
  it('разбивает на слова', () => {
    expect(tokenize('Контроль качества сварки')).toEqual(['контроль', 'качества', 'сварки'])
  })

  it('отбрасывает русские стоп-слова', () => {
    expect(tokenize('сварка на производстве')).not.toContain('на')
  })

  it('отбрасывает казахские стоп-слова (регрессия C5)', () => {
    expect(tokenize('жасанды интеллект үшін платформа')).not.toContain('үшін')
    expect(tokenize('жасанды интеллект үшін платформа')).toContain('интеллект')
  })

  it('отбрасывает слова короче двух символов', () => {
    expect(tokenize('а б в')).toEqual([])
  })
})

describe('matchesStem', () => {
  it('ищет основу в начале слова', () => {
    expect(matchesStem('заводы', 'завод')).toBe(true)
    expect(matchesStem('производства', 'производств')).toBe(true)
  })

  it('короткие основы (две буквы) требуют полного совпадения', () => {
    // Проверка ровно для основ короче трёх букв: они цепляли бы
    // половину словаря, поэтому ищутся целиком
    expect(matchesStem('гм', 'гм')).toBe(true)
    expect(matchesStem('гмк', 'гм')).toBe(false)
  })
})

describe('hasSignal — слова', () => {
  it('находит слово по основе', () => {
    expect(hasSignal(normalize('сварка швов'), tokenize('сварка швов'), 'сварк')).toBe(true)
    expect(hasSignal(normalize('сварочные работы'), tokenize('сварочные работы'), 'сварочн')).toBe(true)
  })

  it('не находит чужое слово', () => {
    expect(hasSignal(normalize('строительство домов'), tokenize('строительство домов'), 'сварк')).toBe(false)
  })
})

describe('hasSignal — фразы (регрессия C6)', () => {
  // Фразы в справочнике записаны усечёнными основами. Раньше они искались
  // подстрокой и не срабатывали никогда: 158 из 233 признаков были мертвы.
  it('совпадает по основам, а не подстроке', () => {
    const text = normalize('Обслуживание оборудования на предприятии')
    expect(hasSignal(text, tokenize(text), 'обслуживан оборудован')).toBe(true)
  })

  it('находит несколько усечённых фраз подряд', () => {
    const text = normalize('Диагностика заболеваний. Средства индивидуальной защиты. Опасности производства.')
    expect(hasSignal(text, tokenize(text), 'диагностик заболеван')).toBe(true)
    expect(hasSignal(text, tokenize(text), 'средств индивидуальн защит')).toBe(true)
    expect(hasSignal(text, tokenize(text), 'опасн производств')).toBe(true)
  })

  it('находит фразу, записанную полной формой', () => {
    const text = normalize('Контроль качества сварки')
    expect(hasSignal(text, tokenize(text), 'контроль качества')).toBe(true)
  })

  it('не срабатывает на чужую фразу', () => {
    const text = normalize('Строительство жилых домов')
    expect(hasSignal(text, tokenize(text), 'взрывн работ')).toBe(false)
  })

  it('требует соседних слов', () => {
    const text = normalize('взрывные работы на шахте')
    expect(hasSignal(text, tokenize(text), 'взрывн работ')).toBe(true)
    // «работы» и «взрывные» не рядом — фраза не должна совпадать
    const separated = normalize('работы взрывные на шахте')
    expect(hasSignal(separated, tokenize(separated), 'взрывн работ')).toBe(false)
  })
})

describe('hasQuerySignal', () => {
  it('мягко совпадает, когда слово запроса короче основы', () => {
    const text = normalize('mining company')
    expect(hasQuerySignal(text, tokenize(text), 'mining')).toBe(true)
  })

  it('находит фразу с усечёнными основами', () => {
    const text = normalize('взрывные работы')
    expect(hasQuerySignal(text, tokenize(text), 'взрывн работ')).toBe(true)
  })
})
