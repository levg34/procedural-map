import {
    AmbientLight,
    DirectionalLight,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    PointLight,
    Scene,
    SpotLight,
    Vector3,
    WebGLRenderer,
    type Group
} from 'three'
import { FlyControls } from 'three/addons/controls/FlyControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import {
    defaultHeadlightPlacement,
    emergencyBeaconPlacements,
    headlightPlacements,
    streetLightHeads,
    type BeaconLightPlacement,
    type HeadlightPlacement
} from '../data/lights'
import type { RoadModel, RoadSegment } from '../data/models'
import { isTrafficVehicleExcluded } from '../data/vehicles'
import { getRoad, getRoadParts, getRoadShowcase, getVehicleModels } from './api'
import { createGrassGround } from './ground'
import { createShowcasePlacements, isShowcaseProp } from './showcase'
import { createRoadsideLampPlacements } from './streetLamps'
import { enableHeadlightGlow, enableTailLightGlow, hasHeadlights } from './vehicleLights'
import { createTrafficSimulation, type LoadedTrafficVehicleModel, type VehicleFactory } from './trafficSimulation'
import { createRoadCenterPath } from './vehiclePath'

const isShowcase = window.location.pathname === '/showcase'
const reverseTrafficVehicleCount = isShowcase ? 1 : 8
const forwardTrafficVehicleCount = isShowcase ? 0 : 4
const laneOffset = 0.16

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
const flyControls = new FlyControls(camera, renderer.domElement)
flyControls.movementSpeed = 0
// OrbitControls owns rotation; FlyControls supplies translation only.
flyControls.rollSpeed = 0
flyControls.dragToLook = true

let cameraMode: 'follow' | 'free' = 'follow'
const cameraFollowOffset = camera.position.clone()

scene.add(new AmbientLight(0x404040))
scene.add(new DirectionalLight(0xffffff, 0.5))

const createVehicle: VehicleFactory = (model) => {
    const vehicle = model.model.scene.clone()
    const beaconLights = prepareVehicle(vehicle, model.name)
    return { object: vehicle, beaconLights }
}

const simulation = createTrafficSimulation({
    scene,
    laneOffset,
    isShowcase,
    reverseTrafficVehicleCount,
    forwardTrafficVehicleCount,
    createVehicle
})

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

function updateCameraHint(hint: HTMLDivElement | undefined): void {
    if (!hint) return
    hint.textContent =
        cameraMode === 'follow'
            ? 'Camera: following ambulance · C: free-fly'
            : 'Camera: free-fly · WASD move · R/F up/down · drag orbit · wheel zoom · C: follow'
}

function createCameraHint(): HTMLDivElement | undefined {
    if (!isShowcase) return undefined

    const hint = document.createElement('div')
    hint.style.position = 'fixed'
    hint.style.bottom = '12px'
    hint.style.left = '12px'
    hint.style.padding = '7px 10px'
    hint.style.borderRadius = '4px'
    hint.style.background = 'rgba(0, 0, 0, 0.6)'
    hint.style.color = 'white'
    hint.style.font = '12px sans-serif'
    hint.style.pointerEvents = 'none'
    document.body.appendChild(hint)
    updateCameraHint(hint)
    return hint
}

const cameraHint = createCameraHint()

function toggleCameraMode(): void {
    const ambulancePosition = ambulance?.position ?? new Vector3()
    if (cameraMode === 'follow') {
        cameraFollowOffset.copy(camera.position).sub(ambulancePosition)
        cameraMode = 'free'
    } else {
        cameraMode = 'follow'
        camera.position.copy(ambulancePosition).add(cameraFollowOffset)
        controls.target.copy(ambulancePosition)
    }
    flyControls.movementSpeed = cameraMode === 'free' ? 3 : 0
    previousAmbulancePosition = undefined
    updateCameraHint(cameraHint)
}

let ambulance: Group | undefined

async function initializeAmbulance(): Promise<void> {
    try {
        const gltf = await loadModel('/model/cars/ambulance.glb')
        ambulance = gltf.scene
        const beaconLights = prepareVehicle(ambulance, 'ambulance')
        scene.add(ambulance)
        simulation.setAmbulance(ambulance, beaconLights)
    } catch (error: unknown) {
        console.error('Failed to load ambulance model:', error)
    }
}

function addVehicleLights(vehicle: Group, placement: HeadlightPlacement = defaultHeadlightPlacement): void {
    enableTailLightGlow(vehicle)
    if (!hasHeadlights(vehicle)) return
    enableHeadlightGlow(vehicle)

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

function prepareVehicle(vehicle: Group, modelName: string): PointLight[] {
    vehicle.scale.set(0.2, 0.2, 0.2)
    addVehicleLights(vehicle, headlightPlacements[modelName] ?? defaultHeadlightPlacement)
    return addBeaconLights(vehicle, emergencyBeaconPlacements[modelName] ?? [])
}

function addStreetLightGlow(prop: Group, name: string): void {
    prop.traverse((child) => {
        if (!(child instanceof Mesh)) return

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of materials) {
            if (!(material instanceof MeshStandardMaterial) || material.name !== 'light') continue
            material.emissive.set(0xffe6b0)
            material.emissiveIntensity = 1.6
        }
    })

    for (const head of streetLightHeads[name] ?? []) {
        const light = new PointLight(0xffe0a8, 2.5, 1.8, 2)
        // Head coordinates are centered; the GLB root is offset by -0.75.
        light.position.set(head.x, head.y, head.z + 0.75)
        prop.add(light)
    }
}

function addCenteredProp(model: LoadedRoadModel, position: Vector3, rotation: number): void {
    // The GLB node pushes geometry 0.75 forward; center it on the placement.
    const prop = model.model.scene.clone()
    prop.position.z = -0.75
    addStreetLightGlow(prop, model.name)

    const holder = new Object3D()
    holder.add(prop)
    holder.position.copy(position)
    holder.rotation.y = rotation
    scene.add(holder)
}

function addShowcaseProps(road: RoadSegment[]): void {
    const propModels = models.road.filter((model) => isShowcaseProp(model.name))
    const placements = createShowcasePlacements(road, propModels.length, {
        offset: 3.4,
        rotation: { left: Math.PI / 2, right: -Math.PI / 2 }
    })

    propModels.forEach((model, index) => {
        const placement = placements[index]
        if (placement) addCenteredProp(model, placement.position, placement.rotation)
    })
}

function addRoadsideLamps(centerPath: ReturnType<typeof createRoadCenterPath>): void {
    const lampModel =
        models.road.find((model) => model.name === 'light_curved') ??
        models.road.find((model) => model.name.startsWith('light_'))
    if (!lampModel) return

    for (const placement of createRoadsideLampPlacements(centerPath)) {
        addCenteredProp(lampModel, placement.position, placement.rotation)
    }
}

function addParkedVehicles(road: RoadSegment[], vehicleModels: LoadedTrafficVehicleModel[]): PointLight[] {
    const placements = createShowcasePlacements(road, vehicleModels.length, { offset: 1.7, rotation: 0 })
    const beaconLights: PointLight[] = []

    vehicleModels.forEach((model, index) => {
        const placement = placements[index]
        if (!placement) return

        const vehicle = model.model.scene.clone()
        beaconLights.push(...prepareVehicle(vehicle, model.name))
        vehicle.position.copy(placement.position)
        vehicle.position.y += 0.02
        vehicle.rotation.y = placement.rotation
        scene.add(vehicle)
    })

    return beaconLights
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
        const [roadModels, availableVehicleModels, road] = await Promise.all([
            getRoadParts(),
            getVehicleModels(),
            isShowcase ? getRoadShowcase() : getRoad(10)
        ])
        const [loadedRoadModels, loadedVehicleModels] = await Promise.all([
            Promise.all(
                roadModels.map(async (roadModel) => ({
                    ...roadModel,
                    model: await loadModel(roadModel.url)
                }))
            ),
            Promise.all(
                availableVehicleModels.map(async (vehicleModel) => ({
                    ...vehicleModel,
                    model: await loadModel(vehicleModel.url)
                }))
            )
        ])
        models.road = loadedRoadModels
        const trafficVehicleModels = loadedVehicleModels.filter((model) => !isTrafficVehicleExcluded(model.name))
        models.index = 0

        scene.add(createGrassGround(road))
        const centerPath = createRoadCenterPath(road)
        const reversePath = createRoadCenterPath(road, true)
        if (isShowcase) {
            addShowcaseProps(road)
            simulation.addParkedBeaconLights(addParkedVehicles(road, loadedVehicleModels))
        } else {
            addRoadsideLamps(centerPath)
        }
        simulation.start(centerPath, reversePath, trafficVehicleModels)
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

let lastFrameTime = performance.now()
let previousAmbulancePosition: Vector3 | undefined
const flyMovement = new Vector3()
function animate(timestamp = performance.now()): void {
    requestAnimationFrame(animate)

    const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp

    simulation.update(deltaTime)

    if (ambulance && cameraMode === 'follow' && previousAmbulancePosition) {
        const movement = ambulance.position.clone().sub(previousAmbulancePosition)
        camera.position.add(movement)
        controls.target.add(movement)
    }
    if (ambulance) previousAmbulancePosition = ambulance.position.clone()

    flyMovement.copy(camera.position)
    flyControls.update(deltaTime)
    if (cameraMode === 'free') {
        // Keep the orbit target with the camera so OrbitControls can still own rotation.
        flyMovement.subVectors(camera.position, flyMovement)
        controls.target.add(flyMovement)
    }

    controls.update()
    renderer.render(scene, camera)
}

animate()

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key === ' ') loadRoadPreview()
    if (isShowcase && key === 'c' && !event.repeat) toggleCameraMode()
})

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
