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
Procedural cave generation:
- 3D noise for irregular cave shapes
- Stalactite/stalagmite formations
- Ceiling openings for light shafts
- Crystal and mineral deposits

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
- Pointer Lock API for mouse look

## License

MIT License
