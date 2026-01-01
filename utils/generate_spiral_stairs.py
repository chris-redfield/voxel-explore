#!/usr/bin/env python3
"""
Generate a spiral staircase/ramp around a cylindrical structure (like a lighthouse).
Steps rise only 1 voxel at a time so player can walk up without jumping.

Usage:
    python generate_spiral_stairs.py --output stairs.json
"""

import argparse
import json
import math
import os


def generate_spiral_stairs(
    center_radius: float = 7,      # Distance from center to stairs
    total_height: int = 48,        # Total height to climb
    stair_width: int = 3,          # Width of each stair (voxels)
    steps_per_rotation: int = 24,  # How many steps for one full circle
    color: tuple = (139, 90, 43),  # Wood brown color
    add_railing: bool = False      # Whether to add railing
) -> dict:
    """Generate a spiral staircase as voxel data."""

    voxels = []

    # Each step rises 1 voxel, so total_steps = total_height
    total_steps = total_height

    # Angle increment per step
    angle_per_step = (2 * math.pi) / steps_per_rotation

    print(f"Generating spiral stairs...")
    print(f"  Center radius: {center_radius}")
    print(f"  Total height: {total_height}")
    print(f"  Steps per rotation: {steps_per_rotation}")
    print(f"  Total rotations: {total_height / steps_per_rotation:.1f}")

    # Track placed voxels to avoid duplicates
    placed = set()

    for step in range(total_steps):
        angle = step * angle_per_step
        y = step  # Each step is 1 voxel higher

        # Calculate center of this step
        cx = math.cos(angle) * center_radius
        cz = math.sin(angle) * center_radius

        # Calculate direction perpendicular to radius (tangent)
        tx = -math.sin(angle)
        tz = math.cos(angle)

        # Calculate radial direction (away from center - outward)
        rx = math.cos(angle)
        rz = math.sin(angle)

        # Place stair voxels - extend outward from lighthouse wall
        for w in range(-stair_width // 2, stair_width // 2 + 1):  # Tangent width
            for d in range(3):  # Depth outward (0 = touching wall, 2 = outer edge)
                sx = int(round(cx + tx * w + rx * d))
                sz = int(round(cz + tz * w + rz * d))

                key = (sx, y, sz)
                if key not in placed:
                    placed.add(key)
                    voxels.append({
                        'x': sx, 'y': y, 'z': sz,
                        'r': color[0], 'g': color[1], 'b': color[2]
                    })

    # Add bridge at top to connect stairs to lighthouse
    top_y = total_steps - 1
    top_angle = top_y * angle_per_step
    top_cx = math.cos(top_angle) * center_radius
    top_cz = math.sin(top_angle) * center_radius
    # Extend bridge inward toward lighthouse center
    for d in range(-4, 1):  # Go inward from the stair position
        for w in range(-2, 3):  # Width of bridge
            tx = -math.sin(top_angle)
            tz = math.cos(top_angle)
            rx = math.cos(top_angle)
            rz = math.sin(top_angle)
            bx = int(round(top_cx + tx * w + rx * d))
            bz = int(round(top_cz + tz * w + rz * d))
            key = (bx, top_y, bz)
            if key not in placed:
                placed.add(key)
                voxels.append({
                    'x': bx, 'y': top_y, 'z': bz,
                    'r': color[0], 'g': color[1], 'b': color[2]
                })

    # Calculate grid size
    if voxels:
        xs = [v['x'] for v in voxels]
        ys = [v['y'] for v in voxels]
        zs = [v['z'] for v in voxels]

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        min_z, max_z = min(zs), max(zs)

        # Normalize coordinates to start from 0
        for v in voxels:
            v['x'] -= min_x
            v['y'] -= min_y
            v['z'] -= min_z

        grid_size = {
            'x': max_x - min_x + 1,
            'y': max_y - min_y + 1,
            'z': max_z - min_z + 1
        }
    else:
        grid_size = {'x': 0, 'y': 0, 'z': 0}

    print(f"  Generated {len(voxels)} voxels")
    print(f"  Grid size: {grid_size['x']} x {grid_size['y']} x {grid_size['z']}")

    return {
        'resolution': total_height,
        'gridSize': grid_size,
        'voxelCount': len(voxels),
        'voxels': voxels
    }


def main():
    parser = argparse.ArgumentParser(description='Generate spiral staircase voxels')
    parser.add_argument('-o', '--output', default='stairs.json',
                        help='Output JSON file (default: stairs.json)')
    parser.add_argument('-r', '--radius', type=float, default=7,
                        help='Distance from center to stairs (default: 7)')
    parser.add_argument('-H', '--height', type=int, default=48,
                        help='Total height to climb (default: 48)')
    parser.add_argument('-w', '--width', type=int, default=3,
                        help='Width of stairs in voxels (default: 3)')
    parser.add_argument('-s', '--steps-per-rotation', type=int, default=24,
                        help='Steps for one full rotation (default: 24)')

    args = parser.parse_args()

    data = generate_spiral_stairs(
        center_radius=args.radius,
        total_height=args.height,
        stair_width=args.width,
        steps_per_rotation=args.steps_per_rotation
    )

    print(f"Saving to {args.output}...")
    with open(args.output, 'w') as f:
        json.dump(data, f, indent=2)

    file_size = os.path.getsize(args.output)
    print(f"Done! Output: {args.output} ({file_size / 1024:.1f} KB)")


if __name__ == '__main__':
    main()
