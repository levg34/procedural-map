import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { createShowcasePlacements, isShowcaseProp, showcaseVehicleRotations } from '../src/client/showcase'
import { streetLightHeads } from '../src/data/lights'
import { Road } from '../src/server/roadBuilder'
import { getAllVehicleModels } from '../src/server/utils'

describe('showcase props', () => {
    it('should treat every non-road GLB as a showcase prop', async () => {
        const road = await Road.buildShowcase()
        const propParts = road.parts.filter((part) => isShowcaseProp(part.name))

        assert.ok(propParts.length > 0)
        assert.ok(
            road.parts.filter((part) => !isShowcaseProp(part.name)).every((part) => part.name.startsWith('road_'))
        )
    })

    it('should define a lamp head for every street light variant', () => {
        const streetLights = Object.keys(streetLightHeads).filter((name) => name.startsWith('light_'))

        assert.equal(streetLights.length, 6)
        for (const heads of Object.values(streetLightHeads)) {
            assert.ok(heads.length > 0)
            assert.ok(heads.every((head) => head.y > 0))
        }
        assert.equal(streetLightHeads['light_curved']?.[0]?.z, 0.15)
        assert.equal(streetLightHeads['light_curvedCross']?.length, 4)
        assert.equal(streetLightHeads['light_square']?.[0]?.y, 0.575)
    })

    it('should angle parked vehicles toward the road from both sides', async () => {
        const road = await Road.buildShowcase()
        const placements = createShowcasePlacements(road.getPath(), 4, {
            offset: 1.7,
            rotation: showcaseVehicleRotations
        })

        assert.deepStrictEqual(showcaseVehicleRotations, { left: -Math.PI / 4, right: Math.PI / 4 })
        for (const [index, placement] of placements.entries()) {
            assert.equal(
                placement.rotation,
                index % 2 === 0 ? showcaseVehicleRotations.left : showcaseVehicleRotations.right
            )
        }
    })

    it('should park vehicles in separate lanes clear of the road', async () => {
        const road = await Road.buildShowcase()
        const segments = road.getPath()
        const placements = createShowcasePlacements(segments, 20, { offset: 1.7, rotation: 0 })

        assert.equal(placements.length, 20)

        const minX = Math.min(...segments.map((segment) => segment.position.x))
        const maxX = Math.max(...segments.map((segment) => segment.position.x))
        for (const [index, placement] of placements.entries()) {
            assert.equal(placement.position.x, index % 2 === 0 ? minX - 1.7 : maxX + 1.7)
            assert.equal(placement.position.y, 0)
            assert.equal(placement.rotation, 0)
        }

        for (let first = 0; first < placements.length; first++) {
            for (let second = first + 1; second < placements.length; second++) {
                const placement = placements[first]
                const other = placements[second]
                if (!placement || !other) continue
                assert.ok(placement.position.distanceTo(other.position) >= 1.5 - 0.000001)
            }
        }
    })

    it('should give props their own lanes with lamp arms facing the road', async () => {
        const road = await Road.buildShowcase()
        const segments = road.getPath()
        const placements = createShowcasePlacements(segments, 15, {
            offset: 3.4,
            rotation: { left: Math.PI / 2, right: -Math.PI / 2 }
        })

        assert.equal(placements.length, 15)

        const minX = Math.min(...segments.map((segment) => segment.position.x))
        const maxX = Math.max(...segments.map((segment) => segment.position.x))
        for (const [index, placement] of placements.entries()) {
            const left = index % 2 === 0
            assert.equal(placement.position.x, left ? minX - 3.4 : maxX + 3.4)
            assert.equal(placement.rotation, left ? Math.PI / 2 : -Math.PI / 2)
        }

        const vehicleLane = createShowcasePlacements(segments, 20, { offset: 1.7, rotation: 0 })
        for (const prop of placements) {
            for (const vehicle of vehicleLane) {
                assert.ok(Math.abs(prop.position.x - vehicle.position.x) >= 1.7 - 0.000001)
            }
        }
    })
})

describe('showcase vehicle catalog', () => {
    it('should include every vehicle, even those excluded from traffic', async () => {
        const models = await getAllVehicleModels()

        assert.equal(models.length, 20)
        assert.ok(models.some((model) => model.name === 'tractorPolice'))
        assert.ok(models.some((model) => model.name === 'tractorShovel'))
        assert.ok(models.every((model) => !model.name.startsWith('wheel')))
    })
})
