const fs = require('fs')
// type Direction = '+x' | '-x' | '+y' | '-y' 

const confs = Object.values(require('./roadData').roadTypes)

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
