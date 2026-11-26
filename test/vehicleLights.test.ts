import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { describe, it } from 'vitest'
import { enableHeadlightGlow, hasHeadlights } from '../src/vehicleLights'

async function loadVehicle(name: string): Promise<Group> {
    const data = readFileSync(`models/cars/${name}.glb`)
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    const gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
    return gltf.scene
}

describe('vehicle headlights', () => {
    it('glows only materials named lightFront', () => {
        const headlightMaterial = new MeshStandardMaterial({ name: 'lightFront' })
        const vehicle = new Group()
        vehicle.add(new Mesh(new BoxGeometry(), headlightMaterial))

        assert.equal(hasHeadlights(vehicle), true)
        enableHeadlightGlow(vehicle)
        assert.equal(headlightMaterial.emissive.getHex(), 0xfff2d0)
        assert.equal(headlightMaterial.emissiveIntensity, 2)

        const plainVehicle = new Group()
        plainVehicle.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
        assert.equal(hasHeadlights(plainVehicle), false)
    })

    it('detects headlights in every vehicle GLB except the race cars', async () => {
        const vehicles = readdirSync('models/cars').filter((file) => file.endsWith('.glb') && !file.startsWith('wheel'))
        const withoutHeadlights: string[] = []

        assert.equal(vehicles.length, 20)
        for (const file of vehicles) {
            const name = file.slice(0, -4)
            if (!hasHeadlights(await loadVehicle(name))) withoutHeadlights.push(name)
        }

        assert.deepEqual(withoutHeadlights.sort(), ['race', 'raceFuture'])
    })
})
