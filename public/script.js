import * as THREE from 'https://cdn.skypack.dev/three@0.129.0'
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js'
import { getRoad, getRoadParts } from './data.js'
import { GUI } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/libs/dat.gui.module'
// import { MeshPhongMaterial } from 'three'

const models = {}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(5,5,5)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)

const light = new THREE.AmbientLight(0x404040) // soft white light
scene.add(light)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
scene.add(directionalLight)

const size = 10
const divisions = 10

const gridHelper = new THREE.GridHelper(size, divisions)
scene.add(gridHelper)

const axesHelper = new THREE.AxesHelper(5)
scene.add(axesHelper)

const loadModel = url => {
    const loader = new GLTFLoader()

    return new Promise((resolve, reject) => {
        loader.load(url, function (gltf) {
                resolve(gltf)
                // gltf.animations // Array<THREE.AnimationClip>
                // gltf.scene // THREE.Group
                // gltf.scenes // Array<THREE.Group>
                // gltf.cameras // Array<THREE.Camera>
                // gltf.asset // Object
            },
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded')
            },
            function (error) {
                console.log('An error happened: '+error)
            }
        )
    })
}

let ambulance, headLight, headLight2
loadModel('/model/cars/ambulance.glb').then(gltf => {
    ambulance = gltf.scene

    ambulance.scale.set(0.2,0.2,0.2)
    ambulance.position.set(0,0,0.15)
    ambulance.rotation.y = -Math.PI/2

    const frontLight = new THREE.PointLight(0xffffff, 2, 15)
    frontLight.position.set(0,0.6,-1.6)
    ambulance.add(frontLight)

    headLight = new THREE.PointLight(0x0e45ea, 2, 5)
    headLight.position.set(-0.4,1.7,1.45)
    ambulance.add(headLight)
    headLight.visible = true

    headLight2 = new THREE.PointLight(0x0e45ea, 2, 5)
    headLight2.position.set(0.4,1.7,1.45)
    ambulance.add(headLight2)
    headLight2.visible = false

    // const gui = new GUI()
    // const lightFolder = gui.addFolder("Cube")
    // lightFolder.add(headLight.position, "x", -2, 2, 0.05)
    // lightFolder.add(headLight.position, "y", -2, 2, 0.05)
    // lightFolder.add(headLight.position, "z", -2, 2, 0.05)

    // const sphereSize = 0.1
    // const pointLightHelper = new THREE.PointLightHelper(headLight, sphereSize)
    // scene.add( pointLightHelper )

    scene.add(ambulance)
})

const loadRP = () => {
    if (models.index > 0) {
        scene.remove(models.current)
    }
    const roadElement = models.road[models.index]
    if (roadElement != undefined) {
        const model = roadElement.model
        console.log(roadElement.name)
        models.current = model.scene
        scene.add(model.scene)
        models.index += 1
    } else {
        models.index = 0
        loadRP()
    }
}

getRoadParts().then(res => {
    models.index = 0
    models.road = res.map(e => {
        e.modelPromise = loadModel(e.url)
        return e
    })
    Promise.all(models.road.map(e => e.modelPromise)).then(gltfs => {
        gltfs.forEach((gltf, index) => {
            models.road[index].model = gltf
            delete models.road[index].modelPromise
        })
        getRoad(10).then(res => {
            res.forEach(e => {
                const reToAdd = models.road.find(re => e.name === re.name)
                const roadPart = new THREE.Object3D()
                const roadPartInitial = reToAdd.model.scene.clone()
                roadPartInitial.position.z = -0.75
                roadPart.add(roadPartInitial)
                roadPart.rotation.y = e.rotation ? e.rotation : 0
                roadPart.position.set(e.position.x,e.position.y,e.position.z)
                scene.add(roadPart)
            })
        })
    })
})

let iter = 0
const animate = function () {
	requestAnimationFrame(animate)
    if (ambulance !== undefined) {
        if (ambulance.position.x < 9) {
            ambulance.position.x += 0.01
        } else {
            ambulance.position.x = 0
        }
        if (iter == 30) {
            headLight.visible = !headLight.visible
            headLight2.visible = !headLight2.visible
            iter = 0
        }
        ++iter
    }
	renderer.render(scene, camera)
}

animate()

document.addEventListener('keydown',event => {
    if (event.key === ' ') {
        if (models.index !== undefined) {
            loadRP()
        }
    }
})

window.addEventListener('resize', event => {
    if (camera === undefined || renderer === undefined) return
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()

    renderer.setSize(window.innerWidth, window.innerHeight)
})
