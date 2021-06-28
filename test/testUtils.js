const EPSILON = 0.000000000001

function doubleEquals(double1, double2) {
    return Math.abs(double1 - double2) < EPSILON
}

function vectors3Equals(vector1, vector2) {
    return doubleEquals(vector1.x, vector2.x) && doubleEquals(vector1.y, vector2.y) && doubleEquals(vector1.z, vector2.z)
}

module.exports = {
    doubleEquals,
    vectors3Equals
}