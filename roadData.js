const turn = {
    for: ['road_bend','road_bendSquare','road_bendSidewalk','road_curve','road_curvePavement'],
    directions: ['+x','-y']
}

const straight = {
    for: ['road_crossing','road_drivewayDouble','road_drivewaySingle','#road_side','#road_sideEntry','#road_sideExit','#road_split','road_straight'],
    directions: ['+x','-x']
}

const allDirections = {
    for: ['road_crossroad','road_crossroadLine','road_crossroadPath','road_roundabout'],
    directions: ['+x','-x','+y','-y']
}

const tripleIntersection = {
    for: ['road_curveIntersection','road_intersection','road_intersectionLine','road_intersectionPath'],
    directions: ['+x','-x','-y']
}

const roadEnd = {
    for: ['road_end'],
    directions: ['-x']
}

const noEntry = {
    for: ['road_square'],
    directions: []
}

const roadTypes = {turn,straight,allDirections,tripleIntersection,roadEnd,noEntry}

module.exports = {
    roadTypes
}