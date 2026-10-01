import { describe, expect, it } from 'vitest'
import {
  appendVideoJobId,
  graphWithoutGenerationTransients,
  readVideoJobIds,
  stripNodeGenerationTransients,
  videoResumeOutcome,
} from './videoJobBinding'

describe('video job binding', () => {
  it('strips generating fields and keeps the job id', () => {
    const node = stripNodeGenerationTransients({
      id: 'clip',
      data: {
        label: '视频节点',
        loading: true,
        progress: 20,
        statusLabel: '排队中',
        videoJobIds: ['job_1'],
        prompt: '雨夜',
      },
    })

    expect(node.data).toEqual({
      label: '视频节点',
      videoJobIds: ['job_1'],
      prompt: '雨夜',
    })
    expect(graphWithoutGenerationTransients({
      nodes: [node],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }).nodes[0]).toBe(node)
  })

  it('appends a job id once', () => {
    expect(appendVideoJobId(['job_1'], 'job_1')).toEqual(['job_1'])
    expect(appendVideoJobId(['job_1'], ' job_2 ')).toEqual(['job_1', 'job_2'])
    expect(readVideoJobIds({ videoJobIds: ['job_1', '', 'job_1', 'job_2'] })).toEqual(['job_1', 'job_2'])
  })

  it('keeps the overlay while any clip is still running', () => {
    const outcome = videoResumeOutcome({
      nodeId: 'clip',
      jobs: [
        { jobId: 'a', status: 'succeeded', url: 'https://cdn.example/a.mp4' },
        { jobId: 'b', status: 'running', progress: 40 },
      ],
    })
    expect(outcome.done).toBe(false)
    expect(outcome.patch).toMatchObject({ loading: true, statusLabel: '生成中', error: '' })
  })

  it('writes finished urls and clears the job ids', () => {
    const outcome = videoResumeOutcome({
      nodeId: 'clip',
      now: 5,
      requestedCount: 2,
      posters: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      jobs: [
        { jobId: 'a', status: 'succeeded', url: 'https://cdn.example/a.mp4' },
        { jobId: 'b', status: 'succeeded', url: 'https://cdn.example/b.mp4' },
      ],
    })
    expect(outcome.done).toBe(true)
    expect(outcome.patch.url).toBe('https://cdn.example/a.mp4')
    expect(outcome.patch.videoUrls).toEqual(['https://cdn.example/a.mp4', 'https://cdn.example/b.mp4'])
    expect(outcome.patch.loading).toBe(false)
    expect(outcome.patch.videoJobIds).toBeUndefined()
    expect(outcome.patch.progress).toBeUndefined()
    expect(outcome.patch.statusLabel).toBeUndefined()
  })

  it('clears a cancelled job without an error and surfaces a failure', () => {
    const cancelled = videoResumeOutcome({
      nodeId: 'clip',
      jobs: [{ jobId: 'a', status: 'cancelled' }],
    })
    expect(cancelled.patch).toMatchObject({
      loading: false,
      error: '',
      videoJobIds: undefined,
    })

    const failed = videoResumeOutcome({
      nodeId: 'clip',
      jobs: [{ jobId: 'a', status: 'failed', message: '上游拒绝' }],
    })
    expect(failed.patch).toMatchObject({
      loading: false,
      error: '上游拒绝',
      videoJobIds: undefined,
    })
  })
})
