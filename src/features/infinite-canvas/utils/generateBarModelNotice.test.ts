import { describe, expect, it } from 'vitest'
import { resolveGenerateBarModelNotice } from './generateBarModelNotice'

describe('resolveGenerateBarModelNotice', () => {
  it('stays quiet while the modality list is idle or still loading', () => {
    expect(
      resolveGenerateBarModelNotice({
        loading: false,
        isLoaded: false,
        error: null,
        modelCount: 0,
      })
    ).toBeNull()
    expect(
      resolveGenerateBarModelNotice({
        loading: true,
        isLoaded: false,
        error: null,
        modelCount: 0,
      })
    ).toBeNull()
  })

  it('does not warn when a successful fetch returns enabled models', () => {
    expect(
      resolveGenerateBarModelNotice({
        loading: false,
        isLoaded: true,
        error: null,
        modelCount: 2,
      })
    ).toBeNull()
  })

  it('warns once the successful fetch has a truly empty enabled list', () => {
    expect(
      resolveGenerateBarModelNotice({
        loading: false,
        isLoaded: true,
        error: null,
        modelCount: 0,
      })
    ).toBe('empty')
  })

  it('keeps fetch failures on the error path even when the list is empty', () => {
    expect(
      resolveGenerateBarModelNotice({
        loading: false,
        isLoaded: true,
        error: '获取模型列表失败',
        modelCount: 0,
      })
    ).toBe('load-error')
  })
})
