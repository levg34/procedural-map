import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
    defaultTrafficVehicleWeight,
    getTrafficVehicleWeight,
    isTrafficVehicleExcluded,
    isVehiclePart,
    trafficVehicleExclusions
} from '../src/data/vehicles'
import { getTrafficVehicleModels } from '../src/server/utils'

describe('traffic vehicle models', () => {
    it('should include vehicle models but exclude parts', async () => {
        const models = await getTrafficVehicleModels()

        assert.ok(models.length > 0)
        assert.ok(models.some((model) => model.name === 'ambulance'))
        assert.ok(models.some((model) => model.name === 'tractor'))
        assert.ok(models.some((model) => model.name === 'tractorPolice'))
        assert.ok(models.every((model) => !isVehiclePart(model.name)))
        assert.ok(models.every((model) => !isTrafficVehicleExcluded(model.name)))
    })

    it('should match exact models and type prefixes when exclusions are configured', () => {
        assert.deepStrictEqual(trafficVehicleExclusions, { models: [], types: [] })
        const exclusions = { models: ['tractorPolice'], types: ['tractor'] }
        assert.ok(isTrafficVehicleExcluded('tractorPolice', exclusions))
        assert.ok(isTrafficVehicleExcluded('tractorShovel', exclusions))
        assert.ok(!isTrafficVehicleExcluded('ambulance', exclusions))
        assert.ok(!isTrafficVehicleExcluded('tractorPolice'))
    })

    it('should treat wheel assets as parts rather than excluded vehicles', () => {
        assert.ok(isVehiclePart('wheelDark'))
        assert.ok(!isTrafficVehicleExcluded('wheelDark'))
    })
})

describe('traffic vehicle weights', () => {
    it('should give unlisted models the default weight', () => {
        assert.strictEqual(getTrafficVehicleWeight('sedan'), defaultTrafficVehicleWeight)
        assert.strictEqual(getTrafficVehicleWeight('firetruck'), defaultTrafficVehicleWeight)
        assert.strictEqual(getTrafficVehicleWeight('unknownModel'), defaultTrafficVehicleWeight)
    })

    it('should keep emergency, race and tractor models rare', () => {
        assert.ok(getTrafficVehicleWeight('ambulance') < getTrafficVehicleWeight('police'))
        assert.ok(getTrafficVehicleWeight('police') < getTrafficVehicleWeight('sedan'))
        assert.ok(getTrafficVehicleWeight('race') < defaultTrafficVehicleWeight)
        assert.ok(getTrafficVehicleWeight('raceFuture') < defaultTrafficVehicleWeight)
        assert.ok(getTrafficVehicleWeight('tractor') < defaultTrafficVehicleWeight)
        assert.ok(getTrafficVehicleWeight('tractorShovel') < defaultTrafficVehicleWeight)
        assert.ok(getTrafficVehicleWeight('tractorPolice') < getTrafficVehicleWeight('tractor'))
    })

    it('should accept a custom weight table', () => {
        assert.strictEqual(getTrafficVehicleWeight('ambulance', { ambulance: 3 }), 3)
        assert.strictEqual(getTrafficVehicleWeight('sedan', { ambulance: 3 }), defaultTrafficVehicleWeight)
    })
})
