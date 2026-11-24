import type { Vector3 } from 'three'

const EPSILON = 0.000000000001

export function doubleEquals(double1: number, double2: number): boolean {
    return Math.abs(double1 - double2) < EPSILON
}

export function vectors3Equals(vector1: Vector3, vector2: Vector3): boolean {
    return (
        doubleEquals(vector1.x, vector2.x) && doubleEquals(vector1.y, vector2.y) && doubleEquals(vector1.z, vector2.z)
    )
}
