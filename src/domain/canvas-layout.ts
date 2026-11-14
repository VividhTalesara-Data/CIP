import type { WorkflowNode } from './types.ts'

export interface Point { x: number; y: number }
export interface CanvasLayout {
  width: number
  height: number
  center: Point
  positions: Record<string, Point>
}

export const SOURCE_WIDTH = 250
export const SOURCE_HEIGHT = 178

export function layoutInvestigation(nodes: WorkflowNode[]): CanvasLayout {
  const count = nodes.length
  const rows = count <= 6 ? 3 : Math.ceil(Math.ceil(count / 2) / 2)
  const height = Math.max(880, rows * 214 + 100)
  const center = { x: 780, y: height / 2 }
  const positions: Record<string, Point> = {}
  nodes.forEach((node, index) => {
    const side = index % 2
    const ordinal = Math.floor(index / 2)
    if (count <= 6) {
      const sideCount = side === 0 ? Math.ceil(count / 2) : Math.floor(count / 2)
      positions[node.id] = { x: side ? 1210 : 350, y: center.y + (ordinal - (sideCount - 1) / 2) * 246 }
    } else {
      const column = ordinal % 2
      const row = Math.floor(ordinal / 2)
      positions[node.id] = {
        x: side ? (column ? 1405 : 1125) : (column ? 155 : 435),
        y: center.y + (row - (rows - 1) / 2) * 214,
      }
    }
  })
  return { width: 1560, height, center, positions }
}

export function connectionPath(from: Point, to: Point, bend = 0): string {
  const dx = to.x - from.x
  const curve = Math.max(70, Math.abs(dx) * 0.48)
  const direction = dx >= 0 ? 1 : -1
  return `M ${from.x} ${from.y} C ${from.x + curve * direction} ${from.y + bend}, ${to.x - curve * direction} ${to.y - bend}, ${to.x} ${to.y}`
}

export function sourcePort(point: Point, toward: Point): Point {
  return { x: point.x + (toward.x >= point.x ? SOURCE_WIDTH / 2 : -SOURCE_WIDTH / 2), y: point.y }
}
