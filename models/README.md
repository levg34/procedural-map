# Model catalog

The model folders contain **65 road-folder GLBs** and **28 car-folder GLBs**.
Names below are file stems; append `.glb` to get the filename.

## How to read the measurements

- Footprints are approximate local **X × Z** bounds in model units. A regular
  road tile is 1 × 1.
- **Y** is height above the model origin. Flat ground road surfaces are about
  0.02 units thick. Raised or sloped assets can span more than one height.
- Barrier height is included in the model's Y maximum; it does not mean the road
  surface itself is elevated.
- Measurements describe model geometry, not whether the procedural generator
  knows how to connect or place the model.

## Road surfaces

### Ground-level pieces

These pieces have a ground-level surface at approximately Y = 0–0.02.

| Topology / role                   | Models                                                                | Footprint |
| --------------------------------- | --------------------------------------------------------------------- | --------- |
| Straight, crossing, and end tiles | `road_straight`, `road_crossing`, `road_end`                          | 1 × 1     |
| Bends                             | `road_bend`, `road_bendSquare`, `road_bendSidewalk`                   | 1 × 1     |
| Crossroads                        | `road_crossroad`, `road_crossroadLine`, `road_crossroadPath`          | 1 × 1     |
| Three-way intersections           | `road_intersection`, `road_intersectionLine`, `road_intersectionPath` | 1 × 1     |
| Driveway connections              | `road_drivewaySingle`, `road_drivewayDouble`                          | 1 × 1     |
| Side-road details                 | `road_side`, `road_sideEntry`, `road_sideExit`                        | 1 × 1.31  |
| Curved road pieces                | `road_curve`, `road_curvePavement`, `road_curveIntersection`          | 2 × 2     |
| Roundabout                        | `road_roundabout`                                                     | 3 × 3     |
| No-entry tile                     | `road_square`                                                         | 1 × 1     |
| Split / fork                      | `road_split`                                                          | 1 × 2     |

`road_split` is a branched piece: one road divides into two. It is not part of
the current linear showcase generator. `road_square` has no road connectors and
is used as a display tile beside an intersection branch.

### Elevated and sloped road pieces

These models span multiple Y values. Treat the values as approximate local
heights, not as connector metadata.

| Role                 | Models                                   | Footprint | Y range                                                      |
| -------------------- | ---------------------------------------- | --------- | ------------------------------------------------------------ |
| Bridge structure     | `road_bridge`                            | 1 × 1     | 0–0.52; deck is around Y = 0.5, with geometry down to ground |
| Low grade changes    | `road_slant`, `road_slantFlat`           | 1 × 1     | 0–0.27                                                       |
| High grade changes   | `road_slantHigh`, `road_slantFlatHigh`   | 1 × 1     | 0–0.52                                                       |
| Curved grade changes | `road_slantCurve`, `road_slantFlatCurve` | 2 × 1     | 0–0.52                                                       |

`road_slant*` pieces are not currently configured for procedural connection.
The model set includes raised geometry, but no road piece that is only an
unsupported "air" surface: the bridge includes structure down to ground, while
the slants span between ground and a raised height.

### Barrier variants

Barrier variants generally keep the footprint of their corresponding road
piece. Their model bounds reach about Y = 0.08 on flat roads. The slant barrier
variants reach about Y = 0.33 or Y = 0.58.

| Base piece                 | Barrier models                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| Bend                       | `road_bendBarrier`, `road_bendSquareBarrier`                           |
| Straight / end             | `road_straightBarrier`, `road_straightBarrierEnd`, `road_endBarrier`   |
| Crossroads / intersections | `road_crossroadBarrier`, `road_intersectionBarrier`                    |
| Curves                     | `road_curveBarrier`, `road_curveIntersectionBarrier`                   |
| Driveways                  | `road_drivewaySingleBarrier`, `road_drivewayDoubleBarrier`             |
| Roundabout                 | `road_roundaboutBarrier`                                               |
| Side roads                 | `road_sideBarrier`, `road_sideEntryBarrier`, `road_sideExitBarrier`    |
| Split / fork               | `road_splitBarrier`                                                    |
| No-entry tile              | `road_squareBarrier`                                                   |
| Slopes                     | `road_slantBarrier`, `road_slantCurveBarrier`, `road_slantHighBarrier` |

### Ground tiles

| Model            | Footprint | Y range | Description        |
| ---------------- | --------- | ------- | ------------------ |
| `tile_low`       | 1 × 1     | 0–0.02  | Low flat tile      |
| `tile_high`      | 1 × 1     | 0–0.25  | Raised flat tile   |
| `tile_slant`     | 1 × 1     | 0–0.27  | Sloped tile        |
| `tile_slantHigh` | 1 × 1     | 0–0.52  | Higher sloped tile |

## Roadside props

| Type                  | Models                                                             | Approximate height |
| --------------------- | ------------------------------------------------------------------ | ------------------ |
| Bridge supports       | `bridge_pillar`, `bridge_pillarWide`                               | 0.5                |
| Construction          | `construction_barrier`, `construction_light`, `construction_pylon` | 0.09–0.23          |
| Curved traffic lights | `light_curved`, `light_curvedCross`, `light_curvedDouble`          | 0.67               |
| Square traffic lights | `light_square`, `light_squareCross`, `light_squareDouble`          | 0.60               |

## Vehicles and vehicle parts

| Category         | Models                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency        | `ambulance`, `firetruck`, `police`, `tractorPolice`                                                                                                |
| Service and work | `delivery`, `deliveryFlat`, `garbageTruck`, `tractor`, `tractorShovel`, `truck`, `truckFlat`, `van`                                                |
| Passenger        | `hatchbackSports`, `sedan`, `sedanSports`, `suv`, `suvLuxury`, `taxi`                                                                              |
| Racing / future  | `race`, `raceFuture`                                                                                                                               |
| Wheels           | `wheelDark`, `wheelDefault`, `wheelRacing`, `wheelTractorBack`, `wheelTractorDarkBack`, `wheelTractorDarkFront`, `wheelTractorFront`, `wheelTruck` |

The browser scene follows the ambulance and drives several traffic vehicles on
both lanes of the generated road; showcase uses one traffic vehicle. Vehicles
are randomly selected when they reach the end of the road. The centralized
[`trafficVehicleData.ts`](../trafficVehicleData.ts) config excludes exact models
and type prefixes from the traffic pool (currently `tractorPolice` and the
`tractor` family). Wheel assets are parts, not vehicles, so they are filtered
separately. Vehicles whose GLBs contain `lightFront` geometry get emissive
headlights and headlight beams; `race` and `raceFuture` have no headlights and
therefore project no beams. Ambulances, firetrucks, police cars, and police
tractors also have animated emergency lights.

The showcase additionally parks one of every car model in dedicated lanes beside
the road, including the models excluded from traffic, with working headlights
and emergency lights where the model provides them. Display props get their own
lanes farther out, so neither group overlaps the road or each other. The moving
ambulance and the single opposite-direction traffic vehicle are unchanged.

## Procedural-generation coverage

The road preview loads all GLBs in `models/road`. The connected showcase uses
the subset with connection metadata in [`roadData.ts`](../roadData.ts).
The plain `road_side` piece has a wider asphalt mouth than standard road tiles.
The showcase connects it between `road_sideEntry` and `road_sideExit`, which
provide the width transitions on either side.
Every non-`road_` model is placed once in the showcase as a display prop: bridge
pillars, construction props, street lights, and ground tiles. Barrier, slant,
and split/fork models start with `road_` and are only available in the Space-key
preview; the procedural road generator does not connect them.
Street-light and construction-light lamp materials glow and cast warm point
lights in the showcase; lamp-head positions live in
[`src/showcase.ts`](../src/showcase.ts). The generated route also places evenly
spaced `light_curved` lamps along both road sides with their arms pointing at the
road, using placements from [`src/streetLamps.ts`](../src/streetLamps.ts).

## Asset source and license

The road assets are from Kenney's **City Kit Roads (1.0)**; the vehicle assets
are from Kenney's **Car Kit (1.4)**. Both bundled license files state CC0:
[`road/License.txt`](./road/License.txt) and [`cars/License.txt`](./cars/License.txt).
