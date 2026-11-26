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

export function hasTailLights(vehicle: Group): boolean {
    return getNamedMaterials(vehicle, tailLightMaterialName).length > 0
}

export function enableTailLightGlow(vehicle: Group): void {
    for (const material of getNamedMaterials(vehicle, tailLightMaterialName)) {
        material.emissive.set(0xff3030)
        material.emissiveIntensity = 1.5
    }
}
