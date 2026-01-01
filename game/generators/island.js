// ============================================================
// Island Generator - Minecraft style terrain and trees
// Depends on: config.js (SEA_LEVEL, MAX_DEPTH, ISLAND_RADIUS, WATER_COLOR)
// ============================================================

class IslandGenerator {
    constructor(seed = 12345) {
        this.seed = seed;
        this.baseHeight = SEA_LEVEL + 3;  // Base island height just above water
        this.hillHeight = 8;  // Small hills variation
        this.scale = 0.015;   // Terrain noise scale
    }

    noise2D(x, z, scale, seed) {
        const nx = x * scale + seed;
        const nz = z * scale + seed * 1.5;
        return (Math.sin(nx) * Math.cos(nz) +
                Math.sin(nx * 2.1 + 0.5) * Math.cos(nz * 1.9 + 0.3) * 0.5 +
                Math.sin(nx * 4.3 + 1.2) * Math.cos(nz * 3.7 + 0.7) * 0.25) / 1.75;
    }

    pseudoRandom(seed) {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    // Get distance from island center (0-1 normalized, >1 = ocean)
    getIslandFactor(x, z) {
        const dist = Math.sqrt(x * x + z * z);
        return dist / ISLAND_RADIUS;
    }

    // Get terrain height - minecraft style with island falloff
    getHeight(x, z) {
        const islandFactor = this.getIslandFactor(x, z);

        // Ocean floor
        if (islandFactor > 1.3) {
            const oceanNoise = this.noise2D(x, z, 0.01, this.seed + 3000) * 5;
            return Math.floor(SEA_LEVEL - MAX_DEPTH + 10 + oceanNoise);
        }

        // Minecraft-style terrain noise
        const n1 = this.noise2D(x, z, this.scale, this.seed);
        const n2 = this.noise2D(x, z, this.scale * 2, this.seed + 1000) * 0.5;
        const n3 = this.noise2D(x, z, this.scale * 4, this.seed + 2000) * 0.25;
        const terrainNoise = (n1 + n2 + n3) / 1.75;

        if (islandFactor < 0.7) {
            // Main island - flat with small hills
            const height = this.baseHeight + Math.floor((terrainNoise * 0.5 + 0.5) * this.hillHeight);
            return height;
        } else if (islandFactor < 1.0) {
            // Beach/shore transition - slopes down to water
            const t = (islandFactor - 0.7) / 0.3;
            const falloff = Math.pow(1.0 - t, 2);
            const height = this.baseHeight + Math.floor((terrainNoise * 0.5 + 0.5) * this.hillHeight * falloff);
            // Ensure beach is at or slightly above sea level
            return Math.max(SEA_LEVEL - 1, Math.floor(height - (1 - falloff) * 5));
        } else {
            // Underwater slope
            const t = Math.min((islandFactor - 1.0) / 0.3, 1.0);
            const shallowDepth = SEA_LEVEL - 5;
            const deepDepth = SEA_LEVEL - MAX_DEPTH + 10;
            const underwaterNoise = this.noise2D(x, z, 0.02, this.seed + 4000) * 4;
            return Math.floor(shallowDepth - (shallowDepth - deepDepth) * t + underwaterNoise);
        }
    }

    // Check if position is on beach
    isBeach(x, z, height) {
        const islandFactor = this.getIslandFactor(x, z);
        return islandFactor > 0.65 && islandFactor < 1.05 && height <= SEA_LEVEL + 2;
    }

    generateWorld(world, worldOffset, progress) {
        const worldSize = world.worldSize;
        const chunkSize = 32;  // Match minecraft-game2.html chunk size
        const numChunks = Math.ceil(worldSize / chunkSize);
        let processed = 0;
        const totalChunks = numChunks * numChunks;

        for (let cx = 0; cx < numChunks; cx++) {
            for (let cz = 0; cz < numChunks; cz++) {
                this._generateChunk(world, cx, cz, chunkSize, worldOffset);

                processed++;
                if (progress && processed % 20 === 0) {
                    progress(processed / totalChunks);
                }
            }
        }
    }

    _generateChunk(world, chunkX, chunkZ, chunkSize, worldOffset) {
        const startX = chunkX * chunkSize;
        const startZ = chunkZ * chunkSize;

        // Pre-calculate heights for this chunk
        const heights = new Int32Array(chunkSize * chunkSize);
        for (let lx = 0; lx < chunkSize; lx++) {
            for (let lz = 0; lz < chunkSize; lz++) {
                const noiseX = startX + lx - worldOffset;
                const noiseZ = startZ + lz - worldOffset;
                heights[lx + lz * chunkSize] = this.getHeight(noiseX, noiseZ);
            }
        }

        // Generate terrain columns
        for (let lx = 0; lx < chunkSize; lx++) {
            for (let lz = 0; lz < chunkSize; lz++) {
                const h = heights[lx + lz * chunkSize];
                const wx = startX + lx;
                const wz = startZ + lz;
                const noiseX = startX + lx - worldOffset;
                const noiseZ = startZ + lz - worldOffset;

                // Calculate depth based on neighbors (minecraft style)
                const getH = (dx, dz) => {
                    const nx = lx + dx, nz = lz + dz;
                    if (nx >= 0 && nx < chunkSize && nz >= 0 && nz < chunkSize)
                        return heights[nx + nz * chunkSize];
                    return this.getHeight(noiseX + dx, noiseZ + dz);
                };

                const neighborHeights = [
                    getH(-1, 0), getH(1, 0), getH(0, -1), getH(0, 1),
                    getH(-1, -1), getH(-1, 1), getH(1, -1), getH(1, 1)
                ];
                const minH = Math.min(...neighborHeights);
                const heightDiff = h - minH;
                const extraDepth = Math.max(3, heightDiff + 2);
                const startY = Math.max(0, h - extraDepth);

                const isOnBeach = this.isBeach(noiseX, noiseZ, h);
                const isUnderwater = h < SEA_LEVEL;

                // Generate terrain column
                for (let y = startY; y < h; y++) {
                    let r, g, b;

                    if (isUnderwater) {
                        // Underwater terrain
                        if (y === h - 1) {
                            // Seafloor - sandy
                            const v = this.pseudoRandom(noiseX * 1000 + noiseZ + y);
                            r = 140 + (v * 30) | 0;
                            g = 130 + (v * 25) | 0;
                            b = 95 + (v * 25) | 0;
                        } else {
                            // Underwater rock
                            const v = this.pseudoRandom(noiseX * 1000 + noiseZ + y);
                            r = 70 + (v * 20) | 0;
                            g = 75 + (v * 20) | 0;
                            b = 65 + (v * 15) | 0;
                        }
                    } else if (isOnBeach) {
                        // Beach sand
                        const v = this.pseudoRandom(noiseX * 1000 + noiseZ + y);
                        r = 220 + (v * 25) | 0;
                        g = 200 + (v * 20) | 0;
                        b = 150 + (v * 25) | 0;
                    } else if (y === h - 1) {
                        // Grass top (minecraft style colors)
                        r = 74 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y) * 20) | 0;
                        g = 124 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y + 1) * 20) | 0;
                        b = 69 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y + 2) * 20) | 0;
                    } else if (y > h - 4) {
                        // Dirt layer (minecraft style)
                        r = 139 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y) * 15) | 0;
                        g = 90 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y + 1) * 15) | 0;
                        b = 60 + (this.pseudoRandom(noiseX * 1000 + noiseZ + y + 2) * 10) | 0;
                    } else {
                        // Stone (minecraft style)
                        const shade = (this.pseudoRandom(noiseX * 1000 + noiseZ + y) * 20) | 0;
                        r = 100 + shade;
                        g = 100 + shade;
                        b = 105 + shade;
                    }

                    world.setVoxel(wx, y, wz, r, g, b);
                }

                // Add water surface voxel if underwater
                if (isUnderwater) {
                    world.setVoxel(wx, SEA_LEVEL - 1, wz,
                        WATER_COLOR.r, WATER_COLOR.g, WATER_COLOR.b);
                }
            }
        }

        // Generate trees (minecraft style) - only on main island
        const treeSeed = this.seed + chunkX * 1000 + chunkZ;
        const numTrees = 2 + Math.floor(this.pseudoRandom(treeSeed) * 3);

        for (let i = 0; i < numTrees; i++) {
            const lx = Math.floor(this.pseudoRandom(treeSeed + i * 100) * (chunkSize - 8)) + 4;
            const lz = Math.floor(this.pseudoRandom(treeSeed + i * 100 + 50) * (chunkSize - 8)) + 4;
            const groundY = heights[lx + lz * chunkSize];

            const noiseX = startX + lx - worldOffset;
            const noiseZ = startZ + lz - worldOffset;
            const islandFactor = this.getIslandFactor(noiseX, noiseZ);

            // Only place trees on main island (not beach, not water)
            if (groundY < SEA_LEVEL + 2 || groundY > SEA_LEVEL + 15) continue;
            if (islandFactor > 0.6) continue;  // Not on beach area

            const wx = startX + lx;
            const wz = startZ + lz;
            const treeH = 5 + Math.floor(this.pseudoRandom(treeSeed + i * 200) * 4);

            // Trunk (minecraft style brown)
            for (let y = groundY; y < groundY + treeH; y++) {
                world.setVoxel(wx, y, wz,
                    93 + (this.pseudoRandom(i + y) * 10) | 0,
                    64 + (this.pseudoRandom(i + y + 1) * 10) | 0,
                    45 + (this.pseudoRandom(i + y + 2) * 10) | 0);
            }

            // Leaves (minecraft style)
            const leafY = groundY + treeH - 2;
            for (let dy = 0; dy <= 3; dy++) {
                const r = dy < 2 ? 2 : 1;
                for (let dx = -r; dx <= r; dx++) {
                    for (let dz = -r; dz <= r; dz++) {
                        // Skip corners on lower layers
                        if (Math.abs(dx) === r && Math.abs(dz) === r && dy < 2) continue;
                        // Skip trunk position on lower layers
                        if (dx === 0 && dz === 0 && dy < 2) continue;

                        world.setVoxel(wx + dx, leafY + dy, wz + dz,
                            36 + (this.pseudoRandom(i + dx + dz + dy) * 20) | 0,
                            115 + (this.pseudoRandom(i + dx + dz + dy + 1) * 30) | 0,
                            40 + (this.pseudoRandom(i + dx + dz + dy + 2) * 20) | 0);
                    }
                }
            }
        }

        // Flowers (minecraft style)
        const flowerSeed = treeSeed + 5000;
        const flowers = [[255, 50, 50], [255, 255, 50], [255, 150, 200], [150, 150, 255], [255, 165, 0]];
        const numFlowers = 4 + Math.floor(this.pseudoRandom(flowerSeed) * 8);

        for (let i = 0; i < numFlowers; i++) {
            const lx = Math.floor(this.pseudoRandom(flowerSeed + i * 100) * chunkSize);
            const lz = Math.floor(this.pseudoRandom(flowerSeed + i * 100 + 50) * chunkSize);
            const h = heights[lx + lz * chunkSize];

            const noiseX = startX + lx - worldOffset;
            const noiseZ = startZ + lz - worldOffset;
            const islandFactor = this.getIslandFactor(noiseX, noiseZ);

            // Only on grass, not beach/water
            if (h < SEA_LEVEL + 2 || islandFactor > 0.65) continue;

            const c = flowers[Math.floor(this.pseudoRandom(flowerSeed + i) * flowers.length)];
            world.setVoxel(startX + lx, h, startZ + lz, c[0], c[1], c[2]);
        }

        // Underwater decorations (coral, seaweed)
        const coralSeed = treeSeed + 8000;
        for (let i = 0; i < 5; i++) {
            const lx = Math.floor(this.pseudoRandom(coralSeed + i * 100) * chunkSize);
            const lz = Math.floor(this.pseudoRandom(coralSeed + i * 100 + 50) * chunkSize);
            const h = heights[lx + lz * chunkSize];

            // Only underwater, not too deep
            if (h >= SEA_LEVEL || h < SEA_LEVEL - 20) continue;

            // Skip beach transition zone
            const coralNoiseX = startX + lx - worldOffset;
            const coralNoiseZ = startZ + lz - worldOffset;
            const coralIslandFactor = this.getIslandFactor(coralNoiseX, coralNoiseZ);
            if (coralIslandFactor > 0.5 && coralIslandFactor < 1.5) continue;

            const wx = startX + lx;
            const wz = startZ + lz;
            const coralChance = this.pseudoRandom(coralSeed + i);

            if (coralChance > 0.5) {
                // Coral
                const coralHeight = 1 + Math.floor(this.pseudoRandom(coralSeed + i + 1) * 2);
                const coralType = Math.floor(this.pseudoRandom(coralSeed + i + 2) * 4);
                for (let dy = 1; dy <= coralHeight; dy++) {
                    let cr, cg, cb;
                    switch (coralType) {
                        case 0: cr = 255; cg = 100; cb = 120; break;
                        case 1: cr = 255; cg = 180; cb = 50; break;
                        case 2: cr = 150; cg = 100; cb = 200; break;
                        default: cr = 100; cg = 200; cb = 150; break;
                    }
                    world.setVoxel(wx, h + dy, wz, cr, cg, cb);
                }
            } else {
                // Seaweed
                const seaweedHeight = 2 + Math.floor(this.pseudoRandom(coralSeed + i + 3) * 3);
                for (let dy = 1; dy <= seaweedHeight; dy++) {
                    const v = this.pseudoRandom(coralSeed + i + dy);
                    world.setVoxel(wx, h + dy, wz,
                        30 + (v * 20) | 0,
                        100 + (v * 50) | 0,
                        40 + (v * 20) | 0);
                }
            }
        }
    }
}
