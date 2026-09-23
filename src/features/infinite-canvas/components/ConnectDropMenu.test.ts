import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ConnectDropMenu from './ConnectDropMenu'

describe('ConnectDropMenu', () => {
  it('lists 画面, 视频, and 文本 under 引用该节点生成', () => {
    const html = renderToStaticMarkup(
      createElement(ConnectDropMenu, {
        state: {
          sourceId: 'node_1',
          screen: { x: 40, y: 40 },
          flow: { x: 10, y: 10 },
        },
        onSelect: () => {},
        onClose: () => {},
      })
    )

    expect(html).toContain('引用该节点生成')
    expect(html).toContain('打开底部生成栏生图')
    expect(html).toContain('打开底部生成栏生视频')
    expect(html).toContain('新建文本节点并引用该节点')

    const imageIndex = html.indexOf('>画面<')
    const videoIndex = html.indexOf('>视频<')
    const textIndex = html.indexOf('>文本<')
    expect(imageIndex).toBeGreaterThan(-1)
    expect(videoIndex).toBeGreaterThan(imageIndex)
    expect(textIndex).toBeGreaterThan(videoIndex)
  })
})
