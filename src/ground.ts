import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import type { RoadSegment } from './data'

const groundMargin = 10
const textureScale = 4
const groundY = -0.01

export type GroundBounds = {
    centerX: number
    centerZ: number
    width: number
    depth: number
}

export function getGroundBounds(segments: RoadSegment[], margin: number): GroundBounds {
    if (segments.length === 0) return { centerX: 0, centerZ: 0, width: 1, depth: 1 }

    const xs = segments.map((segment) => segment.position.x)
    const zs = segments.map((segment) => segment.position.z)
    const minX = Math.min(...xs) - margin
    const maxX = Math.max(...xs) + margin
    const minZ = Math.min(...zs) - margin
    const maxZ = Math.max(...zs) + margin

    return {
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        width: maxX - minX,
        depth: maxZ - minZ
    }
}

function createGrassTexture(): CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create the grass texture')

    context.fillStyle = '#4d7a3a'
    context.fillRect(0, 0, size, size)

    for (let index = 0; index < 2500; index++) {
        const green = 90 + Math.floor(Math.random() * 70)
        context.fillStyle = `rgba(${Math.floor(green * 0.6)}, ${green}, ${Math.floor(green * 0.5)}, 0.35)`
        context.fillRect(Math.random() * size, Math.random() * size, 1, 2)
    }

    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.colorSpace = SRGBColorSpace
    return texture
}

export function createGrassGround(segments: RoadSegment[]): Mesh {
    const bounds = getGroundBounds(segments, groundMargin)
    const texture = createGrassTexture()
    texture.repeat.set(bounds.width / textureScale, bounds.depth / textureScale)

    const ground = new Mesh(
        new PlaneGeometry(bounds.width, bounds.depth),
        new MeshStandardMaterial({ map: texture, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(bounds.centerX, groundY, bounds.centerZ)
    return ground
}
