import { PerspectiveCamera, Vector3 } from 'three'
import { FlyControls } from 'three/addons/controls/FlyControls.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type CameraMode = 'follow' | 'free'

export type CameraRig = {
    camera: PerspectiveCamera
    mode: CameraMode
    toggleMode(): void
    update(deltaTime: number, ambulancePosition?: Vector3): void
    resize(width: number, height: number): void
}

export type CameraRigOptions = {
    domElement: HTMLElement
    width: number
    height: number
    showHint?: boolean
}

export function createCameraRig({ domElement, width, height, showHint = false }: CameraRigOptions): CameraRig {
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)

    const controls = new OrbitControls(camera, domElement)
    const flyControls = new FlyControls(camera, domElement)
    flyControls.movementSpeed = 0
    // OrbitControls owns rotation; FlyControls supplies translation only.
    flyControls.rollSpeed = 0
    flyControls.dragToLook = true

    let mode: CameraMode = 'follow'
    const followOffset = camera.position.clone()
    const lastAmbulance = new Vector3()
    const previousAmbulance = new Vector3()
    const movement = new Vector3()
    let hasPrevious = false

    const hint = showHint ? document.createElement('div') : undefined
    if (hint) {
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
    }

    function updateHint(): void {
        if (!hint) return
        hint.textContent =
            mode === 'follow'
                ? 'Camera: following ambulance · C: free-fly · L: labels'
                : 'Camera: free-fly · WASD move · R/F up/down · drag orbit · wheel zoom · C: follow · L: labels'
    }
    updateHint()

    return {
        camera,
        get mode() {
            return mode
        },
        toggleMode() {
            if (mode === 'follow') {
                followOffset.copy(camera.position).sub(lastAmbulance)
                mode = 'free'
            } else {
                mode = 'follow'
                camera.position.copy(lastAmbulance).add(followOffset)
                controls.target.copy(lastAmbulance)
            }
            flyControls.movementSpeed = mode === 'free' ? 3 : 0
            hasPrevious = false
            updateHint()
        },
        update(deltaTime, ambulancePosition) {
            if (ambulancePosition) {
                lastAmbulance.copy(ambulancePosition)
                if (mode === 'follow') {
                    if (hasPrevious) {
                        movement.subVectors(ambulancePosition, previousAmbulance)
                        camera.position.add(movement)
                        controls.target.add(movement)
                    }
                    previousAmbulance.copy(ambulancePosition)
                    hasPrevious = true
                }
            } else {
                hasPrevious = false
            }

            movement.copy(camera.position)
            flyControls.update(deltaTime)
            if (mode === 'free') {
                // Keep the orbit target with the camera so OrbitControls can still own rotation.
                movement.subVectors(camera.position, movement)
                controls.target.add(movement)
            }

            controls.update()
        },
        resize(width, height) {
            camera.aspect = width / height
            camera.updateProjectionMatrix()
        }
    }
}
