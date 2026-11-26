import {
    AmbientLight,
    DirectionalLight,
    Object3D,
    PerspectiveCamera,
    PointLight,
    Scene,
    SpotLight,
    Vector3,
    WebGLRenderer,
    type Group
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import {
    getRoad,
    getRoadParts,
    getRoadShowcase,
    getTrafficVehicleModels,
    type RoadModel,
    type RoadSegment,
    type TrafficVehicleModel
} from './data'
import { createGrassGround } from './ground'
import { createRoadCenterPath, getLanePosition, getTurnaroundPose } from './vehiclePath'

const isShowcase = window.location.pathname === '/showcase'
const reverseTrafficVehicleCount = isShowcase ? 1 : 8
const forwardTrafficVehicleCount = isShowcase ? 0 : 4
const laneOffset = 0.16

type LoadedRoadModel = RoadModel & {
    model: GLTF
}

type LoadedTrafficVehicleModel = TrafficVehicleModel & {
    model: GLTF
}

type TrafficVehicle = {
    object: Group
    path: ReturnType<typeof createRoadCenterPath>
    progress: number
    beaconLights: PointLight[]
}

type HeadlightPlacement = {
    halfWidth: number
    height: number
    frontZ: number
}

type BeaconLightPlacement = {
    x: number
    y: number
    z: number
    color: number
    initiallyVisible: boolean
}

const headlightPlacements: Record<string, HeadlightPlacement> = {
    ambulance: { halfWidth: 0.42, height: 0.65, frontZ: -1.55 },
    firetruck: { halfWidth: 0.35, height: 0.84, frontZ: -1.43 },
    police: { halfWidth: 0.45, height: 0.55, frontZ: -1.32 },
    tractorPolice: { halfWidth: 0.445, height: 0.62, frontZ: -0.91 }
}

const defaultHeadlightPlacement: HeadlightPlacement = {
    halfWidth: 0.45,
    height: 0.35,
    frontZ: -1.35
}

const ambulanceBeaconPlacements: BeaconLightPlacement[] = [
    { x: -0.31, y: 1.73, z: 1.45, color: 0x0e45ea, initiallyVisible: true },
    { x: 0.31, y: 1.73, z: 1.45, color: 0x0e45ea, initiallyVisible: false },
    { x: -0.31, y: 1.43, z: -0.75, color: 0x0e45ea, initiallyVisible: true },
    { x: 0.31, y: 1.43, z: -0.75, color: 0x0e45ea, initiallyVisible: false }
]

const emergencyBeaconPlacements: Record<string, BeaconLightPlacement[]> = {
    ambulance: ambulanceBeaconPlacements,
    firetruck: [
        { x: -0.28, y: 1.63, z: -1.21, color: 0x0e45ea, initiallyVisible: true },
        { x: 0.28, y: 1.63, z: -1.21, color: 0x0e45ea, initiallyVisible: false },
        { x: -0.28, y: 1.73, z: 1.5, color: 0x0e45ea, initiallyVisible: true },
        { x: 0.28, y: 1.73, z: 1.5, color: 0x0e45ea, initiallyVisible: false }
    ],
    police: [
        { x: -0.245, y: 1.33, z: -0.15, color: 0xff3030, initiallyVisible: true },
        { x: 0.245, y: 1.33, z: -0.15, color: 0x0e45ea, initiallyVisible: false }
    ],
    tractorPolice: [
        { x: -0.225, y: 1.59, z: 0.16, color: 0xff3030, initiallyVisible: true },
        { x: 0.225, y: 1.59, z: 0.16, color: 0x0e45ea, initiallyVisible: false }
    ]
}

const models: {
    road: LoadedRoadModel[]
    index?: number
    current?: Object3D
} = {
    road: []
}

const scene = new Scene()
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(5, 5, 5)

const renderer = new WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)

scene.add(new AmbientLight(0x404040))
scene.add(new DirectionalLight(0xffffff, 0.5))

const loadModel = (url: string): Promise<GLTF> => {
    const loader = new GLTFLoader()

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            resolve,
            (event) => {
                console.log(`${(event.loaded / event.total) * 100}% loaded`)
            },
            reject
        )
    })
}

let ambulance: Group | undefined
let ambulanceBeaconLights: PointLight[] = []
let trafficVehicleModels: LoadedTrafficVehicleModel[] = []
const trafficVehicles: TrafficVehicle[] = []
let lastTrafficVehicleModelName: string | undefined
let roadCenterPath: ReturnType<typeof createRoadCenterPath> | undefined
let reverseRoadPath: ReturnType<typeof createRoadCenterPath> | undefined
let ambulanceProgress = 0
let ambulanceReturning = false
let ambulanceTurnProgress: number | undefined

async function initializeAmbulance(): Promise<void> {
    try {
        const gltf = await loadModel('/model/cars/ambulance.glb')
        ambulance = gltf.scene
        ambulance.scale.set(0.2, 0.2, 0.2)
        addHeadlights(ambulance, headlightPlacements.ambulance)
        ambulanceBeaconLights = addBeaconLights(ambulance, ambulanceBeaconPlacements)
        scene.add(ambulance)
    } catch (error: unknown) {
        console.error('Failed to load ambulance model:', error)
    }
}

function addHeadlights(vehicle: Group, placement: HeadlightPlacement = defaultHeadlightPlacement): void {
    for (const x of [-placement.halfWidth, placement.halfWidth]) {
        const target = new Object3D()
        target.position.set(x, placement.height - 0.1, -8)

        const light = new SpotLight(0xfff2d0, 8, 2.5, Math.PI / 7, 0.4, 2)
        light.position.set(x, placement.height, placement.frontZ)
        light.target = target
        vehicle.add(light, target)
    }
}

function addBeaconLights(vehicle: Group, placements: BeaconLightPlacement[]): PointLight[] {
    return placements.map((placement) => {
        const light = new PointLight(placement.color, 2, 5)
        light.position.set(placement.x, placement.y, placement.z)
        light.visible = placement.initiallyVisible
        vehicle.add(light)
        return light
    })
}

function toggleBeaconLights(lights: PointLight[]): void {
    lights.forEach((light) => {
        light.visible = !light.visible
    })
}

function createTrafficVehicle(path: ReturnType<typeof createRoadCenterPath>, progress: number): TrafficVehicle {
    const differentModels = trafficVehicleModels.filter((model) => model.name !== lastTrafficVehicleModelName)
    const candidates = differentModels.length > 0 ? differentModels : trafficVehicleModels
    const model = candidates[Math.floor(Math.random() * candidates.length)]
    if (!model) throw new Error('No traffic vehicle models available')

    const vehicle = model.model.scene.clone()
    vehicle.scale.set(0.2, 0.2, 0.2)
    addHeadlights(vehicle, headlightPlacements[model.name] ?? defaultHeadlightPlacement)
    const beaconLights = addBeaconLights(vehicle, emergencyBeaconPlacements[model.name] ?? [])
    scene.add(vehicle)
    lastTrafficVehicleModelName = model.name

    return { object: vehicle, path, progress, beaconLights }
}

function respawnTrafficVehicle(trafficVehicle: TrafficVehicle): void {
    scene.remove(trafficVehicle.object)
    const replacement = createTrafficVehicle(trafficVehicle.path, 0)
    trafficVehicle.object = replacement.object
    trafficVehicle.progress = replacement.progress
    trafficVehicle.beaconLights = replacement.beaconLights
}

void initializeAmbulance()

function loadRoadPreview(): void {
    if (models.road.length === 0) return

    const index = models.index
    if (index === undefined) return

    if (index > 0 && models.current) {
        scene.remove(models.current)
    }

    const roadElement = models.road[index]
    if (!roadElement) {
        models.index = 0
        loadRoadPreview()
        return
    }

    models.current = roadElement.model.scene
    scene.add(models.current)
    models.index = index + 1
}

async function initializeRoad(): Promise<void> {
    try {
        const [roadModels, availableTrafficModels, road] = await Promise.all([
            getRoadParts(),
            getTrafficVehicleModels(),
            isShowcase ? getRoadShowcase() : getRoad(10)
        ])
        const [loadedRoadModels, loadedTrafficModels] = await Promise.all([
            Promise.all(
                roadModels.map(async (roadModel) => ({
                    ...roadModel,
                    model: await loadModel(roadModel.url)
                }))
            ),
            Promise.all(
                availableTrafficModels.map(async (vehicleModel) => ({
                    ...vehicleModel,
                    model: await loadModel(vehicleModel.url)
                }))
            )
        ])
        models.road = loadedRoadModels
        trafficVehicleModels = loadedTrafficModels
        models.index = 0

        scene.add(createGrassGround(road))
        roadCenterPath = createRoadCenterPath(road)
        reverseRoadPath = createRoadCenterPath(road, true)
        // Keep progress 0 on both paths clear for the ambulance.
        for (let index = 0; index < reverseTrafficVehicleCount; index++) {
            trafficVehicles.push(createTrafficVehicle(reverseRoadPath, (index + 1) / (reverseTrafficVehicleCount + 1)))
        }
        for (let index = 0; index < forwardTrafficVehicleCount; index++) {
            trafficVehicles.push(createTrafficVehicle(roadCenterPath, (index + 1) / (forwardTrafficVehicleCount + 1)))
        }
        road.forEach((segment: RoadSegment) => {
            const roadModel = models.road.find((model) => segment.name === model.name)
            if (!roadModel) throw new Error(`Missing road model: ${segment.name}`)

            const roadPart = new Object3D()
            const roadPartModel = roadModel.model.scene.clone()
            roadPartModel.position.z = -0.75
            roadPart.add(roadPartModel)
            if (segment.rotation !== undefined) {
                roadPart.rotation.y = segment.rotation
            }
            roadPart.position.set(segment.position.x, segment.position.y, segment.position.z)
            scene.add(roadPart)
        })
    } catch (error: unknown) {
        console.error('Failed to initialize road:', error)
    }
}

void initializeRoad()

let iter = 0
let lastFrameTime = performance.now()
let previousAmbulancePosition: Vector3 | undefined
function animate(timestamp = performance.now()): void {
    requestAnimationFrame(animate)

    const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp

    if (ambulance && roadCenterPath && reverseRoadPath) {
        const path = !isShowcase && ambulanceReturning ? reverseRoadPath : roadCenterPath
        let ambulancePose: { position: Vector3; tangent: Vector3 }

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
            ambulancePose = getLanePosition(path, ambulanceProgress, laneOffset)
        } else {
            ambulanceTurnProgress += (2 * deltaTime) / (Math.PI * laneOffset)
            ambulancePose = getTurnaroundPose(path, Math.min(ambulanceTurnProgress, 1), laneOffset)
            if (ambulanceTurnProgress >= 1) {
                ambulanceTurnProgress = undefined
                ambulanceReturning = !ambulanceReturning
                ambulanceProgress = 0
            }
        }

        ambulance.position.copy(ambulancePose.position)
        ambulance.rotation.y = Math.atan2(-ambulancePose.tangent.x, -ambulancePose.tangent.z)
        ambulance.position.y += 0.02

        if (previousAmbulancePosition) {
            const movement = ambulance.position.clone().sub(previousAmbulancePosition)
            camera.position.add(movement)
            controls.target.add(movement)
        }
        previousAmbulancePosition = ambulance.position.clone()
    }

    if (iter === 30) {
        toggleBeaconLights(ambulanceBeaconLights)
        for (const trafficVehicle of trafficVehicles) {
            toggleBeaconLights(trafficVehicle.beaconLights)
        }
        iter = 0
    }
    iter++

    if (trafficVehicles.length > 0) {
        for (const trafficVehicle of trafficVehicles) {
            const path = trafficVehicle.path
            const progressDelta = (2 * deltaTime) / path.getLength()
            trafficVehicle.progress += progressDelta
            if (trafficVehicle.progress >= 1) respawnTrafficVehicle(trafficVehicle)

            const trafficPose = getLanePosition(path, trafficVehicle.progress, laneOffset)
            trafficVehicle.object.position.copy(trafficPose.position)
            trafficVehicle.object.position.y += 0.02
            trafficVehicle.object.rotation.y = Math.atan2(-trafficPose.tangent.x, -trafficPose.tangent.z)
        }
    }

    controls.update()
    renderer.render(scene, camera)
}

animate()

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') loadRoadPreview()
})

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
