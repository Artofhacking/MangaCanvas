import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from './canvasStore'

describe('removeSelectedNodes', () => {
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas()
    useCanvasStore.setState({ history: [], historyIndex: -1, referencePickTargetId: null })
  })

  it('removes every selected node and edges that touch them in one undo step', () => {
    const source = useCanvasStore.getState().addNode('image', { x: 0, y: 0 }, { url: 'https://img/a.png' })
    const target = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 })
    const kept = useCanvasStore.getState().addNode('videoConfig', { x: 640, y: 0 })
    useCanvasStore.getState().addEdgeManually({ source, target })
    useCanvasStore.getState().addEdgeManually({ source: kept, target })
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map((node) => ({
        ...node,
        selected: node.id === source || node.id === target,
      })),
    })
    const historyBefore = useCanvasStore.getState().historyIndex

    expect(useCanvasStore.getState().removeSelectedNodes()).toBe(true)

    const { nodes, edges, historyIndex } = useCanvasStore.getState()
    expect(nodes.map((node) => node.id)).toEqual([kept])
    expect(edges).toEqual([])
    expect(historyIndex).toBe(historyBefore + 1)

    useCanvasStore.getState().undo()
    const restored = useCanvasStore.getState()
    expect(restored.nodes.map((node) => node.id).sort()).toEqual([kept, source, target].sort())
    expect(restored.edges).toHaveLength(2)
  })

  it('removes a selected edge that is not attached to a selected node', () => {
    const source = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
    const target = useCanvasStore.getState().addNode('videoConfig', { x: 320, y: 0 })
    useCanvasStore.getState().addEdgeManually({ source, target })
    useCanvasStore.setState({
      edges: useCanvasStore.getState().edges.map((edge) => ({ ...edge, selected: true })),
    })

    expect(useCanvasStore.getState().removeSelectedNodes()).toBe(true)
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
    expect(useCanvasStore.getState().edges).toEqual([])
  })

  it('keeps context-menu delete on the same removal path', () => {
    const source = useCanvasStore.getState().addNode('image', { x: 0, y: 0 })
    const target = useCanvasStore.getState().addNode('imageConfig', { x: 320, y: 0 })
    const other = useCanvasStore.getState().addNode('text', { x: 0, y: 200 })
    useCanvasStore.getState().addEdgeManually({ source, target })
    useCanvasStore.getState().setReferencePickTarget(target)
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map((node) => ({ ...node, selected: true })),
    })

    useCanvasStore.getState().removeNode(source)

    const state = useCanvasStore.getState()
    expect(state.nodes.map((node) => node.id).sort()).toEqual([other, target].sort())
    expect(state.edges).toEqual([])
    expect(state.referencePickTargetId).toBe(target)
  })

  it('clears reference pick when the selected target is deleted, and no-ops with nothing selected', () => {
    const target = useCanvasStore.getState().addNode('imageConfig', { x: 0, y: 0 })
    useCanvasStore.getState().setReferencePickTarget(target)
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map((node) => ({ ...node, selected: node.id === target })),
    })
    const historyBefore = useCanvasStore.getState().historyIndex

    expect(useCanvasStore.getState().removeSelectedNodes()).toBe(true)
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().referencePickTargetId).toBeNull()

    const after = useCanvasStore.getState().historyIndex
    expect(useCanvasStore.getState().removeSelectedNodes()).toBe(false)
    expect(useCanvasStore.getState().historyIndex).toBe(after)
    expect(after).toBeGreaterThan(historyBefore)
  })
})
