const { Vector3 } = require("three")

const turn = {
    for: ['road_bend','road_bendSquare','road_bendSidewalk','road_curve','road_curvePavement'],
    directions: [
        new Vector3(1,0,0),
        new Vector3(0,0,-1)
    ]
}

const straight = {
    for: ['road_crossing','road_drivewayDouble','road_drivewaySingle','#road_side','#road_sideEntry','#road_sideExit','#road_split','road_straight'],
    directions: [
        new Vector3(1,0,0),
        new Vector3(-1,0,0)
    ]
}

const allDirections = {
    for: ['road_crossroad','road_crossroadLine','road_crossroadPath','road_roundabout'],
    directions: [
        new Vector3(1,0,0),
        new Vector3(-1,0,0),
        new Vector3(0,0,1),
        new Vector3(0,0,-1)
    ]
}

const tripleIntersection = {
    for: ['road_curveIntersection','road_intersection','road_intersectionLine','road_intersectionPath'],
    directions: [
        new Vector3(1,0,0),
        new Vector3(-1,0,0),
        new Vector3(0,0,-1)
    ]
}

const roadEnd = {
    for: ['road_end'],
    directions: [
        new Vector3(-1,0,0)
    ]
}

const noEntry = {
    for: ['road_square'],
    directions: []
}

const roadTypes = {turn,straight,allDirections,tripleIntersection,roadEnd,noEntry}

module.exports = {
    roadTypes
}