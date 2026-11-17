import { describe, expect, it } from 'vitest'
import { isAllowedFileUrl, sanitizeNextPath, uploadFilename } from './file-url'

describe('sanitizeNextPath', () => {
  it('возвращает /admin при пустом значении или не строке', () => {
    expect(sanitizeNextPath()).toBe('/admin')
    expect(sanitizeNextPath(undefined)).toBe('/admin')
    expect(sanitizeNextPath('')).toBe('/admin')
    expect(sanitizeNextPath('   ')).toBe('/admin')
    expect(sanitizeNextPath(null as any)).toBe('/admin')
  })

  it('отклоняет пути, не начинающиеся с /', () => {
    expect(sanitizeNextPath('projects')).toBe('/admin')
    expect(sanitizeNextPath('https://evil.com')).toBe('/admin')
    expect(sanitizeNextPath('http://evil.com')).toBe('/admin')
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/admin')
    expect(sanitizeNextPath('data:text/html,<script>alert(1)</script>')).toBe('/admin')
  })

  it('отклоняет protocol-relative пути //evil.com', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/admin')
    expect(sanitizeNextPath('///evil.com')).toBe('/admin')
    expect(sanitizeNextPath('//evil.com/admin')).toBe('/admin')
    expect(sanitizeNextPath('/projects//evil.com')).toBe('/admin')
  })

  it('отклоняет пути с обратными слэшами /\\evil.com', () => {
    expect(sanitizeNextPath('/\\evil.com')).toBe('/admin')
    expect(sanitizeNextPath('/\\\\evil.com')).toBe('/admin')
    expect(sanitizeNextPath('/path\\something')).toBe('/admin')
  })

  it('отклоняет пути с разделителями протоколов ://', () => {
    expect(sanitizeNextPath('/foo://bar')).toBe('/admin')
    expect(sanitizeNextPath('/redirect?url=https://evil.com')).toBe('/admin')
  })

  it('отклоняет пути с управляющими символами', () => {
    expect(sanitizeNextPath('/projects\x00')).toBe('/admin')
    expect(sanitizeNextPath('/projects\x1f')).toBe('/admin')
    expect(sanitizeNextPath('/projects\r\nevil')).toBe('/admin')
    expect(sanitizeNextPath('/projects\t1')).toBe('/admin')
  })

  it('разрешает безопасные относительные пути внутри сайта', () => {
    expect(sanitizeNextPath('/')).toBe('/')
    expect(sanitizeNextPath('/admin')).toBe('/admin')
    expect(sanitizeNextPath('/projects')).toBe('/projects')
    expect(sanitizeNextPath('/projects/new')).toBe('/projects/new')
    expect(sanitizeNextPath('/projects/123')).toBe('/projects/123')
    expect(sanitizeNextPath('/projects?sort=name&page=2')).toBe('/projects?sort=name&page=2')
    expect(sanitizeNextPath('/universities#list')).toBe('/universities#list')
  })
})

describe('uploadFilename', () => {
  it('возвращает имя файла для относительных и полных ссылок на /uploads/', () => {
    expect(uploadFilename('/uploads/test.pdf')).toBe('test.pdf')
    expect(uploadFilename('https://example.com/uploads/passport.pdf')).toBe('passport.pdf')
    expect(uploadFilename('http://localhost:3000/uploads/document.pdf')).toBe('document.pdf')
  })

  it('декодирует URI-компоненты (кириллица)', () => {
    const encoded = encodeURIComponent('Паспорт_проекта.pdf')
    expect(uploadFilename(`/uploads/${encoded}`)).toBe('Паспорт_проекта.pdf')
  })

  it('отсекает query параметры и hash', () => {
    expect(uploadFilename('/uploads/file.pdf?version=1#page=2')).toBe('file.pdf')
  })

  it('отклоняет файлы без расширения .pdf', () => {
    expect(uploadFilename('/uploads/script.js')).toBeNull()
    expect(uploadFilename('/uploads/image.png')).toBeNull()
    expect(uploadFilename('/uploads/doc.pdf.exe')).toBeNull()
  })

  it('отклоняет ссылки с поддиректориями или попытками traversal', () => {
    expect(uploadFilename('/uploads/sub/doc.pdf')).toBeNull()
    expect(uploadFilename('/uploads/../doc.pdf')).toBeNull()
  })

  it('отклоняет внешние ссылки без /uploads/', () => {
    expect(uploadFilename('https://external.com/docs/file.pdf')).toBeNull()
    expect(uploadFilename('/documents/file.pdf')).toBeNull()
  })

  it('возвращает null для некорректных или пустых входных данных', () => {
    expect(uploadFilename(null)).toBeNull()
    expect(uploadFilename(undefined)).toBeNull()
    expect(uploadFilename('')).toBeNull()
    expect(uploadFilename('not-a-valid-url')).toBeNull()
  })
})

describe('isAllowedFileUrl', () => {
  it('разрешает http, https и /uploads/', () => {
    expect(isAllowedFileUrl('https://example.com/doc.pdf')).toBe(true)
    expect(isAllowedFileUrl('http://example.com/doc.pdf')).toBe(true)
    expect(isAllowedFileUrl('/uploads/doc.pdf')).toBe(true)
  })

  it('запрещает javascript: и другие небезопасные протоколы', () => {
    expect(isAllowedFileUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedFileUrl('data:text/html,abc')).toBe(false)
    expect(isAllowedFileUrl('')).toBe(false)
    expect(isAllowedFileUrl(null)).toBe(false)
  })
})
