const getRoadParts = () => fetch('/road_parts').then(res => res.json())
const getRoad = length => fetch('/road/'+length).then(res => res.json())

export { getRoadParts, getRoad }