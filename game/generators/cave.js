// ============================================================
// Cave Generator - Creates underground cavern with formations
// Depends on: config.js (WATER_COLOR)
// ============================================================

class CaveGenerator {
    constructor(seed = 12345) {
        this.seed = seed;
        this.lightOrbCount = 0;
    }

    // Simple pseudo-random number generator
    pseudoRandom(seed) {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    // Check if a voxel is a water voxel (used to avoid placing formations on water)
    _isWaterVoxel(v) {
        if (!v || v.a === 0) return false;
        // Water voxels have specific color: r=30, g=90, b=170
        return v.r >= 25 && v.r <= 40 &&
               v.g >= 80 && v.g <= 100 &&
               v.b >= 160 && v.b <= 180;
    }

    // 2D noise for terrain variation
    noise2D(x, z, scale, seed) {
        const nx = x * scale + seed;
        const nz = z * scale + seed * 1.5;
        return (Math.sin(nx) * Math.cos(nz) +
                Math.sin(nx * 2.1 + 0.5) * Math.cos(nz * 1.9 + 0.3) * 0.5 +
                Math.sin(nx * 4.3 + 1.2) * Math.cos(nz * 3.7 + 0.7) * 0.25) / 1.75;
    }

    // 3D noise for cave carving
    noise3D(x, y, z, scale, seed) {
        const nx = x * scale + seed;
        const ny = y * scale + seed * 1.3;
        const nz = z * scale + seed * 1.7;
        return (
            Math.sin(nx) * Math.cos(ny) * Math.sin(nz) +
            Math.sin(nx * 2.1) * Math.cos(ny * 1.9) * Math.sin(nz * 2.3) * 0.5 +
            Math.sin(nx * 4.2) * Math.cos(ny * 3.8) * Math.sin(nz * 4.1) * 0.25
        ) / 1.75;
    }

    _placeRockVoxel(world, x, y, z, isFloor) {
        const variation = this.pseudoRandom(x * 1000 + y * 100 + z);
        let r, g, b;

        if (isFloor) {
            // Floor rocks - darker, brownish gray
            if (variation > 0.95) {
                // Occasional mineral sparkle
                r = 180 + (variation * 50) | 0;
                g = 170 + (variation * 40) | 0;
                b = 140 + (variation * 30) | 0;
            } else if (variation > 0.8) {
                // Darker patches
                r = 45 + (variation * 15) | 0;
                g = 40 + (variation * 15) | 0;
                b = 35 + (variation * 10) | 0;
            } else {
                // Standard floor rock
                r = 70 + (variation * 25) | 0;
                g = 65 + (variation * 20) | 0;
                b = 55 + (variation * 20) | 0;
            }
        } else {
            // Walls and ceiling - gray with hints of color
            if (variation > 0.97) {
                // Crystal/mineral deposits
                const mineralType = (variation * 3) | 0;
                if (mineralType === 0) {
                    r = 100; g = 150; b = 200; // Blue crystal
                } else if (mineralType === 1) {
                    r = 200; g = 150; b = 100; // Amber
                } else {
                    r = 150; g = 200; b = 150; // Green mineral
                }
            } else if (variation > 0.85) {
                // Wet/mossy patches
                r = 50 + (variation * 20) | 0;
                g = 70 + (variation * 25) | 0;
                b = 50 + (variation * 15) | 0;
            } else {
                // Standard rock
                const base = 80 + (variation * 30) | 0;
                r = base;
                g = base - 5;
                b = base - 10;
            }
        }

        world.setVoxel(x, y, z, r, g, b);
    }

    _generateFormations(world, centerX, centerY, centerZ, radius) {
        // Generate stalagmites (from floor) - scan DOWN from center to find floor
        const numStalagmites = 80 + Math.floor(this.pseudoRandom(this.seed + 3000) * 120);

        for (let i = 0; i < numStalagmites; i++) {
            const angle = this.pseudoRandom(this.seed + i * 50) * Math.PI * 2;
            const dist = this.pseudoRandom(this.seed + i * 50 + 25) * radius * 0.75;

            const baseX = Math.floor(centerX + Math.cos(angle) * dist);
            const baseZ = Math.floor(centerZ + Math.sin(angle) * dist);

            // Scan DOWN from center to find the floor surface
            let foundFloor = false;
            let floorY = centerY;

            for (let y = centerY; y > centerY - radius - 20; y--) {
                const v = world.getVoxel(baseX, y, baseZ);
                if (v && v.a > 0) {
                    // Found solid rock - the floor surface is at y+1
                    floorY = y + 1;
                    foundFloor = true;
                    break;
                }
            }

            // Only create stalagmite if we found actual floor
            if (foundFloor) {
                const height = 5 + Math.floor(this.pseudoRandom(this.seed + i * 100) * 20);
                const baseRadius = 2 + Math.floor(this.pseudoRandom(this.seed + i * 100 + 10) * 3);
                this._createStalagmite(world, baseX, floorY, baseZ, height, baseRadius);
            }
        }

        // Generate stalactites (from ceiling) - scan UP from center to find ceiling
        const numStalactites = 100 + Math.floor(this.pseudoRandom(this.seed + 4000) * 150);

        for (let i = 0; i < numStalactites; i++) {
            const angle = this.pseudoRandom(this.seed + i * 70 + 1000) * Math.PI * 2;
            const dist = this.pseudoRandom(this.seed + i * 70 + 1025) * radius * 0.75;

            const baseX = Math.floor(centerX + Math.cos(angle) * dist);
            const baseZ = Math.floor(centerZ + Math.sin(angle) * dist);

            // Scan UP from center to find the ceiling surface
            let foundCeiling = false;
            let ceilingY = centerY;

            for (let y = centerY; y < centerY + radius + 20; y++) {
                const v = world.getVoxel(baseX, y, baseZ);
                // Skip water voxels - they are not valid ceiling surfaces
                if (v && v.a > 0 && !this._isWaterVoxel(v)) {
                    // Found solid rock - the ceiling surface is at y-1
                    ceilingY = y - 1;
                    foundCeiling = true;
                    break;
                }
            }

            // Only create stalactite if we found actual ceiling (not an opening or water)
            if (foundCeiling) {
                // Double-check there's solid rock directly above where we'll attach (not water)
                const attachCheck = world.getVoxel(baseX, ceilingY + 1, baseZ);
                if (attachCheck && attachCheck.a > 0 && !this._isWaterVoxel(attachCheck)) {
                    const length = 4 + Math.floor(this.pseudoRandom(this.seed + i * 120 + 1000) * 18);
                    const baseRadius = 1 + Math.floor(this.pseudoRandom(this.seed + i * 120 + 1010) * 2);
                    this._createStalactite(world, baseX, ceilingY, baseZ, length, baseRadius);
                }
            }
        }
    }

    _createStalagmite(world, baseX, baseY, baseZ, height, baseRadius) {
        for (let y = 0; y < height; y++) {
            // Taper toward top
            const progress = y / height;
            const currentRadius = baseRadius * (1 - progress * 0.9);

            for (let dx = -baseRadius; dx <= baseRadius; dx++) {
                for (let dz = -baseRadius; dz <= baseRadius; dz++) {
                    const d = Math.sqrt(dx * dx + dz * dz);
                    if (d <= currentRadius) {
                        const wx = baseX + dx;
                        const wy = baseY + y;
                        const wz = baseZ + dz;

                        // Color variation
                        const v = this.pseudoRandom(wx + wy * 100 + wz);
                        const brightness = 60 + (v * 40) | 0;
                        const r = brightness + 10;
                        const g = brightness + 5;
                        const b = brightness - 5;

                        world.setVoxel(wx, wy, wz, r, g, b);
                    }
                }
            }
        }
    }

    _createStalactite(world, baseX, baseY, baseZ, length, baseRadius) {
        for (let y = 0; y < length; y++) {
            // Taper toward bottom
            const progress = y / length;
            const currentRadius = baseRadius * (1 - progress * 0.95);

            for (let dx = -baseRadius; dx <= baseRadius; dx++) {
                for (let dz = -baseRadius; dz <= baseRadius; dz++) {
                    const d = Math.sqrt(dx * dx + dz * dz);
                    if (d <= currentRadius) {
                        const wx = baseX + dx;
                        const wy = baseY - y;
                        const wz = baseZ + dz;

                        // Slightly different coloring - more gray
                        const v = this.pseudoRandom(wx + wy * 100 + wz);
                        const brightness = 70 + (v * 35) | 0;
                        const r = brightness;
                        const g = brightness;
                        const b = brightness + 5;

                        world.setVoxel(wx, wy, wz, r, g, b);
                    }
                }
            }
        }

        // Add drip at bottom (optional wet look)
        if (this.pseudoRandom(baseX + baseZ) > 0.7) {
            world.setVoxel(baseX, baseY - length, baseZ, 100, 120, 140);
        }
    }

    _addGroundDetails(world, centerX, centerY, centerZ, radius) {
        // Add scattered rocks and crystals on the floor
        const floorY = centerY - radius * 0.4;
        const numDetails = 150 + Math.floor(this.pseudoRandom(this.seed + 7000) * 100);

        for (let i = 0; i < numDetails; i++) {
            const angle = this.pseudoRandom(this.seed + i * 60 + 7000) * Math.PI * 2;
            const dist = this.pseudoRandom(this.seed + i * 60 + 7025) * radius * 0.8;

            const detailX = Math.floor(centerX + Math.cos(angle) * dist);
            const detailZ = Math.floor(centerZ + Math.sin(angle) * dist);

            // Find floor - scan down using same range as stalagmites
            let actualFloorY = floorY;
            for (let y = centerY; y > centerY - radius - 20; y--) {
                const v = world.getVoxel(detailX, y, detailZ);
                if (v && v.a > 0) {
                    actualFloorY = y + 1;
                    break;
                }
            }

            const detailType = this.pseudoRandom(this.seed + i * 70 + 7050);

            if (detailType > 0.8) {
                // Small crystal cluster
                const crystalColor = detailType > 0.9
                    ? [150, 200, 255] // Blue crystal
                    : [200, 150, 255]; // Purple crystal

                for (let dy = 0; dy < 3; dy++) {
                    world.setVoxel(detailX, actualFloorY + dy, detailZ,
                        crystalColor[0], crystalColor[1], crystalColor[2]);
                }
            } else if (detailType > 0.5) {
                // Small rock
                const v = this.pseudoRandom(detailX + detailZ);
                const gray = 50 + (v * 30) | 0;
                world.setVoxel(detailX, actualFloorY, detailZ, gray, gray - 5, gray - 10);
            }
            // else nothing (keep some areas clear)
        }
    }
}
