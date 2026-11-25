import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getTrafficVehicleModels } from '../utils'

describe('traffic vehicle models', () => {
    it('should include vehicle models but exclude wheels and the followed ambulance', async () => {
        const models = await getTrafficVehicleModels()

        assert.ok(models.length > 0)
        assert.ok(models.every((model) => !model.name.startsWith('wheel') && model.name !== 'ambulance'))
    })
})
