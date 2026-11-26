import assert from 'node:assert/strict'
import { CurvePath, Group, LineCurve3, PointLight, Scene, Vector3 } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { describe, it } from 'vitest'
import {
    createTrafficSimulation,
    type LoadedTrafficVehicleModel,
    type TrafficSimulationOptions
} from '../src/client/trafficSimulation'
import type { RoadPath } from '../src/client/vehiclePath'
import { doubleEquals } from './testUtils'

const laneOffset = 0.16

function straightPath(fromZ = 0, toZ = 10): RoadPath {
    const path = new CurvePath<Vector3>()
    path.add(new LineCurve3(new Vector3(0, 0, fromZ), new Vector3(0, 0, toZ)))
    return path
}

function vehicleModel(name: string): LoadedTrafficVehicleModel {
    return {
        name,
        url: `/model/cars/${name}.glb`,
        model: { scene: new Group() } as GLTF
    }
}

function createSetup(overrides: Partial<TrafficSimulationOptions> = {}) {
    const scene = new Scene()
    const created: Group[] = []
    const options: TrafficSimulationOptions = {
        scene,
        laneOffset,
        isShowcase: false,
        reverseTrafficVehicleCount: 1,
        forwardTrafficVehicleCount: 1,
        createVehicle: () => {
            const object = new Group()
            created.push(object)
            return { object, beaconLights: [new PointLight()] }
        },
        ...overrides
    }
    return { scene, created, simulation: createTrafficSimulation(options) }
}

describe('traffic simulation', () => {
    it('spawns the configured number of vehicles on each path, leaving progress 0 clear', () => {
        const { scene, created, simulation } = createSetup({
            reverseTrafficVehicleCount: 2,
            forwardTrafficVehicleCount: 1
        })

        simulation.start(straightPath(), straightPath(), [vehicleModel('car'), vehicleModel('van')])
        simulation.update(0)

        assert.strictEqual(created.length, 3)
        assert.strictEqual(scene.children.length, 3)
        const progress = created.map((vehicle) => vehicle.position.z / 10).sort((a, b) => a - b)
        assert.ok(doubleEquals(progress[0] ?? -1, 1 / 3))
        assert.ok(doubleEquals(progress[1] ?? -1, 1 / 2))
        assert.ok(doubleEquals(progress[2] ?? -1, 2 / 3))
    })

    it('advances the ambulance along the center path', () => {
        const { simulation } = createSetup()
        const ambulance = new Group()
        simulation.setAmbulance(ambulance, [])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        simulation.update(1)

        assert.ok(doubleEquals(ambulance.position.z, 2))
        assert.ok(doubleEquals(ambulance.position.x, -laneOffset))
        assert.ok(doubleEquals(ambulance.position.y, 0.02))
    })

    it('returns the ambulance along the reverse path after a turnaround', () => {
        const { simulation } = createSetup()
        const ambulance = new Group()
        simulation.setAmbulance(ambulance, [])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        // Reach the end of the center path and complete the turnaround.
        for (let i = 0; i < 6; i++) simulation.update(1)
        assert.ok(ambulance.position.z > 8)

        // Continue along the reverse path: z decreases as progress increases.
        simulation.update(1)
        const zAfterTurnaround = ambulance.position.z
        assert.ok(zAfterTurnaround < 10)
        simulation.update(1)
        assert.ok(ambulance.position.z < zAfterTurnaround)
    })

    it('wraps the ambulance around in showcase mode instead of turning around', () => {
        const { simulation } = createSetup({ isShowcase: true })
        const ambulance = new Group()
        simulation.setAmbulance(ambulance, [])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        let minZ = Infinity
        let maxZ = -Infinity
        for (let i = 0; i < 100; i++) {
            simulation.update(0.2)
            minZ = Math.min(minZ, ambulance.position.z)
            maxZ = Math.max(maxZ, ambulance.position.z)
        }

        assert.ok(minZ >= 0)
        assert.ok(maxZ <= 10)
    })

    it('blinks beacons every 30 updates', () => {
        const { simulation } = createSetup()
        const ambulanceBeacon = new PointLight()
        const parkedBeacon = new PointLight()
        simulation.setAmbulance(new Group(), [ambulanceBeacon])
        simulation.addParkedBeaconLights([parkedBeacon])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        for (let i = 0; i < 29; i++) simulation.update(0)
        assert.strictEqual(ambulanceBeacon.visible, true)
        assert.strictEqual(parkedBeacon.visible, true)

        simulation.update(0)
        assert.strictEqual(ambulanceBeacon.visible, false)
        assert.strictEqual(parkedBeacon.visible, false)
    })

    it('keeps the scene light count constant across respawns', () => {
        const { scene, simulation } = createSetup()
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        let before = 0
        scene.traverse((object) => {
            if (object instanceof PointLight) before++
        })

        simulation.update(3)

        let after = 0
        scene.traverse((object) => {
            if (object instanceof PointLight) after++
        })
        assert.strictEqual(after, before)
    })

    it('deals distinct models from a shuffled deck', () => {
        const names = ['ambulance', 'police', 'sedan', 'taxi', 'van']
        const spawned: string[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 3,
            forwardTrafficVehicleCount: 2,
            random: () => 0.5,
            createVehicle: (model) => {
                spawned.push(model.name)
                return { object: new Group(), beaconLights: [] }
            }
        })

        simulation.start(straightPath(), straightPath(10, 0), names.map(vehicleModel))

        assert.strictEqual(spawned.length, 5)
        assert.deepStrictEqual([...spawned].sort(), names)
    })

    it('samples without replacement according to relative weights', () => {
        const spawned: string[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 2,
            forwardTrafficVehicleCount: 1,
            random: () => 0.9,
            weight: (model) => (model.name === 'race' ? 9 : 1),
            createVehicle: (model) => {
                spawned.push(model.name)
                return { object: new Group(), beaconLights: [] }
            }
        })

        simulation.start(straightPath(), straightPath(10, 0), [
            vehicleModel('sedan'),
            vehicleModel('race'),
            vehicleModel('van')
        ])

        assert.strictEqual(spawned[0], 'race')
        assert.deepStrictEqual([...spawned].sort(), ['race', 'sedan', 'van'])
    })

    it('reshuffles the deck when there are more vehicles than models', () => {
        const names = ['sedan', 'taxi']
        const spawned: string[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 2,
            forwardTrafficVehicleCount: 2,
            random: () => 0.5,
            createVehicle: (model) => {
                spawned.push(model.name)
                return { object: new Group(), beaconLights: [] }
            }
        })

        simulation.start(straightPath(), straightPath(10, 0), names.map(vehicleModel))

        assert.deepStrictEqual(spawned.slice(0, 2).sort(), names)
        assert.deepStrictEqual(spawned.slice(2).sort(), names)
    })

    it('reuses the same vehicle objects when they reach the end of their path', () => {
        const { scene, created, simulation } = createSetup()
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        // The vehicles start at progress 0.5; this update pushes them past 1.
        simulation.update(3)

        assert.strictEqual(scene.children.length, 2)
        assert.strictEqual(created.length, 2)
        // Both restarted at progress 0: the reverse path starts at z=10.
        assert.deepStrictEqual(
            created.map((vehicle) => vehicle.position.z).sort((a, b) => a - b),
            [0, 10]
        )
    })
})
