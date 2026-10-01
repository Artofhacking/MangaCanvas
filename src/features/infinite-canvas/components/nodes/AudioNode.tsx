import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Position, NodeProps } from 'reactflow'
import { message } from 'antd'
import { Copy, Download, Music2, Pause, Play, Trash2, Upload } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import type { CustomNode } from '../../types'
import { mediaUrl } from '@/lib/mediaUrl'
import { uploadCanvasBlob } from '@/lib/uploadCanvasMedia'
import { PlusHandle } from './PlusHandle'
import { bindNodeGenerationCancel, readNodeProgress } from '../../utils/generationJobs'
import { MediaPreviewCard, MediaStageLoading } from './MediaPreviewCard'
import { audioModeLabel, audioModePatch, readAudioMode } from '../../utils/audioMode'
import { AudioModeSwitch } from '../AudioModeSwitch'
import { cn } from '@/lib/utils'

const AUDIO_CARD_WIDTH = 400
const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm'

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name)
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-10 items-end justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: 28 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full bg-[hsl(var(--primary))]',
            active ? 'audio-wave-bar opacity-80' : 'opacity-35'
          )}
          style={{
            height: `${10 + ((index * 17) % 26)}px`,
            animationDelay: `${(index % 7) * 80}ms`,
          }}
        />
      ))}
    </div>
  )
}

const AudioNode: React.FC<NodeProps<CustomNode['data']>> = ({ id, data, selected }) => {
  const { updateNode, removeNode, duplicateNode } = useCanvasStore()
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [total, setTotal] = useState(0)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabel, setEditLabel] = useState(data.label || '音频')
  const [dropActive, setDropActive] = useState(false)
  const mode = readAudioMode(data.audioMode)
  const sourceUrl = typeof data.url === 'string' ? data.url : ''
  const hasMedia = Boolean(sourceUrl)
  const playbackSrc = mediaUrl(sourceUrl)

  const applyFile = useCallback(
    (file: File) => {
      if (!isAudioFile(file)) {
        message.info('请上传音频文件')
        return
      }
      setUploading(true)
      audioRef.current?.pause()
      setPlaying(false)
      void uploadCanvasBlob(file)
        .then((url) => {
          updateNode(id, {
            url,
            loading: false,
            error: '',
            progress: undefined,
            statusLabel: undefined,
            label: data.label && data.label !== '音频' ? data.label : file.name.replace(/\.[^.]+$/, '') || '音频',
          })
          message.success('音频已上传')
        })
        .catch(() => {
          message.error('音频上传失败')
        })
        .finally(() => setUploading(false))
    },
    [data.label, id, updateNode]
  )

  const handleUploadClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    fileRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) applyFile(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    setDropActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) return
    setDropActive(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.stopPropagation()
    setDropActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) applyFile(file)
  }

  const togglePlayback = (event: React.MouseEvent) => {
    event.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().catch(() => message.error('无法播放这段音频'))
    } else {
      audio.pause()
    }
  }

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
  }

  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!sourceUrl) return
    const link = document.createElement('a')
    link.href = playbackSrc
    link.download = `audio_${Date.now()}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !hasMedia) return
    const syncDuration = () => setTotal(Number.isFinite(audio.duration) ? audio.duration : 0)
    const syncTime = () => setElapsed(audio.currentTime || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setElapsed(0)
    }
    audio.addEventListener('loadedmetadata', syncDuration)
    audio.addEventListener('durationchange', syncDuration)
    audio.addEventListener('timeupdate', syncTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    syncDuration()
    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration)
      audio.removeEventListener('durationchange', syncDuration)
      audio.removeEventListener('timeupdate', syncTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [hasMedia, playbackSrc])

  const progress = total > 0 ? Math.min(1, elapsed / total) : 0

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <MediaPreviewCard
        selected={selected}
        dropActive={dropActive}
        generating={Boolean(data.loading)}
        label={data.label || '音频'}
        icon={<Music2 />}
        width={AUDIO_CARD_WIDTH}
        aspectRatio="16 / 9"
        isEditingLabel={isEditingLabel}
        editLabel={editLabel}
        onLabelDoubleClick={(event) => {
          event.stopPropagation()
          setEditLabel(data.label || '音频')
          setIsEditingLabel(true)
        }}
        onLabelChange={(event) => setEditLabel(event.target.value)}
        onLabelBlur={() => {
          setIsEditingLabel(false)
          if (editLabel.trim() && editLabel !== data.label) {
            updateNode(id, { label: editLabel.trim() })
          }
        }}
        onLabelKeyDown={(event) => {
          if (event.key === 'Enter') {
            setIsEditingLabel(false)
            if (editLabel.trim() && editLabel !== data.label) updateNode(id, { label: editLabel.trim() })
          } else if (event.key === 'Escape') {
            setIsEditingLabel(false)
            setEditLabel(data.label || '音频')
          }
        }}
        handles={
          <>
            <PlusHandle type="target" position={Position.Left} />
            <PlusHandle type="source" position={Position.Right} />
          </>
        }
        actions={[
          {
            key: 'upload',
            label: uploading ? '上传中…' : '上传音频',
            icon: <Upload className="h-4 w-4" />,
            onClick: handleUploadClick,
            disabled: uploading,
          },
          {
            key: 'download',
            label: '下载',
            icon: <Download className="h-4 w-4" />,
            onClick: handleDownload,
            hidden: !hasMedia,
          },
          {
            key: 'duplicate',
            label: '复制',
            icon: <Copy className="h-4 w-4" />,
            onClick: (event) => {
              event.stopPropagation()
              duplicateNode(id)
              message.success('节点已复制')
            },
          },
          {
            key: 'delete',
            label: '删除',
            icon: <Trash2 className="h-4 w-4" />,
            onClick: (event) => {
              event.stopPropagation()
              removeNode(id)
            },
            danger: true,
          },
        ]}
      >
        {data.loading ? (
          <MediaStageLoading
            kind="audio"
            progress={readNodeProgress(data)}
            label={typeof data.statusLabel === 'string' ? data.statusLabel : undefined}
            onCancel={bindNodeGenerationCancel(id, updateNode)}
          />
        ) : (
          <div className="flex h-full flex-col gap-3 p-3.5">
            <AudioModeSwitch
              value={mode}
              disabled={uploading}
              onChange={(next) => updateNode(id, audioModePatch(next))}
            />
            {hasMedia ? (
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
                <audio
                  ref={audioRef}
                  src={playbackSrc}
                  preload="auto"
                />
                <Waveform active={playing} />
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="nodrag nopan nowheel flex h-9 w-9 shrink-0 items-center justify-center rounded-full signature-gradient text-white shadow-sm"
                    title={playing ? '暂停' : '播放'}
                    aria-label={playing ? '暂停' : '播放'}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className="nodrag nopan nowheel h-1.5 cursor-pointer rounded-full bg-[hsl(var(--surface-container-highest))]"
                      onClick={handleSeek}
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                      aria-label="播放进度"
                    >
                      <div
                        className="h-full rounded-full bg-[hsl(var(--primary))]"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[hsl(var(--secondary))]">
                      <span>{formatClock(elapsed)}</span>
                      <span>{formatClock(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--outline-variant))]/70 bg-[hsl(var(--surface-container-lowest))]/40 text-[hsl(var(--secondary))]">
                <Waveform active={false} />
                <span className="text-[11px]">在下方生成{audioModeLabel(mode)}，或上传本地文件</span>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={uploading}
                  className="nodrag nopan nowheel rounded-full bg-[hsl(var(--surface-container-lowest))] px-3 py-1 text-xs font-semibold text-[hsl(var(--on-surface))] shadow-sm transition-colors hover:text-[hsl(var(--primary))] disabled:opacity-60"
                >
                  {uploading ? '正在上传…' : '上传本地音频'}
                </button>
              </div>
            )}
          </div>
        )}
        {data.error ? (
          <div className="absolute inset-x-0 bottom-0 bg-[#b42318]/80 px-3 py-1.5 text-[11px] text-white">
            {data.error}
          </div>
        ) : null}
      </MediaPreviewCard>
    </div>
  )
}

export default AudioNode
