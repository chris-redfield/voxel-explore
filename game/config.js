// ============================================================
// Game Configuration Constants
// ============================================================

// World settings
const SEA_LEVEL = 300;      // Y coordinate of sea surface - HIGH to allow HUGE deep caves
const MAX_DEPTH = 280;      // Maximum depth below sea level
const ISLAND_RADIUS = 120;  // Radius of the island

// Cave system configuration
const CAVE_SIZE = 5;        // Number of connected cave spheres (1 = single cave, 2+ = worm structure)
const CAVE_RADIUS = 180;    // Radius of each cave sphere
const CAVE_OVERLAP = 0.25;  // How much caves overlap (0 = just touching, 0.25 = nice tunnel connection)

// Player speed configuration (easy to tweak)
const SWIM_SPEED = 20;       // Base swimming speed
const FAST_SWIM_SPEED = 28;  // Sprint swimming speed with Shift
const WALK_SPEED = 5;        // Walking speed on land
const SPRINT_SPEED = 8;      // Sprinting speed on land

// Water voxel color (used to identify water for collision)
const WATER_COLOR = { r: 30, g: 90, b: 170 };
