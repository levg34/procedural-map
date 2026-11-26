import { Vector3 } from 'three'

export const headlightMaterialName = 'lightFront'
export const tailLightMaterialName = 'lightBack'

export type HeadlightPlacement = {
    halfWidth: number
    height: number
    frontZ: number
}

export type BeaconLightPlacement = {
    x: number
    y: number
    z: number
    color: number
    initiallyVisible: boolean
}

export const headlightPlacements: Record<string, HeadlightPlacement> = {
    ambulance: { halfWidth: 0.42, height: 0.65, frontZ: -1.55 },
    firetruck: { halfWidth: 0.35, height: 0.84, frontZ: -1.43 },
    police: { halfWidth: 0.45, height: 0.55, frontZ: -1.32 },
    tractorPolice: { halfWidth: 0.445, height: 0.62, frontZ: -0.91 }
}

export const defaultHeadlightPlacement: HeadlightPlacement = {
    halfWidth: 0.45,
    height: 0.35,
    frontZ: -1.35
}

export const ambulanceBeaconPlacements: BeaconLightPlacement[] = [
    { x: -0.31, y: 1.73, z: 1.45, color: 0x0e45ea, initiallyVisible: true },
    { x: 0.31, y: 1.73, z: 1.45, color: 0x0e45ea, initiallyVisible: false },
    { x: -0.31, y: 1.43, z: -0.75, color: 0x0e45ea, initiallyVisible: true },
    { x: 0.31, y: 1.43, z: -0.75, color: 0x0e45ea, initiallyVisible: false }
]

export const emergencyBeaconPlacements: Record<string, BeaconLightPlacement[]> = {
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

// Lamp-head centers in the centered model coordinate space (node Z offset removed).
// Curved lamps sit at Y = 0.653, square ones at Y = 0.575.
export const streetLightHeads: Record<string, Vector3[]> = {
    light_curved: [new Vector3(0, 0.653, 0.15)],
    light_curvedDouble: [new Vector3(0, 0.653, 0.15), new Vector3(0, 0.653, -0.15)],
    light_curvedCross: [
        new Vector3(0, 0.653, 0.15),
        new Vector3(0, 0.653, -0.15),
        new Vector3(0.15, 0.653, 0),
        new Vector3(-0.15, 0.653, 0)
    ],
    light_square: [new Vector3(0, 0.575, 0.162)],
    light_squareDouble: [new Vector3(0, 0.575, 0.162), new Vector3(0, 0.575, -0.162)],
    light_squareCross: [
        new Vector3(0, 0.575, 0.162),
        new Vector3(0, 0.575, -0.162),
        new Vector3(0.162, 0.575, 0),
        new Vector3(-0.162, 0.575, 0)
    ],
    construction_light: [new Vector3(0, 0.21, 0)]
}
