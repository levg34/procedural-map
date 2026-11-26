import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { isTrafficVehicleExcluded, isVehiclePart, trafficVehicleExclusions } from '../data/vehicles'
import { getTrafficVehicleModels } from '../utils'

describe('traffic vehicle models', () => {
    it('should include vehicle models but exclude parts and configured vehicles', async () => {
        const models = await getTrafficVehicleModels()

        assert.ok(models.length > 0)
        assert.ok(models.some((model) => model.name === 'ambulance'))
        assert.ok(models.every((model) => !isVehiclePart(model.name)))
        assert.ok(models.every((model) => !isTrafficVehicleExcluded(model.name)))
    })

    it('should match exact models and type prefixes', () => {
        assert.deepStrictEqual(trafficVehicleExclusions, { models: ['tractorPolice'], types: ['tractor'] })
        assert.ok(isTrafficVehicleExcluded('tractorPolice'))
        assert.ok(isTrafficVehicleExcluded('tractorShovel'))
        assert.ok(!isTrafficVehicleExcluded('ambulance'))
    })

    it('should treat wheel assets as parts rather than excluded vehicles', () => {
        assert.ok(isVehiclePart('wheelDark'))
        assert.ok(!isTrafficVehicleExcluded('wheelDark'))
    })
})
