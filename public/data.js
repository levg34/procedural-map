const getRoadParts = () => fetch('/road_parts').then(res => res.json())

export { getRoadParts }