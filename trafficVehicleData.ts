export type TrafficVehicleExclusions = {
    models: string[]
    types: string[]
}

// Wheel assets are parts, not vehicles, so they are filtered separately and
// must not be listed in the traffic exclusions below.
const vehiclePartPrefixes = ['wheel']

export function isVehiclePart(name: string): boolean {
    return vehiclePartPrefixes.some((prefix) => name.startsWith(prefix))
}

// Vehicles to leave out of traffic: exact model names or type prefixes.
// Good candidates are race cars (e.g. 'race', 'raceFuture') and work machines
// (e.g. 'tractor'). Only real vehicles belong here.
export const trafficVehicleExclusions: TrafficVehicleExclusions = {
    models: ['tractorPolice'],
    types: ['tractor']
}

export function isTrafficVehicleExcluded(
    name: string,
    exclusions: TrafficVehicleExclusions = trafficVehicleExclusions
): boolean {
    return exclusions.models.includes(name) || exclusions.types.some((type) => name === type || name.startsWith(type))
}
