import {
    AmbientLight,
    DirectionalLight,
    Object3D,
    PerspectiveCamera,
    PointLight,
    Scene,
    SpotLight,
    WebGLRenderer,
    type Group
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { getRoad, getRoadParts, type RoadModel, type RoadSegment } from './data'

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

void loadModel('/model/cars/ambulance.glb')
    .then((gltf) => {
        ambulance = gltf.scene
        ambulance.scale.set(0.2, 0.2, 0.2)
        ambulance.position.set(0, 0, 0.15)
        ambulance.rotation.y = -Math.PI / 2

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
    })
    .catch((error: unknown) => {
        console.error('Failed to load ambulance model:', error)
    })

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
    const roadModels = await getRoadParts()
    models.road = await Promise.all(
        roadModels.map(async (roadModel) => ({
            ...roadModel,
            model: await loadModel(roadModel.url)
        }))
    )
    models.index = 0

    const road = await getRoad(10)
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
}

void initializeRoad().catch((error: unknown) => {
    console.error('Failed to initialize road:', error)
})

let iter = 0
function animate(): void {
    requestAnimationFrame(animate)

    if (ambulance && headLight && headLight2) {
        if (ambulance.position.x < 9) {
            ambulance.position.x += 0.01
            camera.position.x += 0.01
            controls.target.x += 0.01
        } else {
            ambulance.position.x = 0
            camera.position.x -= 9 + 0.01
            controls.target.x -= 9 + 0.01
        }
        controls.update()
        if (iter === 30) {
            headLight.visible = !headLight.visible
            headLight2.visible = !headLight2.visible
            iter = 0
        }
        iter++
    }

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
