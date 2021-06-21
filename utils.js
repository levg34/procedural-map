const fs = require('fs')

function getRoadParts() {
    return new Promise((resolve, reject) => {
        fs.readdir('./models/road',(err, files) => {
        if (err) return reject(err)
        const models = files.filter(file => !file.endsWith('.txt')).map(file => {
            return {
                url: '/model/road/'+file,
                name: file.slice(0,-4)
            }
        })
        resolve(models)
    })})
}

module.exports = {
    getRoadParts
}
