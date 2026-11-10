/**
 * Проверка фиксов поиска (C5, C6) — запуск без БД и без сети:
 *   npx tsx scripts/check-search-text.ts
 */
import { normalize, tokenize, hasSignal, hasQuerySignal } from '../src/lib/search/text'

let failed = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? '✅' : '❌'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ` (ожидалось ${JSON.stringify(expected)})`}`)
}

// ── C5: казахские буквы не теряются ─────────────────────────
check('normalize("білім")', normalize('білім'), 'білім')
check('normalize("қазақстан")', normalize('қазақстан'), 'қазақстан')
check('normalize("өнер")', normalize('өнер'), 'өнер')
check('normalize("ә ғ қ ң ө ұ ү һ і")', normalize('ә ғ қ ң ө ұ ү һ і'), 'ә ғ қ ң ө ұ ү һ і')
check('normalize не теряет эмодзи-разделители', normalize('Hello, World! 2024'), 'hello world 2024')
check('normalize("ёжик")', normalize('ёжик'), 'ежик')

// ── токенизация с казахскими стоп-словами ────────────────────
check('tokenize отбрасывает "үшін"', tokenize('жасанды интеллект үшін платформа').includes('үшін'), false)
check('tokenize сохраняет "интеллект"', tokenize('жасанды интеллект үшін платформа').includes('интеллект'), true)

// ── C6: фразы с усечёнными основами наконец работают ─────────
const full = normalize('Обслуживание оборудования на предприятии')
check('фраза "обслуживан оборудован"', hasSignal(full, tokenize(full), 'обслуживан оборудован'), true)

const diag = normalize('Диагностика заболеваний. Средства индивидуальной защиты. Опасности производства.')
check('фраза "диагностик заболеван"', hasSignal(diag, tokenize(diag), 'диагностик заболеван'), true)
check('фраза "средств индивидуальн защит"', hasSignal(diag, tokenize(diag), 'средств индивидуальн защит'), true)
check('фраза "опасн производств"', hasSignal(diag, tokenize(diag), 'опасн производств'), true)

const expl = normalize('Взрывные работы на шахте')
check('фраза "взрывн работ"', hasSignal(expl, tokenize(expl), 'взрывн работ'), true)

const fullForm = normalize('Контроль качества сварки')
check('полная форма "контроль качества"', hasSignal(fullForm, tokenize(fullForm), 'контроль качества'), true)

const noMatch = normalize('Строительство жилых домов')
check('чужая фраза не срабатывает', hasSignal(noMatch, tokenize(noMatch), 'взрывн работ'), false)

// ── запрос: мягкое совпадение ────────────────────────────────
const q = normalize('взрывные работы')
check('hasQuerySignal("взрывн работ")', hasQuerySignal(q, tokenize(q), 'взрывн работ'), true)

console.log(failed === 0 ? '\n🎉 Все проверки пройдены' : `\n❌ Провалено проверок: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
