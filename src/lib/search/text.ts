/**
 * Разбор текста для поиска и классификации.
 *
 * Русский язык сильно склоняется: «завод», «заводы», «заводской», «на заводах» —
 * это одно и то же слово для человека, но разные строки для базы. Поэтому
 * словари признаков хранят ОСНОВЫ («завод», «производств»), а совпадение
 * проверяется по началу слова. Это заменяет полноценный стеммер и при этом
 * предсказуемо: видно, какая основа что поймала.
 */

/** Приводит текст к сравнимому виду: нижний регистр, ё→е, все буквы и цифры.
 *
 *  Класс \p{L} покрывает не только русский и латинский, но и казахские
 *  буквы (ә ғ қ ң ө ұ ү һ і) — прежний диапазон «а-я» их выбрасывал,
 *  и казахский запрос не находил ничего.
 */
export function normalize(input: string | null | undefined): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Слова текста без служебных коротышей. */
export function tokenize(input: string | null | undefined): string[] {
  const normalized = normalize(input)
  if (!normalized) return []
  return normalized.split(' ').filter(word => word.length >= 2 && !STOP_WORDS.has(word))
}

const STOP_WORDS = new Set([
  'и', 'в', 'на', 'с', 'по', 'для', 'из', 'к', 'от', 'до', 'за', 'при', 'об', 'о', 'у',
  'же', 'то', 'не', 'но', 'а', 'или', 'что', 'как', 'это', 'все', 'его', 'ее', 'их',
  'the', 'a', 'an', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'with', 'by', 'is', 'are',
  // Казахские служебные слова
  'және', 'бірақ', 'немесе', 'үшін', 'туралы', 'бұл', 'ол', 'мен', 'сен', 'біз',
  'сіз', 'олар', 'қандай', 'қалай', 'неге', 'қашан', 'қайда', 'бар', 'жоқ', 'тек',
  'ғана', 'емес', 'кейін', 'дейін', 'арқылы', 'бойынша',
])

/**
 * Совпадает ли слово с основой из словаря.
 *
 * Основы от трёх букв ищутся по началу слова: «руд» → «руда», «руды», «рудник».
 * Более короткие (двухбуквенные сокращения) должны совпасть целиком, иначе
 * они цепляли бы половину словаря.
 */
export function matchesStem(token: string, stem: string): boolean {
  if (stem.length < 3) return token === stem
  return token.startsWith(stem)
}

/** Есть ли в наборе слов хоть одно с такой основой. */
export function hasStem(tokens: string[], stem: string): boolean {
  return tokens.some(token => matchesStem(token, stem))
}

/**
 * Признак может быть словом («сварк») или фразой («контроль качества»).
 *
 * Фразы в справочнике записаны усечёнными основами («обслуживан оборудован»),
 * а в тексте стоят полные формы («обслуживание оборудования»). Поэтому фразу
 * сравниваем по-словно с проверкой основ, а не подстрокой: иначе подстрока
 * не совпадёт никогда и признак молча перестаёт работать.
 */
export function hasSignal(normalizedText: string, tokens: string[], signal: string): boolean {
  if (!signal.includes(' ')) return hasStem(tokens, signal)
  return hasPhrase(normalizedText, signal)
}

/**
 * Совпадает ли фраза с текстом: слова фразы идут подряд и каждое совпадает
 * со словом текста по основе.
 *
 * lenient — режим для запроса: слово запроса может быть короче основы
 * («mine» против «mining»), поэтому проверяем совпадение в обе стороны.
 */
function hasPhrase(normalizedText: string, phrase: string, lenient = false): boolean {
  const words = phrase.split(' ').filter(Boolean)
  if (words.length === 0) return false

  const textWords = normalizedText.split(' ').filter(Boolean)
  if (textWords.length < words.length) return false

  const wordMatches = (textWord: string, phraseWord: string) => {
    if (matchesStem(textWord, phraseWord)) return true
    return lenient && textWord.length >= 4 && phraseWord.startsWith(textWord)
  }

  for (let i = 0; i + words.length <= textWords.length; i++) {
    let matched = true
    for (let j = 0; j < words.length; j++) {
      if (!wordMatches(textWords[i + j], words[j])) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

/**
 * Есть ли в тексте все слова фразы — в любом порядке и не обязательно рядом.
 * Слова сравниваются целиком, без основ.
 *
 * Для бонуса за «точную фразу» в ранжировании: запрос «контроль качества
 * сварки» засчитывается и когда в тексте проекта слова идут
 * «качества сварки контроль» — порядок в разных предложениях не важен.
 */
export function hasAllWords(text: string, words: string[]): boolean {
  if (words.length === 0) return false
  const textWords = new Set(normalize(text).split(' ').filter(Boolean))
  return words.every(word => textWords.has(word))
}

/**
 * Мягкое сопоставление ДЛЯ ЗАПРОСА: совпадение в обе стороны.
 *
 * В словаре лежит основа «mining», пользователь пишет «mine» — слово короче
 * основы, и обычная проверка «начинается с» его не поймает. Для запроса это
 * допустимо: он короткий и осмысленный. В классификации проектов такое
 * послабление не используется — там оно давало бы ложные срабатывания.
 */
export function hasQuerySignal(normalizedText: string, tokens: string[], signal: string): boolean {
  if (!signal.includes(' ')) {
    return tokens.some(token => {
      if (matchesStem(token, signal)) return true
      return token.length >= 4 && signal.startsWith(token)
    })
  }
  return hasPhrase(normalizedText, signal, true)
}

/** Расстояние Левенштейна с ранним выходом — для опечаток в запросе. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > max) return max + 1
    prev = curr
  }
  return prev[b.length]
}

/** Похожие слова: точное вхождение по началу либо опечатка в 1–2 буквы. */
export function fuzzyMatches(token: string, queryToken: string): boolean {
  if (token.startsWith(queryToken) || queryToken.startsWith(token)) return true
  if (queryToken.length < 5) return false
  return editDistance(token, queryToken, queryToken.length > 7 ? 2 : 1) <= (queryToken.length > 7 ? 2 : 1)
}
