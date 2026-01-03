// ============================================================
// Player (Diver) - Handles player state and movement
// Depends on: config.js (SEA_LEVEL, WALK_SPEED, SPRINT_SPEED, SWIM_SPEED, FAST_SWIM_SPEED)
// ============================================================

// Tool types
const TOOL_NONE = 0;
const TOOL_MINING = 1;

class Diver {
    constructor() {
        this.x = 0; this.y = 50; this.z = 0;
        this.vx = 0; this.vy = 0; this.vz = 0;
        this.yaw = 0; this.pitch = 0;
        this.width = 0.6; this.height = 1.8; this.eyeHeight = 1.6;
        this.onGround = false;

        // Surface movement
        this.walkSpeed = WALK_SPEED;
        this.sprintSpeed = SPRINT_SPEED;
        this.jumpForce = 7;
        this.gravity = 20;

        // Underwater movement (swim mode)
        this.swimSpeed = SWIM_SPEED;
        this.fastSwimSpeed = FAST_SWIM_SPEED;
        this.surfaceBoost = 12;  // Strong upward boost to breach surface

        this.isUnderwater = false;
        this.wasUnderwater = false;  // For hysteresis
        this.depth = 0;  // Depth below sea level

        // Tool system
        this.equippedTool = TOOL_NONE;  // 0 = none, 1 = mining tool
    }

    equipTool(toolId) {
        this.equippedTool = toolId;
    }

    getEquippedTool() {
        return this.equippedTool;
    }

    setSpawn(x, y, z) { this.spawnX = x; this.spawnY = y; this.spawnZ = z; }

    respawn() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.z = this.spawnZ;
        this.vx = this.vy = this.vz = 0;
    }

    getEyePos() { return [this.x, this.y + this.eyeHeight, this.z]; }
    getForward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
    getRight() { return [Math.cos(this.yaw), -Math.sin(this.yaw)]; }

    // 3D forward vector (includes pitch)
    getForward3D() {
        const cp = Math.cos(this.pitch);
        return [
            Math.sin(this.yaw) * cp,
            Math.sin(this.pitch),  // Positive pitch = looking up = move up when pressing W
            Math.cos(this.yaw) * cp
        ];
    }

    rotate(dy, dp) {
        this.yaw += dy;
        this.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.pitch - dp));
    }

    updateEnvironment() {
        const eyeY = this.y + this.eyeHeight;

        // Hysteresis to prevent flickering at water surface
        // Need to cross threshold by 0.5 blocks to change state
        const HYSTERESIS = 0.5;

        if (this.wasUnderwater) {
            // Currently underwater - need to go clearly ABOVE surface to exit
            this.isUnderwater = eyeY < (SEA_LEVEL + HYSTERESIS);
        } else {
            // Currently on surface - need to go clearly BELOW surface to enter water
            this.isUnderwater = eyeY < (SEA_LEVEL - HYSTERESIS);
        }

        this.wasUnderwater = this.isUnderwater;
        this.depth = this.isUnderwater ? Math.max(0, SEA_LEVEL - eyeY) : 0;
    }

    // Check if near water surface (for breach boost)
    isNearSurface() {
        const eyeY = this.y + this.eyeHeight;
        return eyeY > SEA_LEVEL - 3 && eyeY < SEA_LEVEL + 1;
    }
}
