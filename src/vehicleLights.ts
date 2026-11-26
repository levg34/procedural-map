import { Mesh, MeshStandardMaterial, type Group } from 'three'

export const headlightMaterialName = 'lightFront'

function getHeadlightMaterials(vehicle: Group): MeshStandardMaterial[] {
    const materials = new Set<MeshStandardMaterial>()
    vehicle.traverse((child) => {
        if (!(child instanceof Mesh)) return

        const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of childMaterials) {
            if (material instanceof MeshStandardMaterial && material.name === headlightMaterialName) {
                materials.add(material)
            }
        }
    })
    return [...materials]
}

export function hasHeadlights(vehicle: Group): boolean {
    return getHeadlightMaterials(vehicle).length > 0
}

export function enableHeadlightGlow(vehicle: Group): void {
    for (const material of getHeadlightMaterials(vehicle)) {
        material.emissive.set(0xfff2d0)
        material.emissiveIntensity = 2
    }
}
