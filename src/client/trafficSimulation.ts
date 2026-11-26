import { Group, PointLight, Scene, Vector3 } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { TrafficVehicleModel } from '../data/models'
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

export function createTrafficSimulation(options: TrafficSimulationOptions): TrafficSimulation {
    const { scene, laneOffset, isShowcase, reverseTrafficVehicleCount, forwardTrafficVehicleCount, createVehicle } =
        options

    let ambulance: Group | undefined
    let ambulanceBeaconLights: PointLight[] = []
    const parkedBeaconLights: PointLight[] = []
    let centerPath: RoadPath | undefined
    let reversePath: RoadPath | undefined
    let vehicleModels: LoadedTrafficVehicleModel[] = []
    let lastModelName: string | undefined
    let ambulanceProgress = 0
    let ambulanceReturning = false
    let ambulanceTurnProgress: number | undefined
    let blinkCounter = 0

    const trafficVehicles: TrafficVehicle[] = []

    function spawnVehicle(path: RoadPath, progress: number): TrafficVehicle {
        const differentModels = vehicleModels.filter((model) => model.name !== lastModelName)
        const candidates = differentModels.length > 0 ? differentModels : vehicleModels
        const model = candidates[Math.floor(Math.random() * candidates.length)]
        if (!model) throw new Error('No traffic vehicle models available')

        const vehicle = createVehicle(model)
        scene.add(vehicle.object)
        lastModelName = model.name
        return { ...vehicle, path, progress }
    }

    function respawnVehicle(vehicle: TrafficVehicle): void {
        scene.remove(vehicle.object)
        const replacement = spawnVehicle(vehicle.path, 0)
        vehicle.object = replacement.object
        vehicle.progress = replacement.progress
        vehicle.beaconLights = replacement.beaconLights
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
