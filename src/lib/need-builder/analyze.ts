import { SchemaType, type ResponseSchema } from '@google/generative-ai'
import { z } from 'zod'
import { generateWithFallback } from '@/lib/gemini-models'
import { FIELD_ORDER, type NeedFieldKey } from './readiness'
import type { AiAnalysis } from './quotes'
import { ANALYZE_SYSTEM, analyzePrompt } from './prompts'

export type DialogMessage = { role: 'user' | 'assistant'; text: string }

export const formatDialog = (messages: DialogMessage[]) =>
  messages.map(m => `${m.role === 'user' ? 'Бизнес' : 'Ассистент'}: ${m.text}`).join('\n\n')

/** Модель иногда пишет статус с заглавной — приводим к нижнему регистру до проверки. */
const status = z.preprocess(
  value => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['ok', 'weak', 'missing']),
)

const fieldSchema = z.object({ status, value: z.string(), quote: z.string() })

const AnalysisSchema = z.object({
  ...Object.fromEntries(FIELD_ORDER.map(key => [key, fieldSchema])) as Record<NeedFieldKey, typeof fieldSchema>,
  questions: z.array(z.object({ field: z.string(), text: z.string() })),
})

const FIELD_RESPONSE: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    status: { type: SchemaType.STRING, format: 'enum', enum: ['ok', 'weak', 'missing'] },
    value: { type: SchemaType.STRING },
    quote: { type: SchemaType.STRING },
  },
  required: ['status', 'value', 'quote'],
}

const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    ...Object.fromEntries(FIELD_ORDER.map(key => [key, FIELD_RESPONSE])),
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field: { type: SchemaType.STRING, format: 'enum', enum: [...FIELD_ORDER] },
          text: { type: SchemaType.STRING },
        },
        required: ['field', 'text'],
      },
    },
  },
  required: [...FIELD_ORDER, 'questions'],
}

/** Предел ожидания одной модели. */
const MODEL_TIMEOUT_MS = 20_000
/** Предел на весь разбор с повтором: роут ограничен maxDuration = 60 с, нужен запас на БД и подборку. */
const TOTAL_BUDGET_MS = 45_000

async function requestOnce(prompt: string, deadline: number): Promise<{ analysis: AiAnalysis | null; available: boolean }> {
  const result = await generateWithFallback(
    'need',
    model =>
      model.generateContent({
        systemInstruction: ANALYZE_SYSTEM,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    request => request.then(res => res.response.text()),
    { timeoutMs: MODEL_TIMEOUT_MS, deadline },
  )
  if (!result) return { analysis: null, available: false }

  let json: unknown
  try {
    json = JSON.parse(result.text)
  } catch {
    return { analysis: null, available: true }
  }
  const parsed = AnalysisSchema.safeParse(json)
  if (!parsed.success) return { analysis: null, available: true }

  // Вопросы к несуществующим полям отбрасываем, а не валим весь ответ
  const questions = parsed.data.questions
    .filter((q): q is { field: NeedFieldKey; text: string } => (FIELD_ORDER as string[]).includes(q.field))
  return { analysis: { ...parsed.data, questions }, available: true }
}

/**
 * Разбор всего диалога моделью. Каждый ход разбирается заново целиком:
 * так поле, подтверждённое раньше, не держится на старой цитате.
 *
 * null — модель недоступна (нет ключа, у всей цепочки кончилась квота) или
 * дважды вернула ответ не по схеме.
 */
export async function analyzeDialog(messages: DialogMessage[]): Promise<AiAnalysis | null> {
  if (!process.env.GEMINI_API_KEY) return null
  const prompt = analyzePrompt(formatDialog(messages))
  const deadline = Date.now() + TOTAL_BUDGET_MS
  for (let attempt = 0; attempt < 2; attempt++) {
    const { analysis, available } = await requestOnce(prompt, deadline)
    if (analysis) return analysis
    if (!available) return null
  }
  return null
}
