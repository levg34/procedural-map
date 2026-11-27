import { Mesh, MeshStandardMaterial, type Group } from 'three'
import { headlightMaterialName, tailLightMaterialName } from '../data/lights'

function getNamedMaterials(vehicle: Group, name: string): MeshStandardMaterial[] {
    const materials = new Set<MeshStandardMaterial>()
    vehicle.traverse((child) => {
        if (!(child instanceof Mesh)) return

        const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of childMaterials) {
            if (material instanceof MeshStandardMaterial && material.name === name) {
                materials.add(material)
            }
        }
    })
    return [...materials]
}

export function hasHeadlights(vehicle: Group): boolean {
    return getNamedMaterials(vehicle, headlightMaterialName).length > 0
}

export function enableHeadlightGlow(vehicle: Group): void {
    for (const material of getNamedMaterials(vehicle, headlightMaterialName)) {
        material.emissive.set(0xfff2d0)
        material.emissiveIntensity = 2
    }
}

/** Enables both emissive glows. Both helpers already no-op when the named
 * materials are absent. Three.js clones share material instances with their
 * source, so calling this on a throwaway clone also prepares the loaded model
 * for every future clone (including respawn swaps). */
export function enableVehicleGlow(vehicle: Group): void {
    enableTailLightGlow(vehicle)
    enableHeadlightGlow(vehicle)
}

export function hasTailLights(vehicle: Group): boolean {
    return getNamedMaterials(vehicle, tailLightMaterialName).length > 0
}

export function enableTailLightGlow(vehicle: Group): void {
    for (const material of getNamedMaterials(vehicle, tailLightMaterialName)) {
        material.emissive.set(0xff3030)
        material.emissiveIntensity = 1.5
    }
}
