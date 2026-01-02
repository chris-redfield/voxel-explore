// ============================================================
// Main Game - Sea Caves Exploration
// Depends on: config.js, cache.js, generators/island.js, generators/cave.js, player.js
// ============================================================

class SeaCaveGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = new VoxelEngine(this.canvas);
        this.player = new Diver();
        this.terrain = new IslandGenerator(Math.floor(Math.random() * 100000));
        this.caveGen = new CaveGenerator(Math.floor(Math.random() * 100000));

        this.worldOffset = 0;
        this.loadTime = 0;
        this.maxDepthReached = 0;

        this.keys = {};
        this.isLocked = false;
        this.mouseDelta = { x: 0, y: 0 };
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsTime = performance.now();

        // Coral catalog for underwater flora
        // Each entry: { path, gridSize: {x, y, z} } - gridSize used to calculate Y offset
        this.coralCatalog = [
            { path: 'assets/coral1.json', gridSize: { x: 11, y: 20, z: 7 } },   // Generated branching coral
            { path: 'assets/coral2.json', gridSize: { x: 8, y: 16, z: 6 } },    // Coral.obj
            { path: 'assets/coral3.json', gridSize: { x: 11, y: 13, z: 16 } },  // Coral1.obj
            { path: 'assets/coral4.json', gridSize: { x: 11, y: 16, z: 10 } },  // Coral2.obj
            { path: 'assets/coral5.json', gridSize: { x: 15, y: 16, z: 14 } },  // Coral3.obj
            { path: 'assets/coral6.json', gridSize: { x: 3, y: 16, z: 16 } },   // Coral4.obj
            { path: 'assets/coral7.json', gridSize: { x: 6, y: 16, z: 8 } },    // Coral5.obj
        ];

        this._setupInput();
    }

    _setupInput() {
        window.addEventListener('keydown', e => {
            if (this.keys[e.code]) return;
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.player.isUnderwater && this.player.onGround) {
                    this.player.vy = this.player.jumpForce;
                    this.player.onGround = false;
                }
            }
            if (e.code === 'KeyL') {
                this._toggleFlashlight();
            }
            if (e.code === 'Escape' && this.isLocked) document.exitPointerLock();
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        this.canvas.addEventListener('click', () => {
            if (!this.isLocked) this.canvas.requestPointerLock();
        });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
            document.getElementById('overlay').classList.toggle('hidden', this.isLocked);
            document.querySelector('.crosshair').classList.toggle('visible', this.isLocked);
            this.canvas.parentElement.classList.toggle('locked', this.isLocked);
            if (!this.isLocked) this.keys = {};
        });
        window.addEventListener('blur', () => this.keys = {});
        document.addEventListener('mousemove', e => {
            if (this.isLocked) {
                this.mouseDelta.x += e.movementX;
                this.mouseDelta.y += e.movementY;
            }
        });
        window.addEventListener('resize', () => this._resize());

        // Flashlight toggle
        document.getElementById('flashlight-toggle').addEventListener('change', (e) => {
            this.engine.settings.lanternEnabled = e.target.checked;
            this._updateFlashlightIcon(e.target.checked);
        });
    }

    _toggleFlashlight() {
        const toggle = document.getElementById('flashlight-toggle');
        toggle.checked = !toggle.checked;
        this.engine.settings.lanternEnabled = toggle.checked;
        this._updateFlashlightIcon(toggle.checked);
    }

    _updateFlashlightIcon(enabled) {
        const icon = document.getElementById('flashlight-icon');
        icon.style.textShadow = enabled ? '0 0 10px #ffdd44' : 'none';
    }

    async init() {
        const loadingBar = document.getElementById('loading-bar');
        const loadingText = document.getElementById('loading-text');
        const loadingStats = document.getElementById('loading-stats');

        const startTime = performance.now();

        const progress = (p, text, stats = '') => {
            loadingBar.style.width = (p * 100) + '%';
            loadingText.textContent = text;
            loadingStats.textContent = stats;
        };

        // Check if we need to generate cave templates (first-time setup)
        const cachedCount = await CaveCache.getCaveCount();
        if (cachedCount < CaveCache.NUM_CAVES) {
            await this._firstTimeSetup(progress, cachedCount);
        }

        progress(0, 'Creating ocean world...', '');
        await this._delay(50);

        // Create world: 64 coarse = 512³ voxels
        this.engine.createWorld(128, 8);  // 128*8 = 1024³ world to fit large cave
        this.worldOffset = Math.floor(this.engine.world.worldSize / 2);

        document.getElementById('world-size').textContent =
            this.engine.world.worldSize + '³';
        document.getElementById('sea-level').textContent = SEA_LEVEL;
        document.getElementById('max-depth').textContent = MAX_DEPTH + 'm';

        progress(0.05, 'Generating island and seafloor...', '');
        await this._delay(50);

        // Generate terrain with progress callback
        console.time('TERRAIN');
        let lastUpdate = performance.now();
        this.terrain.generateWorld(this.engine.world, this.worldOffset, (p) => {
            const now = performance.now();
            if (now - lastUpdate > 100) {
                progress(0.05 + p * 0.40,
                    `Generating terrain: ${Math.floor(p * 100)}%`,
                    '');
                lastUpdate = now;
            }
        });
        console.timeEnd('TERRAIN');

        // Load cave from cache and apply to world
        progress(0.48, 'Loading cave from cache...', '');
        await this._delay(50);

        // Calculate cave centers for worm structure
        const caveCenters = this._calculateCaveCenters();
        this.caveCenters = caveCenters;

        // Load random cave template from cache
        console.time('CAVES_FROM_CACHE');
        const caveTemplate = await CaveCache.getRandomCave();

        if (caveTemplate) {
            progress(0.55, 'Applying cave template...', `${caveTemplate.length.toLocaleString()} voxels`);
            await this._delay(10);

            // Apply the same template to each cave position
            for (let i = 0; i < caveCenters.length; i++) {
                const cave = caveCenters[i];
                console.time(`APPLY_CAVE_${i + 1}`);
                this._applyCaveTemplate(caveTemplate, cave.x, cave.y, cave.z);
                console.timeEnd(`APPLY_CAVE_${i + 1}`);
                console.log(`Cave ${i + 1} applied at (${cave.x}, ${cave.y}, ${cave.z})`);
            }
        } else {
            console.warn('No cached caves found!');
        }
        console.timeEnd('CAVES_FROM_CACHE');

        // Carve connecting tunnels between adjacent caves
        if (caveCenters.length > 1) {
            progress(0.81, 'Carving connecting tunnels...', '');
            await this._delay(10);
            console.time('TUNNELS');
            this._carveConnectingTunnels(caveCenters);
            console.timeEnd('TUNNELS');
        }

        // Generate formations for all caves
        progress(0.82, 'Growing stalagmites and stalactites...', '');
        await this._delay(10);
        console.time('FORMATIONS');
        for (const cave of caveCenters) {
            this.caveGen._generateFormations(this.engine.world, cave.x, cave.y, cave.z, CAVE_RADIUS);
        }
        console.timeEnd('FORMATIONS');

        // Add ground details for all caves
        progress(0.86, 'Adding cave details...', '');
        await this._delay(10);
        console.time('DETAILS');
        for (const cave of caveCenters) {
            this.caveGen._addGroundDetails(this.engine.world, cave.x, cave.y, cave.z, CAVE_RADIUS);
        }
        console.timeEnd('DETAILS');

        console.log(`Cave system generated: ${caveCenters.length} connected caves`);

        // Load and place the pirate ship near the island
        progress(0.87, 'Loading pirate ship...', '');
        await this._delay(10);

        // Place ship on the ACTUAL seafloor, north of island (away from caves)
        const shipX = this.worldOffset + 180;  // East of island
        const shipZ = this.worldOffset - 280;  // Far north (away from caves)

        // Get the actual terrain height at this position so ship sits ON the bottom
        const shipNoiseX = shipX - this.worldOffset;
        const shipNoiseZ = shipZ - this.worldOffset;
        const seafloorHeight = this.terrain.getHeight(shipNoiseX, shipNoiseZ);
        // Ship model is centered, so add half its height (83/2 ≈ 42) to lift it up
        // so the hull bottom rests on the ground, not buried
        const shipY = seafloorHeight + 42;    // Lift so bottom touches ground
        const shipTilt = 0;                    // No tilt for now

        console.log(`Placing ship at seafloor height: ${seafloorHeight}`);
        await this.loadVoxelModel('assets/ship.json', shipX, shipY, shipZ, 1, shipTilt);

        // Place ancient stonegate ruins near the ship
        const ruinsX = shipX - 120;  // Further west of ship
        const ruinsZ = shipZ + 100;  // Further south of ship
        const ruinsNoiseX = ruinsX - this.worldOffset;
        const ruinsNoiseZ = ruinsZ - this.worldOffset;
        const ruinsFloorHeight = this.terrain.getHeight(ruinsNoiseX, ruinsNoiseZ);
        // Stonegate is 40x39x16, sink 5 voxels into ground (20 - 5 = 15) for ancient look
        const ruinsY = ruinsFloorHeight + 15;
        console.log(`Placing ruins at seafloor height: ${ruinsFloorHeight}`);
        await this.loadVoxelModel('assets/stonegate.json', ruinsX, ruinsY, ruinsZ, 1, 0, 45);

        // Place roman poles - far from both ship and portal, in open seafloor
        // Position them west of ruins, far from ship (which is east/north)
        // Pole 1: Standing upright
        const pole1X = ruinsX - 100;  // Far west of ruins
        const pole1Z = ruinsZ - 60;   // Slightly north
        const pole1FloorHeight = this.terrain.getHeight(pole1X - this.worldOffset, pole1Z - this.worldOffset);
        // Single column is smaller now, height ~28, so half is 14
        await this.loadVoxelModel('assets/roman-pole.json', pole1X, pole1FloorHeight + 14, pole1Z);

        // Pole 2: Fallen over (90 degree tilt - lying on seafloor)
        const pole2X = pole1X - 50;   // Further west
        const pole2Z = pole1Z + 40;   // Slightly south
        const pole2FloorHeight = this.terrain.getHeight(pole2X - this.worldOffset, pole2Z - this.worldOffset);
        await this.loadVoxelModel('assets/roman-pole.json', pole2X, pole2FloorHeight + 4, pole2Z, 1, 90);

        // Place lighthouse on the island, near the edge but before the beach
        const lighthouseX = this.worldOffset + 70;   // East side of island
        const lighthouseZ = this.worldOffset + 20;   // Slightly south
        const lighthouseNoiseX = lighthouseX - this.worldOffset;
        const lighthouseNoiseZ = lighthouseZ - this.worldOffset;
        const lighthouseGroundHeight = this.terrain.getHeight(lighthouseNoiseX, lighthouseNoiseZ);
        // Lighthouse model height is 48, add half (24) to place bottom on ground
        const lighthouseY = lighthouseGroundHeight + 24;

        console.log(`Placing lighthouse at ground height: ${lighthouseGroundHeight}`);
        await this.loadVoxelModel('assets/lighthouse.json', lighthouseX, lighthouseY, lighthouseZ);

        // Add spiral stairs around the lighthouse (same position, stairs wrap around it)
        // Stairs grid is 11x48x11, centered at same position as lighthouse
        await this.loadVoxelModel('assets/lighthouse_stairs.json', lighthouseX, lighthouseY, lighthouseZ);

        // Place cabin on the opposite side of island from lighthouse
        // Lighthouse is at +70, +20 (east), so cabin goes at -60, -15 (west)
        // Staying within islandFactor < 0.65 to be on grass, not sand
        progress(0.875, 'Loading cabin...', '');
        await this._delay(10);
        const cabinX = this.worldOffset - 60;   // West side of island (opposite lighthouse)
        const cabinZ = this.worldOffset - 15;   // Slightly north
        const cabinNoiseX = cabinX - this.worldOffset;
        const cabinNoiseZ = cabinZ - this.worldOffset;
        const cabinGroundHeight = this.terrain.getHeight(cabinNoiseX, cabinNoiseZ);
        // Cabin model height is 16, add half minus 1 to place bottom on ground
        const cabinY = cabinGroundHeight + 7;

        console.log(`Placing cabin at ground height: ${cabinGroundHeight}`);
        await this.loadVoxelModel('assets/cabin.json', cabinX, cabinY, cabinZ);

        // ADD underwater flora / fauna
        // For now, placing coral reefs near spawn on surface for quick iteration
        progress(0.876, 'Adding coral reefs...', '');
        await this._delay(10);

        // Place one of each coral type in a row for testing
        // Spread them out in front of spawn point
        for (let i = 0; i < this.coralCatalog.length; i++) {
            const coral = this.coralCatalog[i];
            // Arrange in a semi-circle arc in front of spawn
            const angle = (i / (this.coralCatalog.length - 1) - 0.5) * Math.PI * 0.6; // -54° to +54°
            const distance = 18;
            const dx = Math.sin(angle) * distance;
            const dz = Math.cos(angle) * distance;

            const coralX = this.worldOffset + dx;
            const coralZ = this.worldOffset + dz;
            const coralNoiseX = coralX - this.worldOffset;
            const coralNoiseZ = coralZ - this.worldOffset;
            const coralGroundHeight = this.terrain.getHeight(coralNoiseX, coralNoiseZ);
            // Use gridSize.y / 2 as Y offset so coral sits on ground
            const coralY = coralGroundHeight + Math.floor(coral.gridSize.y / 2);

            // Note: rotation disabled for detail voxels (sub-voxels don't rotate properly yet)
            console.log(`Placing coral ${i + 1} (${coral.path}) at (${coralX}, ${coralY}, ${coralZ})`);
            await this.loadVoxelModel(coral.path, coralX, coralY, coralZ);
        }

        const genTime = performance.now();
        progress(0.88, 'Uploading to GPU...', `Generation: ${((genTime - startTime)/1000).toFixed(1)}s`);
        await this._delay(50);

        // Upload to GPU
        console.time('GPU_UPLOAD');
        this.engine.uploadWorld();
        console.timeEnd('GPU_UPLOAD');

        const uploadTime = performance.now();
        progress(0.95, 'Setting spawn point...', `Upload: ${((uploadTime - genTime)/1000).toFixed(1)}s`);
        await this._delay(50);

        // Spawn player on the island - calculate actual terrain height
        const spawnX = this.worldOffset;
        const spawnZ = this.worldOffset;
        // Get terrain height at center (noise coords 0,0)
        const terrainHeight = this.terrain.getHeight(0, 0);
        const spawnY = terrainHeight + 3;  // Spawn above the terrain

        console.log(`Terrain height at spawn: ${terrainHeight}, spawning at Y=${spawnY}`);

        this.player.x = spawnX;
        this.player.y = spawnY;
        this.player.z = spawnZ;
        this.player.setSpawn(this.player.x, this.player.y, this.player.z);

        this.loadTime = (performance.now() - startTime) / 1000;

        progress(1, 'Ready!', `Total: ${this.loadTime.toFixed(1)}s`);
        await this._delay(500);

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('overlay').classList.remove('hidden');

        // Initial settings - bright day, above water
        this.engine.settings.enableShadows = true;
        this.engine.settings.fogDensity = 0.5;
        this.engine.settings.skyColorTop = [0.4, 0.7, 1.0];
        this.engine.settings.skyColorBottom = [0.7, 0.85, 1.0];
        this.engine.settings.lanternEnabled = false;
        this.engine.settings.lanternIntensity = 5.0;
        this.engine.settings.lanternConeAngle = 0.5;
        this.engine.camera.fov = 70;

        // Water surface rendering - normalized color (0-1 range)
        // This tells the engine which voxels are water, so only their top face renders
        this.engine.settings.waterColor = [
            WATER_COLOR.r / 255,
            WATER_COLOR.g / 255,
            WATER_COLOR.b / 255
        ];

        // Set up depth meter sea level line
        const meterHeight = 200;
        const seaLevelPercent = 0.5; // Middle of the meter
        document.getElementById('sea-level-line').style.bottom =
            (seaLevelPercent * meterHeight) + 'px';

        this._resize();

        console.log('=== SEA CAVES LOADED ===');
        console.log(`World size: ${this.engine.world.worldSize}³`);
        console.log(`Sea level: ${SEA_LEVEL}`);
        console.log(`Voxels: ${this.engine.getVoxelCount().toLocaleString()}`);
        console.log(`Memory: ${this.engine.getMemoryUsage().totalMB.toFixed(2)} MB`);
        console.log(`Load time: ${this.loadTime.toFixed(1)}s`);
    }

    _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Load a voxel model from JSON and place it in the world
    // tiltAngle: rotation around Z axis (roll), yawAngle: around Y axis, pitchAngle: around X axis
    async loadVoxelModel(jsonPath, offsetX, offsetY, offsetZ, scale = 1, tiltAngle = 0, yawAngle = 0, pitchAngle = 0) {
        console.log(`Loading voxel model: ${jsonPath}`);

        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`Failed to load ${jsonPath}`);

            const data = await response.json();
            const voxels = data.voxels;
            const world = this.engine.world;
            const gridSize = data.gridSize;

            // Calculate center of model for rotation
            const centerX = gridSize.x / 2;
            const centerY = gridSize.y / 2;
            const centerZ = gridSize.z / 2;

            // Convert angles to radians
            const tiltRad = tiltAngle * Math.PI / 180;
            const cosT = Math.cos(tiltRad);
            const sinT = Math.sin(tiltRad);
            const yawRad = yawAngle * Math.PI / 180;
            const cosY = Math.cos(yawRad);
            const sinY = Math.sin(yawRad);
            const pitchRad = pitchAngle * Math.PI / 180;
            const cosP = Math.cos(pitchRad);
            const sinP = Math.sin(pitchRad);

            console.log(`  Placing ${voxels.length} voxels at (${offsetX}, ${offsetY}, ${offsetZ}), tilt: ${tiltAngle}°, yaw: ${yawAngle}°, pitch: ${pitchAngle}°`);

            let placed = 0;
            for (const v of voxels) {
                // Center the coordinates
                let lx = v.x - centerX;
                let ly = v.y - centerY;
                let lz = v.z - centerZ;

                // Apply tilt rotation around Z axis (roll)
                if (tiltAngle !== 0) {
                    const newLx = lx * cosT - ly * sinT;
                    const newLy = lx * sinT + ly * cosT;
                    lx = newLx;
                    ly = newLy;
                }

                // Apply yaw rotation around Y axis
                if (yawAngle !== 0) {
                    const newLx = lx * cosY + lz * sinY;
                    const newLz = -lx * sinY + lz * cosY;
                    lx = newLx;
                    lz = newLz;
                }

                // Apply pitch rotation around X axis
                if (pitchAngle !== 0) {
                    const newLy = ly * cosP - lz * sinP;
                    const newLz = ly * sinP + lz * cosP;
                    ly = newLy;
                    lz = newLz;
                }

                // Apply scale and offset
                const wx = Math.floor(offsetX + lx * scale);
                const wy = Math.floor(offsetY + ly * scale);
                const wz = Math.floor(offsetZ + lz * scale);

                // Check bounds
                if (wx >= 0 && wx < world.worldSize &&
                    wy >= 0 && wy < world.worldSize &&
                    wz >= 0 && wz < world.worldSize) {
                    world.setVoxel(wx, wy, wz, v.r, v.g, v.b);
                    placed++;
                }
            }

            console.log(`  Placed ${placed} voxels`);

            // Handle detail voxels if present
            let detailPlaced = 0;
            if (data.hasDetail && data.detailVoxels) {
                console.log(`  Loading ${data.detailVoxels.length} detail voxels...`);

                for (const dv of data.detailVoxels) {
                    // Center the parent voxel coordinates
                    let lx = dv.x - centerX;
                    let ly = dv.y - centerY;
                    let lz = dv.z - centerZ;

                    // Apply rotations (same as regular voxels)
                    if (tiltAngle !== 0) {
                        const newLx = lx * cosT - ly * sinT;
                        const newLy = lx * sinT + ly * cosT;
                        lx = newLx;
                        ly = newLy;
                    }
                    if (yawAngle !== 0) {
                        const newLx = lx * cosY + lz * sinY;
                        const newLz = -lx * sinY + lz * cosY;
                        lx = newLx;
                        lz = newLz;
                    }
                    if (pitchAngle !== 0) {
                        const newLy = ly * cosP - lz * sinP;
                        const newLz = ly * sinP + lz * cosP;
                        ly = newLy;
                        lz = newLz;
                    }

                    const wx = Math.floor(offsetX + lx * scale);
                    const wy = Math.floor(offsetY + ly * scale);
                    const wz = Math.floor(offsetZ + lz * scale);

                    if (wx >= 0 && wx < world.worldSize &&
                        wy >= 0 && wy < world.worldSize &&
                        wz >= 0 && wz < world.worldSize) {
                        for (const sv of dv.subVoxels) {
                            world.setDetailVoxel(wx, wy, wz, sv.sx, sv.sy, sv.sz, sv.r, sv.g, sv.b);
                            detailPlaced++;
                        }
                    }
                }
                console.log(`  Placed ${detailPlaced} sub-voxels in ${data.detailVoxels.length} detail voxels`);
            }

            return { placed, detailPlaced, gridSize: data.gridSize };
        } catch (e) {
            console.error(`Failed to load voxel model: ${e}`);
            return null;
        }
    }

    // Generate a cave template (voxels stored relative to center)
    async _generateCaveTemplate(seed, radius, progress) {
        const voxels = [];
        const caveGen = new CaveGenerator(seed);

        const maxNoise = 55;
        const maxShellThickness = 18;
        const outerBound = radius + maxNoise;
        const innerBound = Math.max(0, radius - maxNoise - maxShellThickness);

        // Bounds relative to center (0, 0, 0)
        const minX = -Math.ceil(outerBound);
        const maxX = Math.ceil(outerBound);

        // Ceiling openings
        const ceilingOpenings = [];
        const numOpenings = 8 + Math.floor(caveGen.pseudoRandom(seed + 5000) * 10);
        for (let i = 0; i < numOpenings; i++) {
            const angle = caveGen.pseudoRandom(seed + i * 100) * Math.PI * 2;
            const dist = caveGen.pseudoRandom(seed + i * 100 + 50) * radius * 0.6;
            const openingRadius = 10 + caveGen.pseudoRandom(seed + i * 200) * 20;
            ceilingOpenings.push({
                x: Math.cos(angle) * dist,
                z: Math.sin(angle) * dist,
                radius: openingRadius
            });
        }

        // Pre-compute sparse noise grid
        const NOISE_STEP = 8;
        const gridMin = Math.floor(-outerBound / NOISE_STEP) - 1;
        const gridMax = Math.ceil(outerBound / NOISE_STEP) + 1;
        const gridSize = gridMax - gridMin + 1;

        const noiseGrid1 = new Float32Array(gridSize * gridSize * gridSize);
        const noiseGrid2 = new Float32Array(gridSize * gridSize * gridSize);
        const noiseGrid3 = new Float32Array(gridSize * gridSize * gridSize);

        for (let gx = 0; gx < gridSize; gx++) {
            for (let gy = 0; gy < gridSize; gy++) {
                for (let gz = 0; gz < gridSize; gz++) {
                    const wx = (gridMin + gx) * NOISE_STEP;
                    const wy = (gridMin + gy) * NOISE_STEP;
                    const wz = (gridMin + gz) * NOISE_STEP;
                    const idx = gx + gy * gridSize + gz * gridSize * gridSize;
                    noiseGrid1[idx] = caveGen.noise3D(wx, wy, wz, 0.025, seed) * 35;
                    noiseGrid2[idx] = caveGen.noise3D(wx, wy, wz, 0.07, seed + 1000) * 18;
                    noiseGrid3[idx] = caveGen.noise3D(wx, wy, wz, 0.04, seed + 2000) * 6;
                }
            }
        }

        const sampleNoise = (grid, x, y, z) => {
            const fx = x / NOISE_STEP - gridMin;
            const fy = y / NOISE_STEP - gridMin;
            const fz = z / NOISE_STEP - gridMin;
            const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
            const xd = fx - x0, yd = fy - y0, zd = fz - z0;
            const cx0 = Math.max(0, Math.min(x0, gridSize - 1));
            const cx1 = Math.max(0, Math.min(x0 + 1, gridSize - 1));
            const cy0 = Math.max(0, Math.min(y0, gridSize - 1));
            const cy1 = Math.max(0, Math.min(y0 + 1, gridSize - 1));
            const cz0 = Math.max(0, Math.min(z0, gridSize - 1));
            const cz1 = Math.max(0, Math.min(z0 + 1, gridSize - 1));
            const c000 = grid[cx0 + cy0 * gridSize + cz0 * gridSize * gridSize];
            const c100 = grid[cx1 + cy0 * gridSize + cz0 * gridSize * gridSize];
            const c010 = grid[cx0 + cy1 * gridSize + cz0 * gridSize * gridSize];
            const c110 = grid[cx1 + cy1 * gridSize + cz0 * gridSize * gridSize];
            const c001 = grid[cx0 + cy0 * gridSize + cz1 * gridSize * gridSize];
            const c101 = grid[cx1 + cy0 * gridSize + cz1 * gridSize * gridSize];
            const c011 = grid[cx0 + cy1 * gridSize + cz1 * gridSize * gridSize];
            const c111 = grid[cx1 + cy1 * gridSize + cz1 * gridSize * gridSize];
            const c00 = c000 * (1 - xd) + c100 * xd;
            const c01 = c001 * (1 - xd) + c101 * xd;
            const c10 = c010 * (1 - xd) + c110 * xd;
            const c11 = c011 * (1 - xd) + c111 * xd;
            const c0 = c00 * (1 - yd) + c10 * yd;
            const c1 = c01 * (1 - yd) + c11 * yd;
            return c0 * (1 - zd) + c1 * zd;
        };

        const totalSlices = maxX - minX + 1;
        let processed = 0;
        let lastUpdate = performance.now();

        // Generate shell voxels
        for (let x = minX; x <= maxX; x++) {
            const dx2 = x * x;
            const maxZDist = Math.sqrt(Math.max(0, outerBound * outerBound - dx2));
            const zStart = Math.floor(-maxZDist);
            const zEnd = Math.ceil(maxZDist);

            for (let z = zStart; z <= zEnd; z++) {
                const distXZ2 = dx2 + z * z;
                if (distXZ2 > outerBound * outerBound) continue;

                const outerDY = Math.sqrt(Math.max(0, outerBound * outerBound - distXZ2)) / 1.3;
                const innerDY = distXZ2 < innerBound * innerBound
                    ? Math.sqrt(innerBound * innerBound - distXZ2) / 1.3 : 0;

                const yRanges = innerDY > 0
                    ? [[Math.floor(-outerDY), Math.ceil(-innerDY)], [Math.floor(innerDY), Math.ceil(outerDY)]]
                    : [[Math.floor(-outerDY), Math.ceil(outerDY)]];

                for (const [yStart, yEnd] of yRanges) {
                    for (let y = yStart; y <= yEnd; y++) {
                        const distY = Math.abs(y) * 1.3;
                        const dist = Math.sqrt(distXZ2 + distY * distY);
                        if (dist < innerBound || dist > outerBound) continue;

                        const noise = sampleNoise(noiseGrid1, x, y, z);
                        const wallNoise = sampleNoise(noiseGrid2, x, y, z);
                        const effectiveRadius = radius + noise + wallNoise;
                        if (dist >= effectiveRadius) continue;

                        // Check ceiling openings
                        let inOpening = false;
                        if (y > radius * 0.3) {
                            for (const opening of ceilingOpenings) {
                                const openDist = Math.sqrt((x - opening.x) ** 2 + (z - opening.z) ** 2);
                                if (openDist < opening.radius) {
                                    const edgeFactor = openDist / opening.radius;
                                    const heightFactor = (y - radius * 0.3) / (radius * 0.4);
                                    if (edgeFactor < 0.8 || (edgeFactor < 1.0 && heightFactor > 0.5)) {
                                        inOpening = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!inOpening) {
                            const shellThickness = 10 + sampleNoise(noiseGrid3, x, y, z);
                            if (dist > effectiveRadius - shellThickness) {
                                // Generate color
                                const isFloor = y < 0;
                                const v = caveGen.pseudoRandom(x * 1000 + y * 100 + z);
                                let r, g, b;
                                if (isFloor) {
                                    if (v > 0.95) { r = 180 + (v * 50) | 0; g = 170 + (v * 40) | 0; b = 140 + (v * 30) | 0; }
                                    else if (v > 0.8) { r = 45 + (v * 15) | 0; g = 40 + (v * 15) | 0; b = 35 + (v * 10) | 0; }
                                    else { r = 70 + (v * 25) | 0; g = 65 + (v * 20) | 0; b = 55 + (v * 20) | 0; }
                                } else {
                                    if (v > 0.97) {
                                        const t = (v * 3) | 0;
                                        if (t === 0) { r = 100; g = 150; b = 200; }
                                        else if (t === 1) { r = 200; g = 150; b = 100; }
                                        else { r = 150; g = 200; b = 150; }
                                    } else if (v > 0.85) { r = 50 + (v * 20) | 0; g = 70 + (v * 25) | 0; b = 50 + (v * 15) | 0; }
                                    else { const base = 80 + (v * 30) | 0; r = base; g = base - 5; b = base - 10; }
                                }
                                voxels.push({ x, y, z, r, g, b });
                            }
                        }
                    }
                }
            }

            processed++;
            const now = performance.now();
            if (now - lastUpdate > 100 && progress) {
                progress(processed / totalSlices);
                lastUpdate = now;
                await this._delay(1);
            }
        }

        return voxels;
    }

    // Apply a cave template to the world at a specific position
    _applyCaveTemplate(voxels, centerX, centerY, centerZ) {
        const world = this.engine.world;
        for (const v of voxels) {
            const wx = centerX + v.x;
            const wy = centerY + v.y;
            const wz = centerZ + v.z;
            if (wx >= 0 && wx < world.worldSize &&
                wy >= 0 && wy < world.worldSize &&
                wz >= 0 && wz < world.worldSize) {
                world.setVoxel(wx, wy, wz, v.r, v.g, v.b);
            }
        }
    }

    // First-time setup: generate and cache cave templates
    async _firstTimeSetup(progress, startFrom) {
        const totalCaves = CaveCache.NUM_CAVES;

        document.getElementById('loading').querySelector('h2').textContent =
            '🏝️ First-Time Setup';

        for (let i = startFrom; i < totalCaves; i++) {
            const seed = 10000 + i * 7919; // Different seed for each cave
            const baseProgress = i / totalCaves;
            const nextProgress = (i + 1) / totalCaves;

            progress(baseProgress, `Generating cave template ${i + 1}/${totalCaves}...`,
                'This only happens once!');
            await this._delay(50);

            console.time(`CACHE_CAVE_${i + 1}`);
            const voxels = await this._generateCaveTemplate(seed, CAVE_RADIUS, (p) => {
                const totalP = baseProgress + p * (nextProgress - baseProgress);
                progress(totalP, `Generating cave template ${i + 1}/${totalCaves}: ${Math.floor(p * 100)}%`,
                    'This only happens once!');
            });
            console.timeEnd(`CACHE_CAVE_${i + 1}`);

            // Save to IndexedDB
            progress(nextProgress - 0.01, `Saving cave ${i + 1} to cache...`, '');
            await CaveCache.saveCave(i, voxels);
            console.log(`Cave ${i + 1} cached: ${voxels.length} voxels`);
        }

        progress(1, 'Cave templates ready!', '');
        await this._delay(300);

        // Reset loading screen title
        document.getElementById('loading').querySelector('h2').textContent =
            '🏝️ Generating Island...';
    }

    // Calculate positions for connected cave spheres (worm structure)
    _calculateCaveCenters() {
        const centers = [];
        const worldSize = this.engine.world.worldSize;

        // Distance from island center to cave system
        const distanceFromIsland = 330;

        // Distance between cave centers (overlap controlled by CAVE_OVERLAP)
        // At CAVE_OVERLAP=0.7, caves overlap by 30% of their radius
        const stepDistance = CAVE_RADIUS * 2 * (1 - CAVE_OVERLAP);

        // Calculate arc around the island
        // Starting angle: pointing away from island on +X axis
        const startAngle = 0;

        // Arc step: how much angle to change between caves
        // Smaller angle = tighter curve around island
        const arcRadius = distanceFromIsland;
        const arcStep = stepDistance / arcRadius;  // Radians per cave

        for (let i = 0; i < CAVE_SIZE; i++) {
            const angle = startAngle + i * arcStep;

            // Position relative to island center (worldOffset)
            const x = this.worldOffset + Math.cos(angle) * arcRadius;
            const z = this.worldOffset + Math.sin(angle) * arcRadius;
            const y = 140;  // Deep underwater, constant depth

            // Verify cave doesn't exceed world max bounds
            // (min bounds are handled by clipping in generation code)
            if (x + CAVE_RADIUS < worldSize &&
                z + CAVE_RADIUS < worldSize &&
                x - CAVE_RADIUS >= 0 &&
                z - CAVE_RADIUS >= 0) {
                centers.push({ x: Math.floor(x), y, z: Math.floor(z) });
            } else {
                console.warn(`Cave ${i + 1} would exceed world bounds, skipping`);
            }
        }

        return centers;
    }

    // Carve connecting tunnels between adjacent caves
    _carveConnectingTunnels(caveCenters) {
        const world = this.engine.world;
        const tunnelRadius = 35;  // Large enough for comfortable swimming

        for (let i = 0; i < caveCenters.length - 1; i++) {
            const cave1 = caveCenters[i];
            const cave2 = caveCenters[i + 1];

            // Direction vector from cave1 to cave2
            const dx = cave2.x - cave1.x;
            const dy = cave2.y - cave1.y;
            const dz = cave2.z - cave1.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Normalized direction
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            // Carve a cylindrical tunnel through BOTH cave shells
            // Cave shells are at ~(CAVE_RADIUS - 16) to CAVE_RADIUS from their centers
            // We need to carve from before cave2's shell to after cave1's shell
            const shellThickness = 20;  // Buffer for shell + noise variations
            const startDist = dist - CAVE_RADIUS - shellThickness;  // Before cave2's outer shell
            const endDist = CAVE_RADIUS + shellThickness;  // After cave1's outer shell

            // Step along the tunnel
            const stepSize = 2;
            for (let t = startDist; t <= endDist; t += stepSize) {
                // Center point of this tunnel slice
                const cx = cave1.x + nx * t;
                const cy = cave1.y + ny * t;
                const cz = cave1.z + nz * t;

                // Carve a circular opening perpendicular to tunnel direction
                for (let rx = -tunnelRadius; rx <= tunnelRadius; rx++) {
                    for (let ry = -tunnelRadius; ry <= tunnelRadius; ry++) {
                        for (let rz = -tunnelRadius; rz <= tunnelRadius; rz++) {
                            const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
                            if (r <= tunnelRadius) {
                                const vx = Math.floor(cx + rx);
                                const vy = Math.floor(cy + ry);
                                const vz = Math.floor(cz + rz);

                                // Only clear if within world bounds
                                if (vx >= 0 && vx < world.worldSize &&
                                    vy >= 0 && vy < world.worldSize &&
                                    vz >= 0 && vz < world.worldSize) {
                                    // Clear the voxel (set to air)
                                    world.setVoxel(vx, vy, vz, 0, 0, 0, 0);
                                }
                            }
                        }
                    }
                }
            }

            console.log(`Carved tunnel between cave ${i + 1} and ${i + 2}`);
        }
    }

    _resize() {
        const c = this.canvas.parentElement;
        this.engine.resize(c.clientWidth, c.clientHeight);
    }

    _checkCollision(x, y, z) {
        const hw = this.player.width / 2;
        const points = [
            [x-hw, y, z-hw], [x+hw, y, z-hw], [x-hw, y, z+hw], [x+hw, y, z+hw],
            [x-hw, y+0.9, z-hw], [x+hw, y+0.9, z-hw], [x-hw, y+0.9, z+hw], [x+hw, y+0.9, z+hw],
            [x-hw, y+1.8, z-hw], [x+hw, y+1.8, z-hw], [x-hw, y+1.8, z+hw], [x+hw, y+1.8, z+hw],
        ];
        for (const [px, py, pz] of points) {
            const v = this.engine.world.getVoxel(Math.floor(px), Math.floor(py), Math.floor(pz));
            if (v && v.a > 0) {
                // Check if it's a water voxel - allow passing through
                if (this._isWaterVoxel(v)) continue;
                return true;
            }
        }
        return false;
    }

    _isWaterVoxel(v) {
        // Water voxels have specific color range
        return v.r >= 25 && v.r <= 40 &&
               v.g >= 80 && v.g <= 100 &&
               v.b >= 160 && v.b <= 180;
    }

    _isOnGround() {
        const hw = this.player.width / 2;
        const y = this.player.y - 0.1;
        const points = [
            [this.player.x-hw, y, this.player.z-hw],
            [this.player.x+hw, y, this.player.z-hw],
            [this.player.x-hw, y, this.player.z+hw],
            [this.player.x+hw, y, this.player.z+hw],
            [this.player.x, y, this.player.z],
        ];
        for (const [px, py, pz] of points) {
            const v = this.engine.world.getVoxel(Math.floor(px), Math.floor(py), Math.floor(pz));
            if (v && v.a > 0) {
                // Don't count water as ground
                if (this._isWaterVoxel(v)) continue;
                return true;
            }
        }
        return false;
    }

    _updatePlayer(dt) {
        // Update environment state
        this.player.updateEnvironment();

        // Update rendering based on environment
        this._updateEnvironmentRendering();

        this.player.rotate(this.mouseDelta.x * 0.002, this.mouseDelta.y * 0.002);
        this.mouseDelta.x = this.mouseDelta.y = 0;

        if (this.player.isUnderwater) {
            // SWIM MODE - 3D movement like flying
            this._updateSwimMovement(dt);
        } else {
            // SURFACE MODE - normal walking physics
            this._updateSurfaceMovement(dt);
        }

        // Apply movement with collision
        const newX = this.player.x + this.player.vx * dt;
        const newY = this.player.y + this.player.vy * dt;
        const newZ = this.player.z + this.player.vz * dt;

        if (!this._checkCollision(newX, this.player.y, this.player.z)) {
            this.player.x = newX;
        }
        if (!this._checkCollision(this.player.x, this.player.y, newZ)) {
            this.player.z = newZ;
        }
        if (!this._checkCollision(this.player.x, newY, this.player.z)) {
            this.player.y = newY;
        } else {
            if (this.player.vy < 0) this.player.onGround = true;
            this.player.vy = 0;
        }

        if (!this.player.isUnderwater) {
            this.player.onGround = this._isOnGround();
        }

        // Update camera
        const [ex, ey, ez] = this.player.getEyePos();
        this.engine.camera.setPosition(ex, ey, ez);
        this.engine.camera.yaw = this.player.yaw;
        this.engine.camera.pitch = this.player.pitch;

        // Update flashlight position/direction
        if (this.engine.settings.lanternEnabled) {
            this.engine.settings.lanternPos = [ex, ey, ez];
            const [fx, fy, fz] = this.player.getForward3D();
            this.engine.settings.lanternDir = [fx, fy, fz];
        }

        // Track max depth
        if (this.player.depth > this.maxDepthReached) {
            this.maxDepthReached = this.player.depth;
        }
    }

    _updateSwimMovement(dt) {
        // 3D swimming - can move in direction you're looking
        const [fx, fy, fz] = this.player.getForward3D();
        const [rx, _, rz] = [Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)];

        let mx = 0, my = 0, mz = 0;

        // Forward/back moves in look direction
        if (this.keys['KeyW']) { mx += fx; my += fy; mz += fz; }
        if (this.keys['KeyS']) { mx -= fx; my -= fy; mz -= fz; }

        // Strafe left/right
        if (this.keys['KeyA']) { mx -= rx; mz -= rz; }
        if (this.keys['KeyD']) { mx += rx; mz += rz; }

        // Direct up/down
        if (this.keys['Space']) {
            // Near surface? Give a strong boost to breach!
            if (this.player.isNearSurface()) {
                my += 2.5;  // Extra strong upward push near surface
            } else {
                my += 1;
            }
        }
        if (this.keys['ShiftLeft'] || this.keys['ControlLeft']) { my -= 1; }

        // Normalize horizontal movement only
        const hLen = Math.sqrt(mx*mx + mz*mz);
        if (hLen > 1) { mx /= hLen; mz /= hLen; }

        const speed = this.keys['ShiftLeft'] ? this.player.fastSwimSpeed : this.player.swimSpeed;
        this.player.vx = mx * speed;
        this.player.vz = mz * speed;

        // Vertical speed - stronger when breaching
        if (this.keys['Space'] && this.player.isNearSurface()) {
            this.player.vy = this.player.surfaceBoost;  // Strong breach
        } else {
            this.player.vy = my * speed;
        }

        // Slight buoyancy when not pressing anything (slow rise)
        if (!this.keys['Space'] && !this.keys['ShiftLeft'] && !this.keys['ControlLeft'] &&
            mx === 0 && mz === 0 && my === 0) {
            this.player.vy = 0.5;  // Gentle float up
        }
    }

    _updateSurfaceMovement(dt) {
        const [fx, fz] = this.player.getForward();
        const [rx, rz] = this.player.getRight();
        let mx = 0, mz = 0;

        if (this.keys['KeyW']) { mx += fx; mz += fz; }
        if (this.keys['KeyS']) { mx -= fx; mz -= fz; }
        if (this.keys['KeyA']) { mx -= rx; mz -= rz; }
        if (this.keys['KeyD']) { mx += rx; mz += rz; }

        const len = Math.sqrt(mx*mx + mz*mz);
        if (len > 0) { mx /= len; mz /= len; }

        const speed = this.keys['ShiftLeft'] ? this.player.sprintSpeed : this.player.walkSpeed;
        this.player.vx = mx * speed;
        this.player.vz = mz * speed;

        // Gravity
        this.player.vy -= this.player.gravity * dt;
        this.player.vy = Math.max(this.player.vy, -30);
    }

    _updateEnvironmentRendering() {
        const underwater = this.player.isUnderwater;
        const depth = this.player.depth;

        // Update underwater overlay
        const overlay = document.getElementById('underwater-overlay');
        overlay.classList.toggle('active', underwater);
        overlay.classList.toggle('deep', underwater && depth > 15);
        document.getElementById('depth-meter').classList.toggle('visible', underwater);

        if (underwater) {
            // Transition zone: first 5m stays relatively bright, then darkens
            const TRANSITION_DEPTH = 5.0;
            const transitionFactor = Math.max(0, Math.min((depth - TRANSITION_DEPTH) / (MAX_DEPTH - TRANSITION_DEPTH), 1.0));
            const shallowFactor = Math.max(0, Math.min(depth / TRANSITION_DEPTH, 1.0));

            // Fog increases with depth (water absorbs light)
            // Start with lighter fog near surface
            const fogDensity = 1.0 + shallowFactor * 1.5 + transitionFactor * 5.5;
            this.engine.settings.fogDensity = fogDensity;

            // Sky color: blend from surface colors to underwater colors
            // Surface: [0.4, 0.7, 1.0] -> Shallow underwater: [0.2, 0.5, 0.8] -> Deep: very dark
            const surfaceTop = [0.4, 0.7, 1.0];
            const shallowTop = [0.15, 0.4, 0.7];
            const deepTop = [0.0, 0.05, 0.12];

            const surfaceBot = [0.7, 0.85, 1.0];
            const shallowBot = [0.1, 0.35, 0.6];
            const deepBot = [0.0, 0.02, 0.06];

            // First blend surface -> shallow, then shallow -> deep
            let topR, topG, topB, botR, botG, botB;

            if (depth < TRANSITION_DEPTH) {
                // Blend surface to shallow
                topR = surfaceTop[0] + (shallowTop[0] - surfaceTop[0]) * shallowFactor;
                topG = surfaceTop[1] + (shallowTop[1] - surfaceTop[1]) * shallowFactor;
                topB = surfaceTop[2] + (shallowTop[2] - surfaceTop[2]) * shallowFactor;
                botR = surfaceBot[0] + (shallowBot[0] - surfaceBot[0]) * shallowFactor;
                botG = surfaceBot[1] + (shallowBot[1] - surfaceBot[1]) * shallowFactor;
                botB = surfaceBot[2] + (shallowBot[2] - surfaceBot[2]) * shallowFactor;
            } else {
                // Blend shallow to deep
                topR = shallowTop[0] + (deepTop[0] - shallowTop[0]) * transitionFactor;
                topG = shallowTop[1] + (deepTop[1] - shallowTop[1]) * transitionFactor;
                topB = shallowTop[2] + (deepTop[2] - shallowTop[2]) * transitionFactor;
                botR = shallowBot[0] + (deepBot[0] - shallowBot[0]) * transitionFactor;
                botG = shallowBot[1] + (deepBot[1] - shallowBot[1]) * transitionFactor;
                botB = shallowBot[2] + (deepBot[2] - shallowBot[2]) * transitionFactor;
            }

            this.engine.settings.skyColorTop = [topR, topG, topB];
            this.engine.settings.skyColorBottom = [botR, botG, botB];

            // Keep shadows enabled underwater for consistent lighting
            this.engine.settings.enableShadows = true;

            // Update depth meter display
            const meterPercent = Math.min(depth / MAX_DEPTH, 1.0);
            document.getElementById('depth-fill').style.height = (meterPercent * 100) + '%';
            document.getElementById('depth-marker').style.bottom =
                (100 - meterPercent * 100) + 'px';
        } else {
            // Above water - bright sky
            this.engine.settings.fogDensity = 0.5;
            this.engine.settings.skyColorTop = [0.4, 0.7, 1.0];
            this.engine.settings.skyColorBottom = [0.7, 0.85, 1.0];
            this.engine.settings.enableShadows = true;
        }
    }

    _updateStats() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        document.getElementById('fps').textContent = this.fps;
        document.getElementById('frame-time').textContent = (1000 / Math.max(1, this.fps)).toFixed(1) + ' ms';
        document.getElementById('player-pos').textContent =
            `(${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)}, ${this.player.z.toFixed(0)})`;

        // Depth display
        const depthDisplay = document.getElementById('depth-display');
        depthDisplay.textContent = this.player.isUnderwater ?
            `${this.player.depth.toFixed(1)}m` : 'Surface';

        // Environment status
        const envStatus = document.getElementById('environment-status');
        if (this.player.isUnderwater) {
            if (this.player.depth > 40) {
                envStatus.textContent = '🌊 Deep Water';
                envStatus.className = 'stat-value underwater';
            } else if (this.player.depth > 15) {
                envStatus.textContent = '🌊 Underwater';
                envStatus.className = 'stat-value underwater';
            } else {
                envStatus.textContent = '🏊 Shallow';
                envStatus.className = 'stat-value underwater';
            }
        } else {
            envStatus.textContent = '🏝️ Surface';
            envStatus.className = 'stat-value surface';
        }

        // Visibility based on depth
        const visDisplay = document.getElementById('visibility-display');
        if (this.player.isUnderwater) {
            if (this.player.depth > 40) {
                visDisplay.textContent = 'Very Low';
            } else if (this.player.depth > 25) {
                visDisplay.textContent = 'Low';
            } else if (this.player.depth > 10) {
                visDisplay.textContent = 'Medium';
            } else {
                visDisplay.textContent = 'Good';
            }
        } else {
            visDisplay.textContent = 'Clear';
        }

        document.getElementById('voxel-count').textContent = this.engine.getVoxelCount().toLocaleString();
        document.getElementById('memory-usage').textContent = this.engine.getMemoryUsage().totalMB.toFixed(2) + ' MB';
    }

    run() {
        let lastTime = performance.now();

        const loop = () => {
            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;

            this._updatePlayer(dt);
            this.engine.render();
            this._updateStats();

            requestAnimationFrame(loop);
        };

        loop();
    }
}

// ============================================================
// Start
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const game = new SeaCaveGame('canvas');
        window.game = game;  // Expose for debugging
        await game.init();
        game.run();
    } catch (err) {
        console.error(err);
        document.getElementById('loading-text').textContent = 'Error: ' + err.message;
        document.getElementById('loading-text').style.color = '#ff6b6b';
    }
});

// Test function for detail voxels - run from console: testDetailVoxels()
window.testDetailVoxels = function() {
    const world = window.game.engine.world;
    const engine = window.game.engine;
    const player = window.game.player;

    // Get player position
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const pz = Math.floor(player.z);

    // Find a solid voxel near player (search in front of them)
    let testX, testY, testZ;
    const forward = window.game.player.getForward3D();

    for (let dist = 2; dist < 20; dist++) {
        testX = Math.floor(px + forward[0] * dist);
        testY = Math.floor(py + forward[1] * dist);
        testZ = Math.floor(pz + forward[2] * dist);

        const v = world.getVoxel(testX, testY, testZ);
        if (v && v.a > 0) {
            console.log(`Found solid voxel at (${testX}, ${testY}, ${testZ})`);
            break;
        }
    }

    // Create a 4x4x4 checkerboard detail pattern
    console.log(`Creating detail voxel at (${testX}, ${testY}, ${testZ})`);
    for (let sx = 0; sx < 4; sx++) {
        for (let sy = 0; sy < 4; sy++) {
            for (let sz = 0; sz < 4; sz++) {
                if ((sx + sy + sz) % 2 === 0) {
                    world.setDetailVoxel(testX, testY, testZ, sx, sy, sz, 255, 50, 200);
                }
            }
        }
    }

    // Upload changes
    const result = engine.uploadDirtyBricks();
    console.log(`Uploaded: ${result.bricks} bricks, ${result.details} detail bricks`);
    console.log(`Detail count: ${world.detailCount}`);

    return { x: testX, y: testY, z: testZ };
};
