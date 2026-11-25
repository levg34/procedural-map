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
    getRoadParts,
    getRoadShowcase,
    getTrafficVehicleModels,
    type RoadModel,
    type RoadSegment,
    type TrafficVehicleModel
} from './data'
import { createRoadCenterPath, getLanePosition } from './vehiclePath'

type LoadedRoadModel = RoadModel & {
    model: GLTF
}

type LoadedTrafficVehicleModel = TrafficVehicleModel & {
    model: GLTF
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
let headLight: PointLight | undefined
let headLight2: PointLight | undefined
let headLight3: PointLight | undefined
let headLight4: PointLight | undefined
let trafficVehicle: Group | undefined
let trafficVehicleModels: LoadedTrafficVehicleModel[] = []
let currentTrafficVehicleModelName: string | undefined
let roadCenterPath: ReturnType<typeof createRoadCenterPath> | undefined
let trafficRoadPath: ReturnType<typeof createRoadCenterPath> | undefined
let ambulanceProgress = 0
let trafficVehicleProgress = 0

async function initializeAmbulance(): Promise<void> {
    try {
        const gltf = await loadModel('/model/cars/ambulance.glb')
        ambulance = gltf.scene
        ambulance.scale.set(0.2, 0.2, 0.2)
        addHeadlights(ambulance, { halfWidth: 0.42, height: 0.65, frontZ: -1.55 })

        headLight = new PointLight(0x0e45ea, 2, 5)
        headLight.position.set(-0.4, 1.7, 1.45)
        headLight.visible = true
        ambulance.add(headLight)

        headLight2 = new PointLight(0x0e45ea, 2, 5)
        headLight2.position.set(0.4, 1.7, 1.45)
        headLight2.visible = false
        ambulance.add(headLight2)

        headLight3 = new PointLight(0x0e45ea, 2, 5)
        headLight3.position.set(-0.31, 1.43, -0.75)
        headLight3.visible = true
        ambulance.add(headLight3)

        headLight4 = new PointLight(0x0e45ea, 2, 5)
        headLight4.position.set(0.31, 1.43, -0.75)
        headLight4.visible = false
        ambulance.add(headLight4)

        scene.add(ambulance)
    } catch (error: unknown) {
        console.error('Failed to load ambulance model:', error)
    }
}

function addHeadlights(
    vehicle: Group,
    placement: { halfWidth: number; height: number; frontZ: number } = {
        halfWidth: 0.45,
        height: 0.35,
        frontZ: -1.35
    }
): void {
    for (const x of [-placement.halfWidth, placement.halfWidth]) {
        const target = new Object3D()
        target.position.set(x, placement.height - 0.1, -8)

        const light = new SpotLight(0xfff2d0, 8, 2.5, Math.PI / 7, 0.4, 2)
        light.position.set(x, placement.height, placement.frontZ)
        light.target = target
        vehicle.add(light, target)
    }
}

function spawnTrafficVehicle(): void {
    const differentModels = trafficVehicleModels.filter((model) => model.name !== currentTrafficVehicleModelName)
    const candidates = differentModels.length > 0 ? differentModels : trafficVehicleModels
    const model = candidates[Math.floor(Math.random() * candidates.length)]
    if (!model) throw new Error('No traffic vehicle models available')

    if (trafficVehicle) scene.remove(trafficVehicle)
    trafficVehicle = model.model.scene.clone()
    trafficVehicle.scale.set(0.2, 0.2, 0.2)
    addHeadlights(trafficVehicle)
    scene.add(trafficVehicle)
    currentTrafficVehicleModelName = model.name
    trafficVehicleProgress = 0
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
        const [roadModels, availableTrafficModels] = await Promise.all([getRoadParts(), getTrafficVehicleModels()])
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

        const road = await getRoadShowcase()
        roadCenterPath = createRoadCenterPath(road)
        trafficRoadPath = createRoadCenterPath(road, true)
        spawnTrafficVehicle()
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

    if (ambulance && headLight && headLight2 && headLight3 && headLight4 && roadCenterPath) {
        const progressDelta = (2 * deltaTime) / roadCenterPath.getLength()
        ambulanceProgress = (ambulanceProgress + progressDelta) % 1
        const ambulancePose = getLanePosition(roadCenterPath, ambulanceProgress, 0.16)
        ambulance.position.copy(ambulancePose.position)
        ambulance.rotation.y = Math.atan2(-ambulancePose.tangent.x, -ambulancePose.tangent.z)
        ambulance.position.y += 0.02

        if (previousAmbulancePosition) {
            const movement = ambulance.position.clone().sub(previousAmbulancePosition)
            camera.position.add(movement)
            controls.target.add(movement)
        }
        previousAmbulancePosition = ambulance.position.clone()

        if (iter === 30) {
            headLight.visible = !headLight.visible
            headLight2.visible = !headLight2.visible
            headLight3.visible = !headLight3.visible
            headLight4.visible = !headLight4.visible
            iter = 0
        }
        iter++
    }

    if (trafficVehicle && trafficRoadPath) {
        const progressDelta = (2 * deltaTime) / trafficRoadPath.getLength()
        trafficVehicleProgress += progressDelta
        if (trafficVehicleProgress >= 1) spawnTrafficVehicle()

        const trafficPose = getLanePosition(trafficRoadPath, trafficVehicleProgress, 0.16)
        trafficVehicle.position.copy(trafficPose.position)
        trafficVehicle.position.y += 0.02
        trafficVehicle.rotation.y = Math.atan2(-trafficPose.tangent.x, -trafficPose.tangent.z)
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
