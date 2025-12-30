# Voxel Explore

A WebGL2-powered voxel exploration game engine featuring ray-traced rendering, procedural terrain generation, and underwater cave exploration.

## Game Levels

### Sea Caves (`sea-caves.html`)
An underwater exploration game featuring:
- **Tropical island** with Minecraft-style terrain, trees, and flowers
- **Underwater cave system** with stalactites and stalagmites
- **Diving mechanics** - swim in 3D underwater, walk on land
- **Dynamic visibility** - fog increases with depth
- **Flashlight** for exploring dark underwater caves
- **Coral and seaweed** decorations on the seafloor

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

### Rendering (`engine.js`)
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
| Mouse | Look around |
| ESC | Release cursor |

## Architecture

```
voxel-explore/
├── engine.js              # Core voxel engine (WebGL2 rendering)
├── sea-caves.html         # Underwater cave exploration level
├── cave-level.html        # Floating asteroid cave level
├── minecraft-game2.html   # Classic terrain level
└── README.md              # This file
```

### Key Classes

#### `VoxelEngine` (engine.js)
Main rendering engine that handles:
- WebGL2 context and shader compilation
- Brick map texture management
- Camera and uniform updates
- Frame rendering

#### `BrickMapWorld` (engine.js)
Voxel storage using sparse brick map:
- `setVoxel(x, y, z, r, g, b)` - Place a colored voxel
- `getVoxel(x, y, z)` - Read voxel data
- Automatic brick allocation on first write
- Incremental GPU upload for modified bricks

#### `CaveGenerator` (in level files)
Procedural cave generation (see [Cave Generation Algorithm](#cave-generation-algorithm) for details)

#### `IslandGenerator` (sea-caves.html)
Minecraft-style terrain:
- 2D noise for height map
- Island shape with beach falloff
- Tree and flower placement
- Underwater coral/seaweed

## Technical Details

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
- Only occupied regions allocate memory (sparse storage)

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
# Then open http://localhost:8000/sea-caves.html
```

### Browser Requirements
- WebGL2 support (Chrome, Firefox, Edge, Safari 15+)

