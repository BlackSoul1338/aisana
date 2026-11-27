import { describe, expect, it } from 'vitest'
import { parseBody, projectSchema } from '@/lib/schemas'

const FORM_BODY = {
  title: 'Чат-бот приёмной комиссии',
  description: 'Чат-бот отвечает абитуриентам на вопросы о поступлении и грантах.',
  category: 'EDUCATION',
  status: 'PILOT',
}

const MEDIA = ['presentationPdf', 'presentationPptx', 'zoomLink', 'videoUrl', 'documentation'] as const

describe('projectSchema: поля, которых нет в форме проекта', () => {
  it('отсутствующее поле остаётся undefined, и PUT его не меняет', () => {
    const parsed = parseBody(projectSchema, FORM_BODY)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    for (const field of MEDIA) expect(parsed.data[field]).toBeUndefined()
  })

  it('пустая строка очищает поле', () => {
    const parsed = parseBody(projectSchema, { ...FORM_BODY, videoUrl: '', presentationPdf: '  ' })
    expect(parsed.success && parsed.data.videoUrl).toBeNull()
    expect(parsed.success && parsed.data.presentationPdf).toBeNull()
  })

  it('значение сохраняется', () => {
    const parsed = parseBody(projectSchema, { ...FORM_BODY, videoUrl: ' https://youtu.be/demo ' })
    expect(parsed.success && parsed.data.videoUrl).toBe('https://youtu.be/demo')
  })
})
