const fs = require('fs')
// type Direction = '+x' | '-x' | '+y' | '-y' 

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

const confs = [turn,straight,allDirections,tripleIntersection,roadEnd,noEntry]

function getRoadParts() {
    return new Promise((resolve, reject) => {
        fs.readdir('./models/road',(err, files) => {
        if (err) return reject(err)
        const models = files.filter(file => !file.endsWith('.txt')).map(file => {
            const name = file.slice(0,-4)
            const roadPart = {
                url: '/model/road/'+file,
                name
            }
            confs.forEach(conf => {
                if (conf.for.includes(name)) {
                    roadPart.directions = conf.directions
                }
            })
            return roadPart
        })
        resolve(models)
    })})
}

module.exports = {
    getRoadParts
}
