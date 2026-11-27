import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
    createShowcasePlacements,
    isShowcaseDisplayModel,
    showcaseDisplayGap,
    showcaseDisplayOffset,
    showcaseSpacing,
    showcaseVehicleOffset,
    showcaseVehicleRotations
} from '../src/client/showcase'
import { streetLightHeads } from '../src/data/lights'
import { Road } from '../src/server/roadBuilder'
import { getAllVehicleModels, getRoadParts } from '../src/server/utils'

describe('showcase display models', () => {
    it('should include every model not already placed on the showcase road', async () => {
        const road = await Road.buildShowcase()
        const showcasePathNames = new Set(road.path.map((part) => part.name))
        const parts = await getRoadParts()
        const displayModels = parts.filter((part) => isShowcaseDisplayModel(part.name, showcasePathNames))

        assert.ok(displayModels.some((part) => part.name === 'light_curved'))
        assert.ok(displayModels.some((part) => part.name === 'road_split'))
        assert.ok(displayModels.every((part) => !showcasePathNames.has(part.name)))
        assert.equal(displayModels.length + showcasePathNames.size, parts.length)
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
            offset: showcaseVehicleOffset,
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

    it('should space oversized models by their own footprints', async () => {
        const road = await Road.buildShowcase()
        const placements = createShowcasePlacements(
            road.getPath(),
            4,
            { offset: showcaseDisplayOffset, rotation: 0 },
            showcaseDisplayGap,
            [1.5, 0.5, 1, 0.5]
        )

        assert.equal(placements[0]?.position.z, placements[1]?.position.z)
        assert.equal(placements[2]?.position.z, placements[3]?.position.z)
        assert.ok((placements[0]?.position.z ?? 0) - (placements[2]?.position.z ?? 0) >= 3 - 0.000001)
    })

    it('should park vehicles in separate lanes clear of the road', async () => {
        const road = await Road.buildShowcase()
        const segments = road.getPath()
        const placements = createShowcasePlacements(segments, 20, { offset: showcaseVehicleOffset, rotation: 0 })

        assert.equal(placements.length, 20)

        const minX = Math.min(...segments.map((segment) => segment.position.x))
        const maxX = Math.max(...segments.map((segment) => segment.position.x))
        for (const [index, placement] of placements.entries()) {
            assert.equal(
                placement.position.x,
                index % 2 === 0 ? minX - showcaseVehicleOffset : maxX + showcaseVehicleOffset
            )
            assert.equal(placement.position.y, 0)
            assert.equal(placement.rotation, 0)
        }

        for (let first = 0; first < placements.length; first++) {
            for (let second = first + 1; second < placements.length; second++) {
                const placement = placements[first]
                const other = placements[second]
                if (!placement || !other) continue
                assert.ok(placement.position.distanceTo(other.position) >= showcaseSpacing - 0.000001)
            }
        }
    })

    it('should give display models their own lanes with lamp arms facing the road', async () => {
        const road = await Road.buildShowcase()
        const segments = road.getPath()
        const showcasePathNames = new Set(segments.map((part) => part.name))
        const displayModels = (await getRoadParts()).filter((part) =>
            isShowcaseDisplayModel(part.name, showcasePathNames)
        )
        const placements = createShowcasePlacements(segments, displayModels.length, {
            offset: showcaseDisplayOffset,
            rotation: { left: Math.PI / 2, right: -Math.PI / 2 }
        })

        assert.equal(placements.length, displayModels.length)

        const minX = Math.min(...segments.map((segment) => segment.position.x))
        const maxX = Math.max(...segments.map((segment) => segment.position.x))
        for (const [index, placement] of placements.entries()) {
            const left = index % 2 === 0
            assert.equal(placement.position.x, left ? minX - showcaseDisplayOffset : maxX + showcaseDisplayOffset)
            assert.equal(placement.rotation, left ? Math.PI / 2 : -Math.PI / 2)
        }

        const vehicleLane = createShowcasePlacements(segments, 20, { offset: showcaseVehicleOffset, rotation: 0 })
        const laneGap = showcaseDisplayOffset - showcaseVehicleOffset
        for (const displayModel of placements) {
            for (const vehicle of vehicleLane) {
                assert.ok(Math.abs(displayModel.position.x - vehicle.position.x) >= laneGap - 0.000001)
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
