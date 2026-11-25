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
import { getRoadParts, getRoadShowcase, type RoadModel, type RoadSegment } from './data'
import { createRoadCenterPath, getLanePosition } from './vehiclePath'

type LoadedRoadModel = RoadModel & {
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
let deliveryCar: Group | undefined
let roadCenterPath: ReturnType<typeof createRoadCenterPath> | undefined
let deliveryRoadPath: ReturnType<typeof createRoadCenterPath> | undefined
let ambulanceProgress = 0
let deliveryProgress = 0.5

async function initializeAmbulance(): Promise<void> {
    try {
        const gltf = await loadModel('/model/cars/ambulance.glb')
        ambulance = gltf.scene
        ambulance.scale.set(0.2, 0.2, 0.2)

        const frontLight = new SpotLight(0xffffff, 12, 15, Math.PI / 7, 0.4, 2)
        frontLight.position.set(0, 0.6, -1.6)
        frontLight.target.position.set(0, 0, -10)
        ambulance.add(frontLight)
        ambulance.add(frontLight.target)

        headLight = new PointLight(0x0e45ea, 2, 5)
        headLight.position.set(-0.4, 1.7, 1.45)
        headLight.visible = true
        ambulance.add(headLight)

        headLight2 = new PointLight(0x0e45ea, 2, 5)
        headLight2.position.set(0.4, 1.7, 1.45)
        headLight2.visible = false
        ambulance.add(headLight2)

        scene.add(ambulance)
    } catch (error: unknown) {
        console.error('Failed to load ambulance model:', error)
    }
}

async function initializeDeliveryCar(): Promise<void> {
    try {
        const gltf = await loadModel('/model/cars/delivery.glb')
        deliveryCar = gltf.scene
        deliveryCar.scale.set(0.2, 0.2, 0.2)
        scene.add(deliveryCar)
    } catch (error: unknown) {
        console.error('Failed to load delivery model:', error)
    }
}

void initializeAmbulance()
void initializeDeliveryCar()

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
        const roadModels = await getRoadParts()
        models.road = await Promise.all(
            roadModels.map(async (roadModel) => ({
                ...roadModel,
                model: await loadModel(roadModel.url)
            }))
        )
        models.index = 0

        const road = await getRoadShowcase()
        roadCenterPath = createRoadCenterPath(road)
        deliveryRoadPath = createRoadCenterPath(road, true)
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

    if (ambulance && headLight && headLight2 && roadCenterPath) {
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
            iter = 0
        }
        iter++
    }

    if (deliveryCar && deliveryRoadPath) {
        const progressDelta = (2 * deltaTime) / deliveryRoadPath.getLength()
        deliveryProgress = (deliveryProgress + progressDelta) % 1
        const deliveryPose = getLanePosition(deliveryRoadPath, deliveryProgress, 0.16)
        deliveryCar.position.copy(deliveryPose.position)
        deliveryCar.position.y += 0.02
        deliveryCar.rotation.y = Math.atan2(-deliveryPose.tangent.x, -deliveryPose.tangent.z)
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
