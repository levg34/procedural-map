import assert from 'node:assert/strict'
import { Group, Scene } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { describe, it } from 'vitest'
import { createRoadPreview } from '../src/client/roadPreview'

function model(name: string): { name: string; model: GLTF } {
    const scene = new Group()
    scene.name = name
    return { name, model: { scene } as GLTF }
}

function shownNames(scene: Scene): string[] {
    return scene.children.map((child) => child.name)
}

describe('road preview', () => {
    it('shows one model at a time and wraps around at the end', () => {
        const scene = new Scene()
        const models = [model('first'), model('second')]
        const preview = createRoadPreview(scene, () => models)

        assert.deepStrictEqual(shownNames(scene), [])

        preview.showNext()
        assert.deepStrictEqual(shownNames(scene), ['first'])

        preview.showNext()
        assert.deepStrictEqual(shownNames(scene), ['second'])

        preview.showNext()
        assert.deepStrictEqual(shownNames(scene), ['first'])
    })

    it('clones catalog scenes instead of adding them to the scene graph', () => {
        const scene = new Scene()
        const first = model('first')
        const preview = createRoadPreview(scene, () => [first])

        preview.showNext()

        assert.notStrictEqual(scene.children[0], first.model.scene)
        assert.strictEqual(first.model.scene.parent, null)
        assert.deepStrictEqual(shownNames(scene), ['first'])
    })

    it('clears the current model on reset', () => {
        const scene = new Scene()
        const models = [model('first'), model('second')]
        const preview = createRoadPreview(scene, () => models)

        preview.showNext()
        preview.showNext()
        preview.reset()
        assert.deepStrictEqual(shownNames(scene), [])

        preview.showNext()
        assert.deepStrictEqual(shownNames(scene), ['first'])
    })

    it('does nothing when the catalog is empty', () => {
        const scene = new Scene()
        const preview = createRoadPreview(scene, () => [])

        preview.showNext()
        preview.reset()

        assert.deepStrictEqual(shownNames(scene), [])
    })
})
