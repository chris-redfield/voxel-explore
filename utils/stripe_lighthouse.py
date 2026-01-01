#!/usr/bin/env python3
"""
Post-process a voxel model to add horizontal stripes.
Perfect for lighthouses!

Usage:
    python stripe_lighthouse.py input.json --output output.json --stripe-height 8
"""

import argparse
import json
import os
import sys


def add_stripes(input_path: str, output_path: str, stripe_height: int = 8,
                color1: tuple = (220, 60, 60), color2: tuple = (255, 255, 255)):
    """Add horizontal stripes to a voxel model based on Y coordinate."""

    print(f"Loading {input_path}...")
    with open(input_path, 'r') as f:
        data = json.load(f)

    voxels = data['voxels']
    grid_size = data['gridSize']

    print(f"  {len(voxels)} voxels, grid: {grid_size['x']} x {grid_size['y']} x {grid_size['z']}")
    print(f"  Stripe height: {stripe_height}")
    print(f"  Color 1 (red): RGB{color1}")
    print(f"  Color 2 (white): RGB{color2}")

    # Find Y range
    y_values = [v['y'] for v in voxels]
    min_y = min(y_values)
    max_y = max(y_values)
    print(f"  Y range: {min_y} to {max_y}")

    # Apply stripes based on Y coordinate
    modified = 0
    for v in voxels:
        # Calculate which stripe band this voxel is in
        relative_y = v['y'] - min_y
        stripe_index = relative_y // stripe_height

        # Alternate colors
        if stripe_index % 2 == 0:
            v['r'], v['g'], v['b'] = color1
        else:
            v['r'], v['g'], v['b'] = color2
        modified += 1

    print(f"  Modified {modified} voxels")

    # Save output
    print(f"Saving to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    file_size = os.path.getsize(output_path)
    print(f"Done! Output: {output_path} ({file_size / 1024:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(description='Add horizontal stripes to voxel model')
    parser.add_argument('input', help='Input JSON file')
    parser.add_argument('-o', '--output', help='Output JSON file (default: overwrites input)')
    parser.add_argument('-s', '--stripe-height', type=int, default=8,
                        help='Height of each stripe in voxels (default: 8)')
    parser.add_argument('--color1', default='220,60,60',
                        help='First stripe color as R,G,B (default: 220,60,60 red)')
    parser.add_argument('--color2', default='255,255,255',
                        help='Second stripe color as R,G,B (default: 255,255,255 white)')

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: File not found: {args.input}")
        sys.exit(1)

    output_path = args.output or args.input

    # Parse colors
    color1 = tuple(int(x) for x in args.color1.split(','))
    color2 = tuple(int(x) for x in args.color2.split(','))

    add_stripes(args.input, output_path, args.stripe_height, color1, color2)


if __name__ == '__main__':
    main()
