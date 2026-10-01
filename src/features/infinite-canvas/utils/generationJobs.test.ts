import { afterEach, describe, expect, it } from 'vitest'
import {
  cancelGenerationJob,
  finishGenerationJob,
  hasGenerationJob,
  startGenerationJob,
  subscribeGenerationJobs,
} from './generationJobs'

const ids = ['node-a', 'node-b']

afterEach(() => {
  for (const id of ids) cancelGenerationJob(id)
})

describe('generation jobs per node', () => {
  it('keeps another node’s job when one finishes', () => {
    const signalA = startGenerationJob('node-a')
    const signalB = startGenerationJob('node-b')

    expect(hasGenerationJob('node-a')).toBe(true)
    expect(hasGenerationJob('node-b')).toBe(true)
    expect(signalA.aborted).toBe(false)
    expect(signalB.aborted).toBe(false)

    expect(finishGenerationJob('node-a', signalA)).toBe(true)
    expect(hasGenerationJob('node-a')).toBe(false)
    expect(hasGenerationJob('node-b')).toBe(true)
    expect(signalB.aborted).toBe(false)
  })

  it('only aborts the same node when a new send supersedes it', () => {
    const first = startGenerationJob('node-a')
    const other = startGenerationJob('node-b')
    const second = startGenerationJob('node-a')

    expect(first.aborted).toBe(true)
    expect(other.aborted).toBe(false)
    expect(second.aborted).toBe(false)
    expect(finishGenerationJob('node-a', first)).toBe(false)
    expect(hasGenerationJob('node-a')).toBe(true)
    expect(hasGenerationJob('node-b')).toBe(true)
    expect(finishGenerationJob('node-a', second)).toBe(true)
    expect(hasGenerationJob('node-a')).toBe(false)
    expect(hasGenerationJob('node-b')).toBe(true)
  })

  it('notifies listeners so the selected node can be read on its own', () => {
    let selected: string | null = 'node-a'
    let sending = false
    const read = () => {
      sending = Boolean(selected && hasGenerationJob(selected))
    }
    const unsubscribe = subscribeGenerationJobs(read)

    try {
      startGenerationJob('node-a')
      expect(sending).toBe(true)

      selected = 'node-b'
      read()
      expect(sending).toBe(false)

      const signalB = startGenerationJob('node-b')
      expect(sending).toBe(true)
      expect(hasGenerationJob('node-a')).toBe(true)

      selected = 'node-a'
      read()
      expect(sending).toBe(true)

      cancelGenerationJob('node-a')
      expect(sending).toBe(false)
      expect(hasGenerationJob('node-b')).toBe(true)
      expect(signalB.aborted).toBe(false)
    } finally {
      unsubscribe()
    }
  })
})
