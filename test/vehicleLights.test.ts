import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { describe, it } from 'vitest'
import { enableHeadlightGlow, enableTailLightGlow, hasHeadlights, hasTailLights } from '../src/vehicleLights'

async function loadVehicle(name: string): Promise<Group> {
    const data = readFileSync(`models/cars/${name}.glb`)
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    const gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
    return gltf.scene
}

describe('vehicle lights', () => {
    it('glows only the materials named lightFront and lightBack', () => {
        const headlightMaterial = new MeshStandardMaterial({ name: 'lightFront' })
        const tailLightMaterial = new MeshStandardMaterial({ name: 'lightBack' })
        const vehicle = new Group()
        vehicle.add(new Mesh(new BoxGeometry(), headlightMaterial), new Mesh(new BoxGeometry(), tailLightMaterial))

        assert.equal(hasHeadlights(vehicle), true)
        assert.equal(hasTailLights(vehicle), true)
        enableHeadlightGlow(vehicle)
        enableTailLightGlow(vehicle)
        assert.equal(headlightMaterial.emissive.getHex(), 0xfff2d0)
        assert.equal(headlightMaterial.emissiveIntensity, 2)
        assert.equal(tailLightMaterial.emissive.getHex(), 0xff3030)
        assert.equal(tailLightMaterial.emissiveIntensity, 1.5)

        const plainVehicle = new Group()
        plainVehicle.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
        assert.equal(hasHeadlights(plainVehicle), false)
        assert.equal(hasTailLights(plainVehicle), false)
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

    it('detects tail lights only in the GLBs that provide them', async () => {
        const vehicles = readdirSync('models/cars').filter((file) => file.endsWith('.glb') && !file.startsWith('wheel'))
        const withoutTailLights: string[] = []

        for (const file of vehicles) {
            const name = file.slice(0, -4)
            if (!hasTailLights(await loadVehicle(name))) withoutTailLights.push(name)
        }

        assert.deepEqual(withoutTailLights.sort(), ['ambulance', 'race', 'raceFuture', 'tractor', 'tractorShovel'])
    })
})
