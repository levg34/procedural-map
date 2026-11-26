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

// Hard exclusions, reserved for models that should never appear in traffic.
// Rarity is expressed by `trafficVehicleWeights` instead.
export const trafficVehicleExclusions: TrafficVehicleExclusions = {
    models: [],
    types: []
}

export function isTrafficVehicleExcluded(
    name: string,
    exclusions: TrafficVehicleExclusions = trafficVehicleExclusions
): boolean {
    return exclusions.models.includes(name) || exclusions.types.some((type) => name === type || name.startsWith(type))
}

export const defaultTrafficVehicleWeight = 1

// Relative appearance weights; models not listed use the default. Values need
// not sum to 100. Ordinary cars (and firetruck) stay at the default so traffic
// is dominated by them; ambulances are already the hero vehicle on the road,
// police and race cars are uncommon, tractors are rare, and the police tractor
// is an easter egg.
export const trafficVehicleWeights: Record<string, number> = {
    ambulance: 0.02,
    police: 0.1,
    race: 0.1,
    raceFuture: 0.1,
    tractor: 0.05,
    tractorPolice: 0.005,
    tractorShovel: 0.05
}

export function getTrafficVehicleWeight(name: string, weights: Record<string, number> = trafficVehicleWeights): number {
    return weights[name] ?? defaultTrafficVehicleWeight
}
