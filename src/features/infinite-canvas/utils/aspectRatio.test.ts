import { describe, expect, it } from 'vitest'
import {
  aspectRatioIconSize,
  getSizeRatio,
  labeledSizes,
  parseSizeDimensions,
  sortAspectRatios,
  uniqueAspectRatios,
} from './aspectRatio'

describe('parseSizeDimensions', () => {
  it('parses WxH, W*H, and unicode separators', () => {
    expect(parseSizeDimensions('1024x1536')).toEqual({ width: 1024, height: 1536 })
    expect(parseSizeDimensions('1536X1024')).toEqual({ width: 1536, height: 1024 })
    expect(parseSizeDimensions('1696*960')).toEqual({ width: 1696, height: 960 })
    expect(parseSizeDimensions('1280×720')).toEqual({ width: 1280, height: 720 })
    expect(parseSizeDimensions(' 1920 * 1080 ')).toEqual({ width: 1920, height: 1080 })
  })

  it('returns null for invalid keys', () => {
    expect(parseSizeDimensions('')).toBeNull()
    expect(parseSizeDimensions('1:1')).toBeNull()
    expect(parseSizeDimensions('abc')).toBeNull()
    expect(parseSizeDimensions('0x1024')).toBeNull()
  })
})

describe('getSizeRatio', () => {
  it('reduces exact sizes by GCD', () => {
    expect(getSizeRatio('1024x1024')).toBe('1:1')
    expect(getSizeRatio('1024*1024')).toBe('1:1')
    expect(getSizeRatio('1920*1080')).toBe('16:9')
    expect(getSizeRatio('1280*720')).toBe('16:9')
    expect(getSizeRatio('1104*1472')).toBe('3:4')
    expect(getSizeRatio('1472*1104')).toBe('4:3')
    expect(getSizeRatio('1344*576')).toBe('21:9')
  })

  it('keeps GPT Image portrait/landscape as 2:3 and 3:2, not 3:4 / 4:3', () => {
    expect(getSizeRatio('1024x1536')).toBe('2:3')
    expect(getSizeRatio('1536x1024')).toBe('3:2')
    expect(getSizeRatio('1024x1536')).not.toBe('3:4')
    expect(getSizeRatio('1536x1024')).not.toBe('4:3')
  })

  it('snaps near-16:9 vendor sizes without lying about exact 2:3', () => {
    expect(getSizeRatio('1696*960')).toBe('16:9')
    expect(getSizeRatio('960*1696')).toBe('9:16')
    expect(getSizeRatio('1024x1536')).toBe('2:3')
  })

  it('falls back when the key cannot be parsed', () => {
    expect(getSizeRatio('')).toBe('1:1')
    expect(getSizeRatio('unknown', '16:9')).toBe('16:9')
  })
})

describe('uniqueAspectRatios', () => {
  it('dedupes and sorts landscape → square → portrait', () => {
    expect(
      uniqueAspectRatios([
        { key: '1024x1024' },
        { key: '1024x1536' },
        { key: '1536x1024' },
        { key: '1440*1440' },
      ])
    ).toEqual(['3:2', '1:1', '2:3'])
    expect(sortAspectRatios(['9:16', '1:1', '16:9', '4:3', '3:4'])).toEqual([
      '16:9',
      '4:3',
      '1:1',
      '3:4',
      '9:16',
    ])
  })
})

describe('labeledSizes', () => {
  it('writes labels from the computed ratio, not a stale 3:4 claim', () => {
    expect(labeledSizes(['1024x1536', '1536x1024'])).toEqual([
      { key: '1024x1536', label: '2:3 (1024x1536)' },
      { key: '1536x1024', label: '3:2 (1536x1024)' },
    ])
  })
})

describe('aspectRatioIconSize', () => {
  it('keeps square compact and scales other ratios from the long side', () => {
    expect(aspectRatioIconSize('1:1')).toEqual({ w: 12, h: 12 })
    expect(aspectRatioIconSize('16:9')).toEqual({ w: 16, h: 9 })
    expect(aspectRatioIconSize('2:3')).toEqual({ w: 11, h: 16 })
  })
})
