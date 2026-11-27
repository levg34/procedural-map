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

    it('blinks every beacon on a fixed time interval', () => {
        const vehicleBeacon = new PointLight()
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 1,
            forwardTrafficVehicleCount: 0,
            createVehicle: () => ({ object: new Group(), beaconLights: [vehicleBeacon] })
        })
        const ambulanceBeacon = new PointLight()
        const parkedBeacon = new PointLight()
        simulation.setAmbulance(new Group(), [ambulanceBeacon])
        simulation.addParkedBeaconLights([parkedBeacon])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        simulation.update(0.25)
        assert.strictEqual(ambulanceBeacon.visible, true)
        assert.strictEqual(parkedBeacon.visible, true)
        assert.strictEqual(vehicleBeacon.visible, true)

        simulation.update(0.25)
        assert.strictEqual(ambulanceBeacon.visible, false)
        assert.strictEqual(parkedBeacon.visible, false)
        assert.strictEqual(vehicleBeacon.visible, false)
    })

    it('blinks at the same rate regardless of the number of updates', () => {
        const { simulation } = createSetup()
        const beacon = new PointLight()
        simulation.setAmbulance(new Group(), [beacon])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        for (let index = 0; index < 4; index++) simulation.update(1 / 8)

        assert.strictEqual(beacon.visible, false)
    })

    it('preserves blink phase when a frame spans multiple intervals', () => {
        const { simulation } = createSetup()
        const beacon = new PointLight()
        simulation.setAmbulance(new Group(), [beacon])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        simulation.update(1)
        assert.strictEqual(beacon.visible, true)

        simulation.update(0.5)
        assert.strictEqual(beacon.visible, false)
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

    it('keeps traffic vehicles clear of each other over many laps', () => {
        const minimumGap = 1
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 3,
            forwardTrafficVehicleCount: 2,
            minimumGap,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        let closest = Infinity
        for (let step = 0; step < 60 * 120; step++) {
            simulation.update(1 / 60)
            for (let first = 0; first < created.length; first++) {
                for (let second = first + 1; second < created.length; second++) {
                    if (Math.sign(created[first].position.x) !== Math.sign(created[second].position.x)) continue
                    closest = Math.min(closest, Math.abs(created[first].position.z - created[second].position.z))
                }
            }
        }

        assert.ok(closest >= minimumGap - 0.05, `closest traffic-to-traffic gap was ${closest}`)
    })

    it('keeps vehicles on the path even when it is too short for the gap', () => {
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 8,
            forwardTrafficVehicleCount: 4,
            minimumGap: 1,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        simulation.start(straightPath(0, 2), straightPath(2, 0), [vehicleModel('car')])

        for (let step = 0; step < 60 * 10; step++) simulation.update(1 / 60)

        assert.ok(created.every((object) => object.position.z >= 0 && object.position.z <= 2))
    })

    it('keeps the ambulance clear of traffic over many laps', () => {
        const minimumGap = 1
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 2,
            forwardTrafficVehicleCount: 2,
            minimumGap,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        const ambulance = new Group()
        simulation.setAmbulance(ambulance, [])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        let closest = Infinity
        for (let step = 0; step < 60 * 120; step++) {
            simulation.update(1 / 60)

            // Driving lanes are encoded in x; skip the U-turn frames where x sweeps.
            if (Math.abs(Math.abs(ambulance.position.x) - laneOffset) > 1e-6) continue
            for (const vehicle of created) {
                if (Math.sign(vehicle.position.x) !== Math.sign(ambulance.position.x)) continue
                closest = Math.min(closest, Math.abs(ambulance.position.z - vehicle.position.z))
            }
        }

        assert.ok(closest >= minimumGap - 0.05, `closest ambulance-to-traffic gap was ${closest}`)
    })

    it('moves each vehicle at its own speed', () => {
        const speeds = [1, 3]
        let nextSpeed = 0
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 2,
            speed: () => speeds[nextSpeed++] ?? 1,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        simulation.update(1)

        assert.ok(doubleEquals(created[0]?.position.z ?? -1, 10 / 3 + 1))
        assert.ok(doubleEquals(created[1]?.position.z ?? -1, 20 / 3 + 3))
    })

    it('keeps a fast follower behind a slow leader', () => {
        const minimumGap = 1
        const speeds = [3, 0.5, 3]
        let nextSpeed = 0
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 3,
            minimumGap,
            speed: () => speeds[nextSpeed++] ?? 1,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('car')])

        let closest = Infinity
        for (let step = 0; step < 60 * 60; step++) {
            simulation.update(1 / 60)
            const z = created.map((object) => object.position.z).sort((a, b) => a - b)
            for (let index = 1; index < z.length; index++) {
                closest = Math.min(closest, z[index] - z[index - 1])
            }
        }

        assert.ok(closest >= minimumGap - 0.05, `closest traffic-to-traffic gap was ${closest}`)
    })

    it('lets traffic just ahead of the ambulance yield', () => {
        const created: Group[] = []
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 0.5,
            ambulanceSpeed: 2,
            createVehicle: () => {
                const object = new Group()
                created.push(object)
                return { object, beaconLights: [] }
            }
        })
        const ambulance = new Group()
        simulation.setAmbulance(ambulance, [])
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('tractor')])

        simulation.update(3)

        // Without yielding the ambulance would be capped at the tractor's pace.
        assert.ok(ambulance.position.z > 5.5, `ambulance reached only z=${ambulance.position.z}`)
    })

    it('reuses the same vehicle objects when they reach the end of their path', () => {
        const { scene, created, simulation } = createSetup({ speed: () => 5 })
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

    it('swaps only the visual clone on respawn when light configs match', () => {
        const sedan = vehicleModel('sedan')
        sedan.model.scene.name = 'sedan'
        const van = vehicleModel('van')
        van.model.scene.name = 'van'
        let vehicleObject: Group | undefined
        let beacon: PointLight | undefined
        let randomCalls = 0
        const { scene, simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 5,
            // The first two draws build the initial deck (sedan, van); the
            // third picks van from the full group at respawn.
            random: () => (randomCalls++ < 2 ? 0 : 0.5),
            weight: () => 1,
            createVehicle: (model) => {
                const object = new Group()
                const visual = new Group()
                visual.name = model.name
                object.add(visual)
                vehicleObject = object
                beacon = new PointLight()
                object.add(beacon)
                return { object, visual, beaconLights: [beacon] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [sedan, van])

        const firstBeacon = beacon
        const visualNames = (): string[] =>
            (vehicleObject?.children ?? [])
                .filter((child): child is Group => child instanceof Group)
                .map((child) => child.name)
        assert.deepStrictEqual(visualNames(), ['sedan'])

        // Just long enough to cross the end once and respawn a single time.
        simulation.update(1.05)

        assert.deepStrictEqual(visualNames(), ['van'])
        assert.strictEqual(firstBeacon?.parent, scene.children[0])
        assert.strictEqual(scene.children[0]?.children.filter((child) => child instanceof PointLight).length, 1)
    })

    it('preserves configured weights across respawns instead of alternating', () => {
        const sedan = vehicleModel('sedan')
        sedan.model.scene.name = 'sedan'
        const van = vehicleModel('van')
        van.model.scene.name = 'van'
        const weights: Record<string, number> = { sedan: 19, van: 1 }
        let vehicleObject: Group | undefined
        let randomCalls = 0
        // Initial deck: sedan, van. Then one draw per respawn below.
        const randomValues = [0, 0, 0.5, 0.99, 0.99, 0.5]
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 5,
            weight: (model) => weights[model.name] ?? 1,
            random: () => randomValues[randomCalls++] ?? 0.5,
            createVehicle: (model) => {
                const object = new Group()
                const visual = new Group()
                visual.name = model.name
                object.add(visual)
                vehicleObject = object
                return { object, visual, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [sedan, van])

        const visualName = (): string | undefined =>
            vehicleObject?.children.find((child): child is Group => child instanceof Group)?.name

        assert.strictEqual(visualName(), 'sedan')

        // sedan holds 19/20 of the group: an ordinary draw keeps it.
        simulation.update(2)
        assert.strictEqual(visualName(), 'sedan')

        // Only a draw above 19/20 switches to the rare model.
        simulation.update(2)
        assert.strictEqual(visualName(), 'van')

        // van holds 1/20: it needs a draw in that last slice to stay van.
        simulation.update(2)
        assert.strictEqual(visualName(), 'van')

        // A typical draw sends it back to the common model.
        simulation.update(2)
        assert.strictEqual(visualName(), 'sedan')
    })

    it('does not swap police and tractorPolice because their light rigs differ', () => {
        let vehicleObject: Group | undefined
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 5,
            random: () => 0,
            createVehicle: (model) => {
                const object = new Group()
                const visual = new Group()
                visual.name = model.name
                object.add(visual)
                vehicleObject = object
                return { object, visual, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('police'), vehicleModel('tractorPolice')])

        const visualName = (): string | undefined =>
            vehicleObject?.children.find((child): child is Group => child instanceof Group)?.name

        assert.strictEqual(visualName(), 'police')

        // Previously both shared a 1:2 signature and were forced to alternate.
        simulation.update(1.05)

        assert.strictEqual(visualName(), 'police')
    })

    it('does not swap ambulance and firetruck because their light rigs differ', () => {
        let vehicleObject: Group | undefined
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 5,
            random: () => 0,
            createVehicle: (model) => {
                const object = new Group()
                const visual = new Group()
                visual.name = model.name
                object.add(visual)
                vehicleObject = object
                return { object, visual, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('ambulance'), vehicleModel('firetruck')])

        const visualName = (): string | undefined =>
            vehicleObject?.children.find((child): child is Group => child instanceof Group)?.name

        assert.strictEqual(visualName(), 'ambulance')

        // Previously both shared a 2:2 signature and could swap lightbars.
        simulation.update(1.05)

        assert.strictEqual(visualName(), 'ambulance')
    })

    it('keeps the visual when no other model shares its light config', () => {
        let vehicleObject: Group | undefined
        const { simulation } = createSetup({
            reverseTrafficVehicleCount: 0,
            forwardTrafficVehicleCount: 1,
            speed: () => 5,
            createVehicle: (model) => {
                const object = new Group()
                const visual = new Group()
                visual.name = model.name
                object.add(visual)
                vehicleObject = object
                return { object, visual, beaconLights: [] }
            }
        })
        simulation.start(straightPath(), straightPath(10, 0), [vehicleModel('sedan'), vehicleModel('police')])

        const visualNames = (): string[] =>
            (vehicleObject?.children ?? [])
                .filter((child): child is Group => child instanceof Group)
                .map((child) => child.name)
        assert.deepStrictEqual(visualNames(), ['sedan'])

        simulation.update(1.05)

        assert.deepStrictEqual(visualNames(), ['sedan'])
    })
})
