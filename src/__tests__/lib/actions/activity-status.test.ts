import { describe, it, expect, vi, afterEach } from 'vitest'
import { calcActivityStatus } from '@/lib/utils/activity-status'

// 基準日: 2026-03-29T00:00:00Z = 1774742400000 ms
const BASE_NOW = 1774742400000

describe('calcActivityStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockNow() {
    vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW)
  }

  it('セッション実績なし + 将来予約なし -> red', () => {
    mockNow()
    expect(calcActivityStatus(null, false)).toBe('red')
  })

  it('セッション実績なし + 将来予約あり -> normal', () => {
    mockNow()
    expect(calcActivityStatus(null, true)).toBe('normal')
  })

  it('87日前 (2026-01-01) + 将来予約なし -> red', () => {
    mockNow()
    expect(calcActivityStatus('2026-01-01T00:00:00.000Z', false)).toBe('red')
  })

  it('56日前 (2026-02-01) + 将来予約なし -> yellow', () => {
    mockNow()
    expect(calcActivityStatus('2026-02-01T00:00:00.000Z', false)).toBe('yellow')
  })

  it('9日前 (2026-03-20) + 将来予約なし -> normal', () => {
    mockNow()
    expect(calcActivityStatus('2026-03-20T00:00:00.000Z', false)).toBe('normal')
  })

  it('87日前 + 将来予約あり -> normal', () => {
    mockNow()
    expect(calcActivityStatus('2026-01-01T00:00:00.000Z', true)).toBe('normal')
  })

  it('ちょうど30日前 (2026-02-27) + 将来予約なし -> yellow (境界値)', () => {
    mockNow()
    expect(calcActivityStatus('2026-02-27T00:00:00.000Z', false)).toBe('yellow')
  })

  it('ちょうど60日前 (2026-01-28) + 将来予約なし -> red (境界値)', () => {
    mockNow()
    expect(calcActivityStatus('2026-01-28T00:00:00.000Z', false)).toBe('red')
  })

  it('29日前 (2026-02-28) + 将来予約なし -> normal (境界値)', () => {
    mockNow()
    expect(calcActivityStatus('2026-02-28T00:00:00.000Z', false)).toBe('normal')
  })

  it('59日前 (2026-01-29) + 将来予約なし -> yellow (境界値)', () => {
    mockNow()
    expect(calcActivityStatus('2026-01-29T00:00:00.000Z', false)).toBe('yellow')
  })
})
