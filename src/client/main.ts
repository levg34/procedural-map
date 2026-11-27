import {
    AmbientLight,
    Box3,
    DirectionalLight,
    Group,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    PointLight,
    Scene,
    SpotLight,
    Vector3,
    WebGLRenderer
} from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
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
import { getRoad, getRoadParts, getRoadQuery, getRoadShowcase, getVehicleModels } from './api'
import { createCameraRig } from './cameraRig'
import { createGrassGround } from './ground'
import { getRoadBounds } from './roadBounds'
import { createRoadPreview } from './roadPreview'
import { modelZOffset, vehicleScale, vehicleYOffset } from './vehicleConstants'
import {
    createShowcasePlacements,
    isShowcaseDisplayModel,
    showcaseDisplayGap,
    showcaseDisplayOffset,
    showcaseSpacing,
    showcaseVehicleOffset,
    showcaseVehicleRotations,
    type ShowcasePlacement
} from './showcase'
import { createRoadsideLampPlacements } from './streetLamps'
import { enableHeadlightGlow, enableTailLightGlow, hasHeadlights } from './vehicleLights'
import { createTrafficSimulation, type LoadedTrafficVehicleModel, type VehicleFactory } from './trafficSimulation'
import { createRoadCenterPath } from './vehiclePath'

const isShowcase = window.location.pathname === '/showcase'
const { length: roadLength, seed: roadSeed } = getRoadQuery(window.location.search)
const reverseTrafficVehicleCount = isShowcase ? 1 : 8
const forwardTrafficVehicleCount = isShowcase ? 0 : 4
const laneOffset = 0.16

type LoadedRoadModel = RoadModel & {
    model: GLTF
}

let loadedRoadModels: LoadedRoadModel[] = []

const scene = new Scene()
const roadPreview = createRoadPreview(scene, () => loadedRoadModels)

const renderer = new WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const labelRenderer = isShowcase ? new CSS2DRenderer() : undefined
if (labelRenderer) {
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.domElement.style.position = 'fixed'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    document.body.appendChild(labelRenderer.domElement)
}

const cameraRig = createCameraRig({
    domElement: renderer.domElement,
    width: window.innerWidth,
    height: window.innerHeight,
    showHint: isShowcase
})

scene.add(new AmbientLight(0x404040))
scene.add(new DirectionalLight(0xffffff, 0.5))

const createVehicle: VehicleFactory = (model) => {
    const object = new Group()
    const visual = model.model.scene.clone()
    object.add(visual)
    const beaconLights = prepareVehicle(object, model.name)
    return { object, visual, beaconLights }
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

function addModelLabel(name: string, position: Vector3): void {
    if (!labelRenderer) return

    const element = document.createElement('div')
    element.className = 'model-label'
    element.textContent = name

    const label = new CSS2DObject(element)
    label.position.copy(position).add(new Vector3(0, 0.35, 0))
    label.center.set(0.5, 1)
    scene.add(label)
}

let labelsVisible = true
function toggleLabels(): void {
    if (!labelRenderer) return
    labelsVisible = !labelsVisible
    labelRenderer.domElement.style.display = labelsVisible ? '' : 'none'
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
    vehicle.scale.setScalar(vehicleScale)
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
        // Head coordinates are centered; undo the GLB root's Z offset.
        light.position.set(head.x, head.y, head.z - modelZOffset)
        prop.add(light)
    }
}

function getModelFootprint(model: GLTF): number {
    const size = new Box3().setFromObject(model.scene).getSize(new Vector3())
    return Math.max(size.x, size.z)
}

function addCenteredProp(model: LoadedRoadModel, position: Vector3, rotation: number): void {
    // The GLB node pushes geometry 0.75 forward; center it on the placement.
    const prop = model.model.scene.clone()
    prop.position.z = modelZOffset
    addStreetLightGlow(prop, model.name)

    const holder = new Object3D()
    holder.add(prop)
    holder.position.copy(position)
    holder.rotation.y = rotation
    scene.add(holder)
    addModelLabel(model.name, position)
}

function addShowcaseProps(displayModels: LoadedRoadModel[], placements: ShowcasePlacement[]): void {
    displayModels.forEach((model, index) => {
        const placement = placements[index]
        if (placement) addCenteredProp(model, placement.position, placement.rotation)
    })
}

function addRoadsideLamps(centerPath: ReturnType<typeof createRoadCenterPath>): void {
    const lampModel =
        loadedRoadModels.find((model) => model.name === 'light_curved') ??
        loadedRoadModels.find((model) => model.name.startsWith('light_'))
    if (!lampModel) return

    for (const placement of createRoadsideLampPlacements(centerPath)) {
        addCenteredProp(lampModel, placement.position, placement.rotation)
    }
}

function addParkedVehicles(road: RoadSegment[], vehicleModels: LoadedTrafficVehicleModel[]): PointLight[] {
    const placements = createShowcasePlacements(road, vehicleModels.length, {
        offset: showcaseVehicleOffset,
        rotation: showcaseVehicleRotations
    })
    const beaconLights: PointLight[] = []

    vehicleModels.forEach((model, index) => {
        const placement = placements[index]
        if (!placement) return

        const vehicle = model.model.scene.clone()
        beaconLights.push(...prepareVehicle(vehicle, model.name))
        vehicle.position.copy(placement.position)
        vehicle.position.y += vehicleYOffset
        vehicle.rotation.y = placement.rotation
        scene.add(vehicle)
        addModelLabel(model.name, placement.position)
    })

    return beaconLights
}

void initializeAmbulance()

async function initializeRoad(): Promise<void> {
    try {
        const [roadModels, availableVehicleModels, road] = await Promise.all([
            getRoadParts(),
            getVehicleModels(),
            isShowcase ? getRoadShowcase() : getRoad(roadLength, roadSeed)
        ])
        const [roadCatalog, loadedVehicleModels] = await Promise.all([
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
        loadedRoadModels = roadCatalog
        roadPreview.reset()
        const trafficVehicleModels = loadedVehicleModels.filter((model) => !isTrafficVehicleExcluded(model.name))

        const showcasePathNames = new Set(road.map((segment) => segment.name))
        const showcaseDisplayModels = isShowcase
            ? roadCatalog.filter((model) => isShowcaseDisplayModel(model.name, showcasePathNames))
            : []
        const displayPlacements = isShowcase
            ? createShowcasePlacements(
                  road,
                  showcaseDisplayModels.length,
                  { offset: showcaseDisplayOffset, rotation: { left: Math.PI / 2, right: -Math.PI / 2 } },
                  showcaseDisplayGap,
                  showcaseDisplayModels.map((model) => getModelFootprint(model.model))
              )
            : []
        const { minZ: roadMinZ } = getRoadBounds(road)
        const displayMinZ =
            displayPlacements.length > 0
                ? Math.min(...displayPlacements.map((placement) => placement.position.z))
                : roadMinZ
        const groundMargin = isShowcase ? Math.max(10, roadMinZ - displayMinZ + 3) : undefined
        scene.add(createGrassGround(road, groundMargin))

        const centerPath = createRoadCenterPath(road)
        const reversePath = createRoadCenterPath(road, true)
        if (isShowcase) {
            addShowcaseProps(showcaseDisplayModels, displayPlacements)
            simulation.addParkedBeaconLights(addParkedVehicles(road, loadedVehicleModels))
        } else {
            addRoadsideLamps(centerPath)
        }
        simulation.start(centerPath, reversePath, trafficVehicleModels)
        road.forEach((segment: RoadSegment) => {
            const roadModel = roadCatalog.find((model) => segment.name === model.name)
            if (!roadModel) throw new Error(`Missing road model: ${segment.name}`)

            const roadPart = new Object3D()
            const roadPartModel = roadModel.model.scene.clone()
            roadPartModel.position.z = modelZOffset
            roadPart.add(roadPartModel)
            if (segment.rotation !== undefined) {
                roadPart.rotation.y = segment.rotation
            }
            roadPart.position.set(segment.position.x, segment.position.y, segment.position.z)
            scene.add(roadPart)
            addModelLabel(segment.name, roadPart.position)
        })
    } catch (error: unknown) {
        console.error('Failed to initialize road:', error)
    }
}

void initializeRoad()

let lastFrameTime = performance.now()
function animate(timestamp = performance.now()): void {
    requestAnimationFrame(animate)

    const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05)
    lastFrameTime = timestamp

    simulation.update(deltaTime)
    cameraRig.update(deltaTime, ambulance?.position)

    renderer.render(scene, cameraRig.camera)
    labelRenderer?.render(scene, cameraRig.camera)
}

animate()

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key === ' ') roadPreview.showNext()
    if (isShowcase && key === 'c' && !event.repeat) cameraRig.toggleMode()
    if (isShowcase && key === 'l' && !event.repeat) toggleLabels()
})

window.addEventListener('resize', () => {
    cameraRig.resize(window.innerWidth, window.innerHeight)
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer?.setSize(window.innerWidth, window.innerHeight)
})
