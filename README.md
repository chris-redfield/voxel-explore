# Voxel Explore

A WebGL2-powered voxel exploration game engine featuring ray-traced rendering, procedural terrain generation, and underwater cave exploration.

## Game Levels

### Sea Caves (`index.html`)
An underwater exploration game featuring:
- **Tropical island** with Minecraft-style terrain, trees, and flowers
- **Underwater cave system** with stalactites and stalagmites
- **Diving mechanics** - swim in 3D underwater, walk on land
- **Dynamic visibility** - fog increases with depth
- **Flashlight** for exploring dark underwater caves
- **Coral and seaweed** decorations on the seafloor

#### Island Structures
- **Cabin** - A hollow wooden cabin with door and windows, located on the west side of the island
- **Lighthouse** - Striped lighthouse with spiral stairs on the east side of the island

#### Underwater Discoveries
- **Pirate Ship** - A sunken ship resting on the seafloor
- **Ancient Stonegate** - Mysterious ruins near the ship
- **Roman Poles** - Ancient columns, one standing upright, one fallen
- **Coral Reefs** - Colorful coral scattered across the ocean floor, rendered with sub-voxel detail

### Floating Asteroid Cave (`cave-level.html`)
A floating cave in the sky with:
- **Glowing orb lights** scattered throughout
- **Day/night cycle** toggle
- **Lantern** for personal lighting
- **Crystal and mineral deposits** in the walls

### Minecraft-style Terrain (`minecraft-game2.html`)
Classic procedural terrain with:
- **Grass, dirt, and stone** layers
- **Trees and flowers**
- **Walking and flying** modes

## Engine Features

### Rendering (`game/engine.js`)
- **GPU ray-traced voxel rendering** using WebGL2 fragment shaders
- **Brick Map Hierarchy** - 2-level spatial structure for efficient ray traversal
  - Coarse grid (e.g., 64x64x64) stores brick indices
  - Each brick contains 8x8x8 voxels
  - O(1) empty space skipping at coarse level
- **Dynamic lighting** - sun/moon, spotlights, orb lights
- **Shadows** via shadow ray tracing
- **Distance fog** with configurable density
- **Water surface rendering** - renders only top face of water voxels

### World Structure
```
World Size = Coarse Grid Size x Brick Size
Example: 64 coarse x 8 brick = 512 voxels per axis
```

### Controls
| Key | Action |
|-----|--------|
| WASD | Move / Swim |
| SPACE | Jump / Ascend |
| SHIFT | Sprint / Descend |
| F | Toggle Flight (cave-level) |
| L | Toggle Flashlight/Lantern |
| 0 | Unequip tool |
| 1 | Equip mining tool |
| Left Click | Mine voxel (with tool equipped) |
| Mouse | Look around |
| ESC | Release cursor |

## Architecture

```
voxel-explore/
├── index.html                 # Main game (Sea Caves)
├── game/                      # Game logic modules
│   ├── engine.js              # Core voxel engine (WebGL2 rendering)
│   ├── game.js                # Main game class and initialization
│   ├── player.js              # Player/Diver movement and physics
│   ├── config.js              # Game configuration constants
│   ├── cache.js               # IndexedDB cache for cave templates
│   └── generators/            # Procedural generation
│       ├── island.js          # Island terrain generator
│       └── cave.js            # Cave system generator
├── assets/                    # 3D models and voxel data
│   ├── cabin.obj/mtl/json     # Hollow cabin with door and windows
│   ├── ship.obj/mtl/json      # Pirate ship
│   ├── lighthouse.json        # Striped lighthouse
│   ├── lighthouse_stairs.json # Spiral staircase
│   ├── stonegate.json         # Ancient ruins
│   ├── roman-pole.json        # Roman column
│   ├── coral1-7.json          # Coral reef models (detail voxels)
│   └── coral/                 # Source OBJ files for corals
├── utils/                     # Asset creation utilities
│   ├── voxelize.py            # OBJ to voxel converter
│   ├── generate_coral.py      # Procedural branching coral generator
│   ├── generate_spiral_stairs.py
│   └── stripe_lighthouse.py
└── README.md
```

### Key Classes

#### `VoxelEngine` (game/engine.js)
Main rendering engine that handles:
- WebGL2 context and shader compilation
- Brick map texture management
- Camera and uniform updates
- Frame rendering

#### `BrickMapWorld` (game/engine.js)
Voxel storage using sparse brick map:
- `setVoxel(x, y, z, r, g, b)` - Place a colored voxel
- `getVoxel(x, y, z)` - Read voxel data
- Automatic brick allocation on first write
- Incremental GPU upload for modified bricks

#### `SeaCaveGame` (game/game.js)
Main game class that handles:
- World initialization and terrain generation
- Loading and placing voxel models
- Player input and physics
- Environment rendering (underwater effects, fog, lighting)

#### `Diver` (game/player.js)
Player controller with:
- Surface walking physics (gravity, jumping)
- Underwater 3D swimming
- Automatic environment detection (underwater/surface)

#### `IslandGenerator` (game/generators/island.js)
Minecraft-style terrain:
- 2D noise for height map
- Island shape with beach falloff
- Tree and flower placement
- Underwater coral/seaweed

#### `CaveGenerator` (game/generators/cave.js)
Procedural cave generation with:
- Ellipsoid cave shells with 3D noise
- Ceiling openings for light shafts
- Stalactites and stalagmites
- Ground details (crystals, rocks)

## Utilities

### OBJ to Voxel Converter (`utils/voxelize.py`)
Converts 3D OBJ models to voxel format for use in the game engine.

```bash
# Basic usage
python voxelize.py model.obj -r 64 -o model.json

# Make model hollow (for buildings)
python voxelize.py cabin.obj -r 32 --hollow -o cabin.json

# Exclude specific materials
python voxelize.py ship.obj -r 48 --exclude sails -o ship.json

# Override color
python voxelize.py pillar.obj -r 24 --color 128,128,128 -o pillar.json

# Rotate model
python voxelize.py model.obj -r 32 --rotate-y 90 -o model.json
```

#### Options
| Option | Description |
|--------|-------------|
| `-r, --resolution` | Voxel grid resolution (default: 64) |
| `-o, --output` | Output JSON file path |
| `-e, --exclude` | Material names to exclude |
| `-i, --include-objects` | Only include specific objects |
| `--color R,G,B` | Override all voxel colors |
| `--rotate-y DEGREES` | Rotate model around Y axis |
| `--hollow` | Remove interior voxels (keep only shell) |
| `--detail` | Generate 4x4x4 sub-voxels for higher resolution |
| `--compact` | Output compact array format |

### Procedural Coral Generator (`utils/generate_coral.py`)
Generates branching coral OBJ models for voxelization.

```bash
# Generate coral with default settings
python generate_coral.py -o coral.obj

# Customize coral shape
python generate_coral.py -o coral.obj -b 8 --height 1.5 -d 4 -r 0.02 -s 123
```

#### Options
| Option | Description |
|--------|-------------|
| `-o, --output` | Output OBJ file path |
| `-b, --branches` | Number of main branches (default: 6) |
| `--height` | Coral height in units (default: 3.5) |
| `-d, --depth` | Max branching depth (default: 4) |
| `-r, --radius` | Base branch radius (default: 0.12) |
| `-s, --seed` | Random seed for reproducibility |

#### Workflow
```bash
# 1. Generate coral mesh
python generate_coral.py -o ../assets/coral.obj -b 7 --height 1.0 -d 4 -r 0.02

# 2. Voxelize with detail for sub-voxel rendering
python voxelize.py ../assets/coral.obj -r 20 --detail -o ../assets/coral.json
```

## Technical Details

### Detail Voxels (Sub-Voxels)

The `--detail` flag enables 4x4x4 sub-voxel rendering for higher resolution models. This divides each voxel into 64 smaller sub-voxels, allowing for finer detail on edges and curves.

```bash
# Generate model with sub-voxel detail
python voxelize.py coral.obj -r 32 --detail -o coral.json
```

**How it works:**
- Base resolution is divided into 4x4x4 sub-voxels (e.g., resolution 32 → 128 effective resolution)
- Voxels that are fully solid with uniform color are stored as regular voxels
- Voxels with partial fill or mixed colors store individual sub-voxel data

**Output format with detail:**
```json
{
  "resolution": 32,
  "gridSize": { "x": 28, "y": 40, "z": 29 },
  "hasDetail": true,
  "voxelCount": 1500,
  "voxels": [
    { "x": 0, "y": 0, "z": 0, "r": 255, "g": 100, "b": 80 }
  ],
  "detailVoxelCount": 350,
  "detailVoxels": [
    {
      "x": 5, "y": 10, "z": 3,
      "subVoxels": [
        { "sx": 0, "sy": 0, "sz": 0, "r": 255, "g": 100, "b": 80 },
        { "sx": 1, "sy": 0, "sz": 0, "r": 250, "g": 95, "b": 75 }
      ]
    }
  ]
}
```

**Loading detail voxels in game:**
```javascript
// Load regular voxels
for (const v of data.voxels) {
    world.setVoxel(x + v.x, y + v.y, z + v.z, v.r, v.g, v.b);
}

// Load detail voxels with sub-voxel data
if (data.hasDetail) {
    for (const dv of data.detailVoxels) {
        for (const sv of dv.subVoxels) {
            world.setSubVoxel(x + dv.x, y + dv.y, z + dv.z,
                              sv.sx, sv.sy, sv.sz, sv.r, sv.g, sv.b);
        }
    }
}
```

### Voxel Colors
Voxels are stored as RGBA where:
- RGB = color (0-255)
- A = 255 for solid, 0 for air

### Water Detection
Water voxels are identified by their specific color:
```javascript
const WATER_COLOR = { r: 30, g: 90, b: 170 };
```
The engine renders only the top face of water voxels for a flat surface effect.

### Memory Usage
- Coarse grid: `coarseSize^3 x 4 bytes`
- Per brick: `8^3 x 4 = 2KB`
- Detail atlas: `detailAtlasSize^3` detail bricks max (default 48³ = 110,592)
- Only occupied regions allocate memory (sparse storage)

### Coral Reef System
Corals are placed randomly across the ocean floor using an optimized cached placement system.

**Coral Catalog** (`game.js`):
```javascript
this.coralCatalog = [
    { path: 'assets/coral1.json', gridSize: { x: 11, y: 20, z: 7 } },
    { path: 'assets/coral3.json', gridSize: { x: 11, y: 13, z: 16 }, noRotate: true },
    // ... more corals
];
```

**Optimizations:**
- **JSON Caching**: Each coral JSON is loaded once via `preloadCorals()`, then reused for all placements
- **90° Rotation**: Corals are randomly rotated in 90° increments (0°, 90°, 180°, 270°) with proper sub-voxel coordinate transformation
- **noRotate flag**: Models with asymmetric grids can disable rotation to prevent glitches

**Placement** (`placeCoralCached()`):
- Synchronous placement from cached data (no async overhead)
- Supports 90° Y-axis rotations with sub-voxel coordinate mapping
- Only places corals underwater (below sea level)

### Voxel Model Format
Models are stored as JSON with the following structure:
```json
{
  "resolution": 48,
  "gridSize": { "x": 28, "y": 16, "z": 29 },
  "voxelCount": 4097,
  "voxels": [
    { "x": 0, "y": 0, "z": 0, "r": 128, "g": 64, "b": 32 },
    ...
  ]
}
```

## Cave Generation Algorithm

The `CaveGenerator` class creates procedural underground caverns through a multi-step process:

### Step 1: Define Bounds
```javascript
const minX = Math.max(0, centerX - radius);
const maxX = Math.min(world.worldSize - 1, centerX + radius);
// ... same for Y and Z
```
Calculate the bounding box for the cave based on center position and radius, clamped to world bounds.

### Step 2: Pre-calculate Ceiling Openings
```javascript
const numOpenings = 8 + Math.floor(pseudoRandom(seed + 5000) * 10);  // 8-18 openings
for (let i = 0; i < numOpenings; i++) {
    ceilingOpenings.push({
        x: centerX + Math.cos(angle) * dist,
        z: centerZ + Math.sin(angle) * dist,
        radius: 10 + pseudoRandom(...) * 20  // 10-30 voxel radius
    });
}
```
Generate random circular openings that will be carved into the ceiling to create light shafts.

### Step 3: Generate Cave Shell
For each voxel position in the bounding box:

1. **Calculate ellipsoid distance** (cave is wider than tall):
   ```javascript
   const distXZ = Math.sqrt(dx * dx + dz * dz);
   const distY = Math.abs(dy) * 1.3;  // Flatten vertically
   const dist = Math.sqrt(distXZ * distXZ + distY * distY);
   ```

2. **Add 3D noise for irregular shape**:
   ```javascript
   const noise = noise3D(x, y, z, 0.025, seed) * 35;      // Large-scale variation
   const wallNoise = noise3D(x, y, z, 0.07, seed) * 18;   // Fine detail
   const effectiveRadius = radius + noise + wallNoise;
   ```

3. **Check ceiling openings** (skip voxels in opening areas):
   ```javascript
   if (y > centerY + radius * 0.3) {  // Upper part of cave
       for (const opening of ceilingOpenings) {
           if (distance to opening < opening.radius) {
               inOpening = true;
           }
       }
   }
   ```

4. **Place shell voxels** (only the outer shell, interior stays empty):
   ```javascript
   if (dist < effectiveRadius && !inOpening) {
       const shellThickness = 10 + noise3D(...) * 6;  // 10-16 voxels thick
       if (dist > effectiveRadius - shellThickness) {
           placeRockVoxel(world, x, y, z, isFloor: y < centerY);
       }
   }
   ```

### Step 4: Generate Formations

#### Stalagmites (grow UP from floor)
```javascript
const numStalagmites = 80 + pseudoRandom(...) * 120;  // 80-200 stalagmites
for each stalagmite:
    1. Pick random X,Z position within 75% of cave radius
    2. Scan DOWN from center to find floor surface
    3. If floor found, create tapered cone:
       - Height: 5-25 voxels
       - Base radius: 2-5 voxels
       - Tapers to point at top (radius * (1 - progress * 0.9))
```

#### Stalactites (hang DOWN from ceiling)
```javascript
const numStalactites = 100 + pseudoRandom(...) * 150;  // 100-250 stalactites
for each stalactite:
    1. Pick random X,Z position within 75% of cave radius
    2. Scan UP from center to find ceiling surface
    3. Skip water voxels (important for underwater caves!)
    4. Verify solid rock attachment point
    5. If ceiling found, create tapered cone:
       - Length: 4-22 voxels
       - Base radius: 1-3 voxels
       - Tapers to point at bottom (radius * (1 - progress * 0.95))
```

### Step 5: Add Ground Details
```javascript
const numDetails = 150 + pseudoRandom(...) * 100;  // 150-250 details
for each detail:
    1. Pick random X,Z position within 80% of cave radius
    2. Scan DOWN to find actual floor surface
    3. Place detail based on random chance:
       - 20% chance: Crystal cluster (3-voxel tall, blue or purple)
       - 30% chance: Small rock (single gray voxel)
       - 50% chance: Nothing (keep area clear)
```

### Visual Summary
```
        ~~~~ Ceiling Openings (light shafts) ~~~~
    ______________________________________________
   /                                              \
  /    ▼ ▼ ▼  Stalactites hang from ceiling  ▼ ▼  \
 |                                                  |
 |              [ Empty Cave Interior ]             |
 |                                                  |
 |     ▲ ▲ ▲  Stalagmites grow from floor   ▲ ▲    |
  \___◆___◆_____◆___◆___◆_____◆___◆___◆___◆______/
      Crystals and rocks scattered on floor
```

## Development

### Running Locally
Simply open any HTML file in a modern browser with WebGL2 support:
```bash
# Using Python's built-in server
python -m http.server 8000
# Then open http://localhost:8000/
```

### Adding New Voxel Models
1. Export your 3D model as OBJ format with MTL materials
2. Convert to voxels using the voxelizer:
   ```bash
   python utils/voxelize.py assets/model.obj -r 32 -o assets/model.json
   ```
3. Load in game.js using `loadVoxelModel()`:
   ```javascript
   await this.loadVoxelModel('assets/model.json', x, y, z);
   ```

### Browser Requirements
- WebGL2 support (Chrome, Firefox, Edge, Safari 15+)

## Mining System

### Voxel Destruction
Players can destroy voxels using the mining tool:

| Key | Action |
|-----|--------|
| 0 | Unequip tool |
| 1 | Equip mining tool |
| Left Click | Mine targeted voxel (8 block reach) |

### Debris Particle Animation
When a voxel is destroyed, it breaks into 4 sub-voxel sized particles that scatter with physics:
- **Gravity**: Particles fall and bounce off solid voxels
- **Spread**: Random velocity scatters debris outward
- **Lifetime**: Particles fade after 1.5-2 seconds

### Technical Implementation

**Current approach: GPU Ray-traced Particles**

Debris particles are rendered by the fragment shader alongside voxels:
```glsl
// For every pixel, test ray against all particles
for (int i = 0; i < 32; i++) {
    if (i >= u_numDebris) break;
    // Ray-box intersection test
}
```

**Performance characteristics:**
- Cost: `screen_pixels × particle_count` intersection tests per frame
- Current limits: 32 particles max (4 per voxel × 8 simultaneous voxels)
- Particles are tested even when off-screen or behind camera

**Limitations:**
- Does not scale well beyond ~32 particles
- Full-screen cost regardless of particle screen coverage
- Loop iterations fixed at compile time (GPU SIMD constraints)

### Future Improvement: Instanced Rendering

For large-scale particle effects (explosions, mass destruction), the proper solution is **instanced rasterization**:

```
// Instead of ray-tracing each particle:
For EVERY particle:
    Draw a small cube mesh (GPU handles pixel coverage automatically)
```

**Benefits of instanced rendering:**
| Aspect | Ray-traced (current) | Instanced (future) |
|--------|---------------------|-------------------|
| 32 particles | 2M pixels × 32 tests | 32 tiny cubes |
| Off-screen particles | Still tested | Zero cost (culled) |
| 1000 particles | Impossible | Easy, one draw call |
| Scaling | O(pixels × particles) | O(particles) |

**Implementation requirements:**
- Separate render pass for particles
- Depth buffer integration with ray-traced voxel world
- Instance buffer for particle positions/colors

## TODO

### Detail Voxel Rotation - Asymmetric Grids
The `placeCoralCached()` function now supports 90° rotation increments (0°, 90°, 180°, 270°) with proper sub-voxel coordinate transformation. However, models with highly asymmetric grid dimensions (e.g., coral3 with gridSize 11x13x16) may cause visual glitches when rotated.

**Current workaround:** The coral catalog supports a `noRotate: true` flag for problematic models:
```javascript
this.coralCatalog = [
    { path: 'assets/coral1.json', gridSize: { x: 11, y: 20, z: 7 } },
    { path: 'assets/coral3.json', gridSize: { x: 11, y: 13, z: 16 }, noRotate: true },  // Asymmetric - don't rotate
    // ...
];
```

**Known issue:** `coral3.json` has rotation disabled due to asymmetric X/Z dimensions causing placement glitches.

**To fully fix:** The rotation logic needs to account for grid dimension swapping when rotating 90°/270° - after rotation, a model's effective X and Z dimensions swap, affecting center calculations.
