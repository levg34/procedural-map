import * as THREE from 'https://cdn.skypack.dev/three@0.129.0'
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js'
import { getRoadParts } from './data.js'
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

const loadRP = () => {
    if (models.index > 0) {
        scene.remove(models.current)
    }
    if (models.road[models.index] != undefined) {
        models.road[models.index].model.then(gltf => {
            models.current = gltf.scene
            scene.add(gltf.scene)
        })
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
    loadRP()
})

const animate = function () {
	requestAnimationFrame(animate)

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