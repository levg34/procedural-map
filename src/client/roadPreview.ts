import { Object3D, Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

type PreviewableModel = {
    model: GLTF
}

export type RoadPreview = {
    showNext(): void
    reset(): void
}

/** Cycles one road model through the scene without touching the loaded catalog. */
export function createRoadPreview<Model extends PreviewableModel>(
    scene: Scene,
    getModels: () => readonly Model[]
): RoadPreview {
    let index = 0
    let current: Object3D | undefined

    function clear(): void {
        if (current) scene.remove(current)
        current = undefined
    }

    return {
        showNext() {
            const models = getModels()
            if (models.length === 0) return

            clear()
            const model = models[index]
            if (!model) {
                index = 0
                return
            }

            current = model.model.scene.clone()
            scene.add(current)
            index = (index + 1) % models.length
        },
        reset() {
            clear()
            index = 0
        }
    }
}
