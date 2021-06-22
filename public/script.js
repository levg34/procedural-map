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

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
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

let ambulance
loadModel('/model/cars/ambulance.glb').then(gltf => {
    ambulance = gltf.scene
    ambulance.scale.set(0.2,0.2,0.2)
    ambulance.position.set(0,0,0.9)
    ambulance.rotation.y = -Math.PI/2
    const pointlight = new THREE.PointLight(0xffffff, 2, 5)
    pointlight.position.set(0,0.6,-1.6)
    // const gui = new GUI()
    // const lightFolder = gui.addFolder("Cube")
    // lightFolder.add(pointlight.position, "x", -2, 2, 0.01)
    // lightFolder.add(pointlight.position, "y", -2, 2, 0.01)
    // lightFolder.add(pointlight.position, "z", -2, 2, 0.01)

    // const sphereSize = 0.1
    // const pointLightHelper = new THREE.PointLightHelper(pointlight, sphereSize)
    // scene.add( pointLightHelper )
    
    ambulance.add(pointlight)
    scene.add(ambulance)
})

const loadRP = () => {
    if (models.index > 0) {
        scene.remove(models.current)
    }
    const roadElement = models.road[models.index]
    if (roadElement != undefined) {
        const model = roadElement.model
        if (model instanceof Promise) return
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
        e.model = loadModel(e.url)
        return e
    })
    models.road.forEach(e => {
        e.model.then(gltf => {
            e.model = gltf
        })
    })
    // loadRP()
    getRoad().then(res => {
        res.forEach((e,i) => {
            const reToAdd = models.road.find(re => e.roadPart.name === re.name)
            const roadPart = reToAdd.model.scene.clone()
            roadPart.position.x += i
            scene.add(roadPart)
        })
    })
})

const animate = function () {
	requestAnimationFrame(animate)
    if (ambulance !== undefined) {
        if (ambulance.position.x < 5) {
            ambulance.position.x += 0.01
        } else {
            ambulance.position.x = -5
        }
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
