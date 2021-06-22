const getRoadParts = () => fetch('/road_parts').then(res => res.json())
const getRoad = () => fetch('/road').then(res => res.json())

export { getRoadParts, getRoad }