import { Group, Object3D, PointLight, Scene, Vector3 } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { emergencyBeaconPlacements } from '../data/lights'
import type { TrafficVehicleModel } from '../data/models'
import { getTrafficVehicleSpeed, getTrafficVehicleWeight } from '../data/vehicles'
import { vehicleYOffset } from './vehicleConstants'
import { getLanePosition, getTurnaroundPose, type RoadPath } from './vehiclePath'
import { hasHeadlights } from './vehicleLights'

const blinkIntervalSeconds = 0.5
const defaultMinimumGap = 1
const defaultAmbulanceSpeed = 2
const followGain = 1
const yieldDistance = 4
const speedJitter = 0.1
const maxStepDuration = 1 / 30

export type LoadedTrafficVehicleModel = TrafficVehicleModel & {
    model: GLTF
}

export type PreparedVehicle = {
    object: Group
    // Optional so simple test doubles can omit it; the real factory separates
    // the swappable GLB clone from the light-bearing object.
    visual?: Object3D
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
    minimumGap?: number
    speed?: (model: LoadedTrafficVehicleModel) => number
    ambulanceSpeed?: number
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
    desiredSpeed: number
    actualSpeed: number
    modelName: string
    lightSignature: string
}

type Leader = {
    gap: number
    speed: number
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

/** Counts the lights `prepareVehicle` would attach: 2 spotlights for cars with
 * headlight materials, plus the initially visible beacon point lights. Swapping
 * models with the same signature keeps Three.js's shader cache key unchanged. */
function getLightSignature(model: LoadedTrafficVehicleModel): string {
    const spotLights = hasHeadlights(model.model.scene) ? 2 : 0
    const pointLights = (emergencyBeaconPlacements[model.name] ?? []).filter(
        (placement) => placement.initiallyVisible
    ).length
    return `${pointLights}:${spotLights}`
}

function buildModelGroups(models: readonly LoadedTrafficVehicleModel[]): Map<string, LoadedTrafficVehicleModel[]> {
    const groups = new Map<string, LoadedTrafficVehicleModel[]>()
    for (const model of models) {
        const signature = getLightSignature(model)
        const group = groups.get(signature) ?? []
        group.push(model)
        groups.set(signature, group)
    }
    return groups
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
    const weighted = items.map((item) => ({ item, weight: Math.max(0, weight(item)) }))
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
    if (total <= 0) return weighted[0].item

    let pick = random() * total
    for (const entry of weighted) {
        pick -= entry.weight
        if (pick < 0) return entry.item
    }
    return weighted[weighted.length - 1].item
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

/** Progress at which a vehicle is clear of the others on its path. A vehicle
 * that would land within `minimumGap` of another is nudged just ahead of it;
 * moving past one vehicle can bring us too close to the next, hence the repeat. */
function clearProgress(path: RoadPath, progress: number, occupied: number[], minimumGap: number): number {
    const gapProgress = minimumGap / path.getLength()
    let candidate = progress

    for (let pass = 0; pass < occupied.length; pass++) {
        let moved = false
        for (const other of occupied) {
            if (Math.abs(other - candidate) < gapProgress) {
                candidate = other + gapProgress
                moved = true
            }
        }
        if (!moved) break
    }

    // A path too short to fit every vehicle must not push one past the end.
    return Math.min(candidate, 1)
}

/** A follower may close on its leader until the gap reaches the minimum, then
 * it matches the leader's speed so the gap stops shrinking. */
function capSpeed(desired: number, leader: Leader | undefined, minimumGap: number): number {
    if (!leader) return desired
    return Math.max(0, Math.min(desired, leader.speed + (leader.gap - minimumGap) * followGain))
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
        weight = (model) => getTrafficVehicleWeight(model.name),
        minimumGap = defaultMinimumGap,
        ambulanceSpeed = defaultAmbulanceSpeed,
        speed = (model) => getTrafficVehicleSpeed(model.name) * (1 - speedJitter + 2 * speedJitter * random())
    } = options

    let ambulance: Group | undefined
    let ambulanceBeaconLights: PointLight[] = []
    const parkedBeaconLights: PointLight[] = []
    let centerPath: RoadPath | undefined
    let reversePath: RoadPath | undefined
    let vehicleModels: LoadedTrafficVehicleModel[] = []
    let modelDeck: LoadedTrafficVehicleModel[] = []
    let modelGroups = new Map<string, LoadedTrafficVehicleModel[]>()
    let ambulanceProgress = 0
    let ambulanceReturning = false
    let ambulanceTurnProgress: number | undefined
    let blinkElapsed = 0

    const trafficVehicles: TrafficVehicle[] = []

    function nextModel(): LoadedTrafficVehicleModel {
        if (modelDeck.length === 0) modelDeck = weightedDeck(vehicleModels, weight, random)
        const model = modelDeck.shift()
        if (!model) throw new Error('No traffic vehicle models available')
        return model
    }

    function spawnVehicle(path: RoadPath, progress: number): TrafficVehicle {
        const model = nextModel()
        const vehicle = createVehicle(model)
        scene.add(vehicle.object)
        const desiredSpeed = speed(model)
        return {
            ...vehicle,
            path,
            progress,
            desiredSpeed,
            actualSpeed: desiredSpeed,
            modelName: model.name,
            lightSignature: getLightSignature(model)
        }
    }

    // During a U-turn the ambulance is already heading into the other lane.
    function ambulanceLane(): RoadPath | undefined {
        if (!centerPath || !reversePath) return centerPath
        return ambulanceReturning !== (ambulanceTurnProgress !== undefined) ? reversePath : centerPath
    }

    function trafficOnPath(path: RoadPath, except?: TrafficVehicle): number[] {
        return trafficVehicles
            .filter((vehicle) => vehicle !== except && vehicle.path === path)
            .map((vehicle) => vehicle.progress)
    }

    function ambulanceBlockers(path: RoadPath): number[] {
        if (!ambulance || ambulanceLane() !== path) return []
        // While turning, the ambulance sits at the start of the destination lane.
        return [ambulanceTurnProgress === undefined ? ambulanceProgress : 0]
    }

    /** The U-turn ends at the start of the other lane; make sure that spot is
     * clear for the whole turn, not just when the ambulance finishes it. */
    function clearAmbulanceExit(participants: Participant[]): void {
        const path = ambulanceLane()
        if (!path) return

        const gapProgress = minimumGap / path.getLength()
        const lane = participants.filter((participant) => participant.vehicle && participant.path === path)
        const near = lane
            .filter((participant) => participant.progress < gapProgress)
            .sort((a, b) => b.progress - a.progress)
        const occupied = lane
            .filter((participant) => !near.includes(participant))
            .map((participant) => participant.progress)

        for (const participant of near) {
            participant.progress = clearProgress(path, gapProgress, occupied, minimumGap)
            if (participant.vehicle) participant.vehicle.progress = participant.progress
            occupied.push(participant.progress)
        }
    }

    function respawnVehicle(vehicle: TrafficVehicle): void {
        // Reuse the same object and lights: adding/removing lights changes the
        // shader program cache key and freezes the page on recompilation. Only
        // the GLB clone is replaced, and only by a model with the same signature.
        // Draw from the whole signature group, including the current model: a
        // self-loop keeps the stationary distribution equal to `weight`, whereas
        // excluding it forces alternation in two-model groups and skews rarities.
        const candidates = modelGroups.get(vehicle.lightSignature) ?? []
        if (vehicle.visual && candidates.length > 0) {
            const replacement = pickWeighted(candidates, weight, random)
            if (replacement.name !== vehicle.modelName) {
                const visual = replacement.model.scene.clone()
                visual.position.copy(vehicle.visual.position)
                visual.rotation.copy(vehicle.visual.rotation)
                visual.scale.copy(vehicle.visual.scale)
                vehicle.visual.removeFromParent()
                vehicle.object.add(visual)
                vehicle.visual = visual
                vehicle.modelName = replacement.name
                const desiredSpeed = speed(replacement)
                vehicle.desiredSpeed = desiredSpeed
                vehicle.actualSpeed = desiredSpeed
            }
        }

        vehicle.progress = clearProgress(
            vehicle.path,
            0,
            [...trafficOnPath(vehicle.path, vehicle), ...ambulanceBlockers(vehicle.path)],
            minimumGap
        )
    }

    // The path the ambulance is driving on; during a U-turn this is the path it
    // is leaving (getTurnaroundPose needs the origin path).
    function ambulanceDrivingPath(): RoadPath | undefined {
        if (!centerPath || !reversePath) return undefined
        return !isShowcase && ambulanceReturning ? reversePath : centerPath
    }

    type Participant = {
        path: RoadPath
        progress: number
        desiredSpeed: number
        actualSpeed: number
        vehicle?: TrafficVehicle
    }

    function advanceAmbulanceTurn(deltaTime: number): void {
        if (!ambulance) return
        const path = ambulanceDrivingPath() ?? centerPath
        if (!path) return

        ambulanceTurnProgress = (ambulanceTurnProgress ?? 0) + (ambulanceSpeed * deltaTime) / (Math.PI * laneOffset)
        applyPose(ambulance, getTurnaroundPose(path, Math.min(ambulanceTurnProgress, 1), laneOffset))

        if (ambulanceTurnProgress >= 1) {
            ambulanceTurnProgress = undefined
            ambulanceReturning = !ambulanceReturning
            const nextPath = ambulanceLane()
            ambulanceProgress = nextPath ? clearProgress(nextPath, 0, trafficOnPath(nextPath), minimumGap) : 0
        }
    }

    function updateMovement(deltaTime: number): void {
        if (!centerPath || !reversePath) return

        // Place finished vehicles before computing speeds so their followers
        // see the new position in the same sub-step.
        for (const vehicle of trafficVehicles) {
            if (vehicle.progress >= 1) respawnVehicle(vehicle)
        }

        const participants: Participant[] = []

        if (ambulance && ambulanceTurnProgress !== undefined) {
            advanceAmbulanceTurn(deltaTime)
        } else if (ambulance) {
            const path = ambulanceDrivingPath() ?? centerPath
            if (path) {
                participants.push({
                    path,
                    progress: ambulanceProgress,
                    desiredSpeed: ambulanceSpeed,
                    actualSpeed: ambulanceSpeed
                })
            }
        }

        for (const vehicle of trafficVehicles) {
            participants.push({
                path: vehicle.path,
                progress: vehicle.progress,
                desiredSpeed: vehicle.desiredSpeed,
                actualSpeed: vehicle.desiredSpeed,
                vehicle
            })
        }

        // Traffic just ahead of the ambulance gets out of its way.
        const follower = participants.find((participant) => !participant.vehicle)
        if (follower) {
            for (const participant of participants) {
                if (!participant.vehicle || participant.path !== follower.path) continue
                const gap = (participant.progress - follower.progress) * participant.path.getLength()
                if (gap > 0 && gap <= yieldDistance) {
                    participant.desiredSpeed = Math.max(participant.desiredSpeed, follower.desiredSpeed)
                }
            }
        }

        // A follower may only go as fast as its leader plus the slack needed to
        // close the gap down to the minimum. Process front-to-back so each
        // follower sees its leader's final speed for this step.
        for (const path of [centerPath, reversePath]) {
            const lane = participants
                .filter((participant) => participant.path === path)
                .sort((a, b) => b.progress - a.progress)
            for (let index = 0; index < lane.length; index++) {
                const current = lane[index]
                const ahead = index > 0 ? lane[index - 1] : undefined
                const leader = ahead
                    ? { gap: (ahead.progress - current.progress) * path.getLength(), speed: ahead.actualSpeed }
                    : undefined
                current.actualSpeed = capSpeed(current.desiredSpeed, leader, minimumGap)
            }
        }

        for (const participant of participants) {
            const path = participant.path
            participant.progress += (participant.actualSpeed * deltaTime) / path.getLength()

            if (participant.vehicle) {
                const vehicle = participant.vehicle
                vehicle.actualSpeed = participant.actualSpeed
                vehicle.progress = participant.progress
                applyPose(vehicle.object, getLanePosition(path, Math.min(vehicle.progress, 1), laneOffset))
            } else if (ambulance) {
                ambulanceProgress = participant.progress
                if (ambulanceProgress >= 1) {
                    if (isShowcase) {
                        ambulanceProgress %= 1
                    } else {
                        ambulanceProgress = 1
                        ambulanceTurnProgress = 0
                        clearAmbulanceExit(participants)
                    }
                }
                applyPose(ambulance, getLanePosition(path, ambulanceProgress, laneOffset))
            }
        }
    }

    function updateBeacons(deltaTime: number): void {
        blinkElapsed += deltaTime
        const intervals = Math.floor(blinkElapsed / blinkIntervalSeconds)
        if (intervals === 0) return

        blinkElapsed -= intervals * blinkIntervalSeconds
        // A long frame can span several intervals; only an odd count flips state.
        if (intervals % 2 === 0) return

        toggleBeacons(ambulanceBeaconLights)
        toggleBeacons(parkedBeaconLights)
        for (const vehicle of trafficVehicles) {
            toggleBeacons(vehicle.beaconLights)
        }
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
            modelGroups = buildModelGroups(models)

            // Keep progress 0 on both paths clear for the ambulance.
            for (let index = 0; index < reverseTrafficVehicleCount; index++) {
                const progress = (index + 1) / (reverseTrafficVehicleCount + 1)
                trafficVehicles.push(
                    spawnVehicle(reverse, clearProgress(reverse, progress, trafficOnPath(reverse), minimumGap))
                )
            }
            for (let index = 0; index < forwardTrafficVehicleCount; index++) {
                const progress = (index + 1) / (forwardTrafficVehicleCount + 1)
                trafficVehicles.push(
                    spawnVehicle(center, clearProgress(center, progress, trafficOnPath(center), minimumGap))
                )
            }
        },
        update(deltaTime: number): void {
            // Sub-step so the speed caps keep the minimum gap even on a long frame.
            const steps = Math.max(1, Math.ceil(deltaTime / maxStepDuration))
            const step = deltaTime / steps
            for (let index = 0; index < steps; index++) updateMovement(step)
            updateBeacons(deltaTime)
        }
    }
}
