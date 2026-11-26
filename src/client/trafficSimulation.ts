import { Group, PointLight, Scene, Vector3 } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { TrafficVehicleModel } from '../data/models'
import { getTrafficVehicleWeight } from '../data/vehicles'
import { getLanePosition, getTurnaroundPose, type RoadPath } from './vehiclePath'

const vehicleYOffset = 0.02
const blinkInterval = 30

export type LoadedTrafficVehicleModel = TrafficVehicleModel & {
    model: GLTF
}

export type PreparedVehicle = {
    object: Group
    beaconLights: PointLight[]
}

export type VehicleFactory = (model: LoadedTrafficVehicleModel) => PreparedVehicle

export type TrafficSimulationOptions = {
    scene: Scene
    laneOffset: number
    isShowcase: boolean
    reverseTrafficVehicleCount: number
    forwardTrafficVehicleCount: number
    createVehicle: VehicleFactory
    random?: () => number
    weight?: (model: LoadedTrafficVehicleModel) => number
}

export type TrafficSimulation = {
    setAmbulance(vehicle: Group, beaconLights: PointLight[]): void
    addParkedBeaconLights(lights: PointLight[]): void
    start(centerPath: RoadPath, reversePath: RoadPath, vehicleModels: LoadedTrafficVehicleModel[]): void
    update(deltaTime: number): void
}

type TrafficVehicle = PreparedVehicle & {
    path: RoadPath
    progress: number
}

type Pose = {
    position: Vector3
    tangent: Vector3
}

function applyPose(object: Group, pose: Pose): void {
    object.position.copy(pose.position)
    object.position.y += vehicleYOffset
    object.rotation.y = Math.atan2(-pose.tangent.x, -pose.tangent.z)
}

function toggleBeacons(lights: PointLight[]): void {
    for (const light of lights) {
        light.visible = !light.visible
    }
}

/** Weighted sampling without replacement: every pick is proportional to the
 * remaining items' weights, and a model can never occupy two lanes. */
function weightedDeck<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T[] {
    const remaining = items.map((item) => ({ item, weight: Math.max(0, weight(item)) }))
    const deck: T[] = []

    while (remaining.length > 0) {
        const total = remaining.reduce((sum, entry) => sum + entry.weight, 0)
        if (total <= 0) {
            deck.push(...remaining.map((entry) => entry.item))
            break
        }

        let pick = random() * total
        let index = 0
        while (index < remaining.length - 1 && pick >= remaining[index].weight) {
            pick -= remaining[index].weight
            index++
        }

        deck.push(remaining[index].item)
        remaining.splice(index, 1)
    }

    return deck
}

export function createTrafficSimulation(options: TrafficSimulationOptions): TrafficSimulation {
    const {
        scene,
        laneOffset,
        isShowcase,
        reverseTrafficVehicleCount,
        forwardTrafficVehicleCount,
        createVehicle,
        random = Math.random,
        weight = (model) => getTrafficVehicleWeight(model.name)
    } = options

    let ambulance: Group | undefined
    let ambulanceBeaconLights: PointLight[] = []
    const parkedBeaconLights: PointLight[] = []
    let centerPath: RoadPath | undefined
    let reversePath: RoadPath | undefined
    let vehicleModels: LoadedTrafficVehicleModel[] = []
    let modelDeck: LoadedTrafficVehicleModel[] = []
    let ambulanceProgress = 0
    let ambulanceReturning = false
    let ambulanceTurnProgress: number | undefined
    let blinkCounter = 0

    const trafficVehicles: TrafficVehicle[] = []

    function nextModel(): LoadedTrafficVehicleModel {
        if (modelDeck.length === 0) modelDeck = weightedDeck(vehicleModels, weight, random)
        const model = modelDeck.shift()
        if (!model) throw new Error('No traffic vehicle models available')
        return model
    }

    function spawnVehicle(path: RoadPath, progress: number): TrafficVehicle {
        const vehicle = createVehicle(nextModel())
        scene.add(vehicle.object)
        return { ...vehicle, path, progress }
    }

    function respawnVehicle(vehicle: TrafficVehicle): void {
        // Reuse the same object and lights: adding/removing lights changes the
        // shader program cache key and freezes the page on recompilation.
        vehicle.progress = 0
    }

    function updateAmbulance(deltaTime: number): void {
        if (!ambulance || !centerPath || !reversePath) return

        const path = !isShowcase && ambulanceReturning ? reversePath : centerPath
        let pose: Pose

        if (ambulanceTurnProgress === undefined) {
            const progressDelta = (2 * deltaTime) / path.getLength()
            ambulanceProgress += progressDelta
            if (ambulanceProgress >= 1) {
                if (isShowcase) {
                    ambulanceProgress %= 1
                } else {
                    ambulanceProgress = 1
                    ambulanceTurnProgress = 0
                }
            }
            pose = getLanePosition(path, ambulanceProgress, laneOffset)
        } else {
            ambulanceTurnProgress += (2 * deltaTime) / (Math.PI * laneOffset)
            pose = getTurnaroundPose(path, Math.min(ambulanceTurnProgress, 1), laneOffset)
            if (ambulanceTurnProgress >= 1) {
                ambulanceTurnProgress = undefined
                ambulanceReturning = !ambulanceReturning
                ambulanceProgress = 0
            }
        }

        applyPose(ambulance, pose)
    }

    function updateTraffic(deltaTime: number): void {
        for (const vehicle of trafficVehicles) {
            const path = vehicle.path
            const progressDelta = (2 * deltaTime) / path.getLength()
            vehicle.progress += progressDelta
            if (vehicle.progress >= 1) respawnVehicle(vehicle)

            applyPose(vehicle.object, getLanePosition(path, vehicle.progress, laneOffset))
        }
    }

    function updateBeacons(): void {
        blinkCounter++
        if (blinkCounter < blinkInterval) return

        toggleBeacons(ambulanceBeaconLights)
        toggleBeacons(parkedBeaconLights)
        for (const vehicle of trafficVehicles) {
            toggleBeacons(vehicle.beaconLights)
        }
        blinkCounter = 0
    }

    return {
        setAmbulance(vehicle: Group, beaconLights: PointLight[]): void {
            ambulance = vehicle
            ambulanceBeaconLights = beaconLights
        },
        addParkedBeaconLights(lights: PointLight[]): void {
            parkedBeaconLights.push(...lights)
        },
        start(center: RoadPath, reverse: RoadPath, models: LoadedTrafficVehicleModel[]): void {
            centerPath = center
            reversePath = reverse
            vehicleModels = models

            // Keep progress 0 on both paths clear for the ambulance.
            for (let index = 0; index < reverseTrafficVehicleCount; index++) {
                trafficVehicles.push(spawnVehicle(reverse, (index + 1) / (reverseTrafficVehicleCount + 1)))
            }
            for (let index = 0; index < forwardTrafficVehicleCount; index++) {
                trafficVehicles.push(spawnVehicle(center, (index + 1) / (forwardTrafficVehicleCount + 1)))
            }
        },
        update(deltaTime: number): void {
            updateAmbulance(deltaTime)
            updateBeacons()
            updateTraffic(deltaTime)
        }
    }
}
