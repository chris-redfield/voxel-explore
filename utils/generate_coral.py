#!/usr/bin/env python3
"""
Branching Coral Generator
Generates OBJ file with branching coral structure for voxelization.
Inspired by orange/pink sea fan coral.
"""

import argparse
import math
import random
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class Vec3:
    x: float
    y: float
    z: float

    def __add__(self, other):
        return Vec3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __mul__(self, scalar):
        return Vec3(self.x * scalar, self.y * scalar, self.z * scalar)

    def normalize(self):
        length = math.sqrt(self.x**2 + self.y**2 + self.z**2)
        if length > 0:
            return Vec3(self.x / length, self.y / length, self.z / length)
        return Vec3(0, 1, 0)


class CoralGenerator:
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.vertices: List[Vec3] = []
        self.faces: List[Tuple[int, ...]] = []
        self.segments = 8  # Segments per cylinder ring

    def add_cylinder(self, start: Vec3, end: Vec3, radius_start: float, radius_end: float) -> None:
        """Add a tapered cylinder between two points."""
        # Calculate direction and perpendicular vectors
        direction = Vec3(end.x - start.x, end.y - start.y, end.z - start.z)
        length = math.sqrt(direction.x**2 + direction.y**2 + direction.z**2)
        if length < 0.001:
            return

        direction = direction.normalize()

        # Find perpendicular vectors
        if abs(direction.y) < 0.9:
            up = Vec3(0, 1, 0)
        else:
            up = Vec3(1, 0, 0)

        # Cross products to get perpendicular basis
        perp1 = Vec3(
            direction.y * up.z - direction.z * up.y,
            direction.z * up.x - direction.x * up.z,
            direction.x * up.y - direction.y * up.x
        ).normalize()

        perp2 = Vec3(
            direction.y * perp1.z - direction.z * perp1.y,
            direction.z * perp1.x - direction.x * perp1.z,
            direction.x * perp1.y - direction.y * perp1.x
        ).normalize()

        # Create vertices for cylinder rings
        start_idx = len(self.vertices)

        for ring in range(2):
            center = start if ring == 0 else end
            radius = radius_start if ring == 0 else radius_end

            for i in range(self.segments):
                angle = 2 * math.pi * i / self.segments
                offset = perp1 * (math.cos(angle) * radius) + perp2 * (math.sin(angle) * radius)
                self.vertices.append(center + offset)

        # Create faces connecting the rings
        for i in range(self.segments):
            i1 = start_idx + i
            i2 = start_idx + (i + 1) % self.segments
            i3 = start_idx + self.segments + (i + 1) % self.segments
            i4 = start_idx + self.segments + i

            # Two triangles per quad (1-indexed for OBJ)
            self.faces.append((i1 + 1, i2 + 1, i3 + 1))
            self.faces.append((i1 + 1, i3 + 1, i4 + 1))

    def generate_branch(self, start: Vec3, direction: Vec3, length: float,
                        radius: float, depth: int, max_depth: int) -> None:
        """Recursively generate branching coral structure."""
        if depth > max_depth or radius < 0.005:
            return

        # Add some waviness to the branch
        wave_freq = 0.3
        wave_amp = 0.15 * radius
        segments_per_branch = max(4, int(length / 0.15))  # More segments for detail

        current_pos = start
        current_dir = direction
        current_radius = radius

        for seg in range(segments_per_branch):
            progress = seg / segments_per_branch
            seg_length = length / segments_per_branch

            # Taper radius
            next_radius = radius * (1 - progress * 0.4)

            # Add slight random deviation
            deviation = Vec3(
                random.uniform(-0.2, 0.2),
                random.uniform(0.1, 0.3),  # Bias upward
                random.uniform(-0.2, 0.2)
            )
            current_dir = Vec3(
                current_dir.x + deviation.x * 0.3,
                current_dir.y + deviation.y * 0.3,
                current_dir.z + deviation.z * 0.3
            ).normalize()

            next_pos = current_pos + current_dir * seg_length
            self.add_cylinder(current_pos, next_pos, current_radius, next_radius)

            current_pos = next_pos
            current_radius = next_radius

            # Chance to spawn sub-branches - higher probability for delicate coral
            if depth < max_depth and seg > 0 and random.random() < 0.55:
                # Branch direction - spread outward and upward
                branch_angle = random.uniform(0.3, 0.9)  # 17-52 degrees, more spread
                spin = random.uniform(0, 2 * math.pi)

                # Create branch direction
                branch_dir = Vec3(
                    math.sin(branch_angle) * math.cos(spin),
                    math.cos(branch_angle) * 0.7 + 0.3,  # Upward bias
                    math.sin(branch_angle) * math.sin(spin)
                ).normalize()

                # Mix with current direction
                branch_dir = Vec3(
                    branch_dir.x * 0.6 + current_dir.x * 0.4,
                    branch_dir.y * 0.6 + current_dir.y * 0.4,
                    branch_dir.z * 0.6 + current_dir.z * 0.4
                ).normalize()

                branch_length = length * random.uniform(0.5, 0.8)
                branch_radius = current_radius * random.uniform(0.65, 0.9)  # Keep more radius

                self.generate_branch(
                    current_pos, branch_dir, branch_length,
                    branch_radius, depth + 1, max_depth
                )

    def generate_coral(self, num_main_branches: int = 5, height: float = 3.0,
                       base_radius: float = 0.15, max_depth: int = 4) -> None:
        """Generate complete coral structure with multiple main branches."""
        base_center = Vec3(0, 0, 0)

        # Create a small base mound
        for i in range(3):
            angle = 2 * math.pi * i / 3
            mound_pos = Vec3(math.cos(angle) * 0.1, 0, math.sin(angle) * 0.1)
            mound_top = Vec3(math.cos(angle) * 0.05, 0.1, math.sin(angle) * 0.05)
            self.add_cylinder(mound_pos, mound_top, base_radius * 1.5, base_radius * 1.2)

        # Generate main branches
        for i in range(num_main_branches):
            # Spread branches in a fan pattern
            angle = (i / num_main_branches - 0.5) * math.pi * 0.8  # -70 to +70 degrees spread
            spread = random.uniform(0.2, 0.5)

            direction = Vec3(
                math.sin(angle) * spread,
                0.85 + random.uniform(-0.1, 0.1),  # Mostly upward
                random.uniform(-0.2, 0.2)
            ).normalize()

            branch_height = height * random.uniform(0.7, 1.0)
            branch_radius = base_radius * random.uniform(0.8, 1.0)

            start_pos = Vec3(
                random.uniform(-0.1, 0.1),
                0.1,
                random.uniform(-0.05, 0.05)
            )

            self.generate_branch(start_pos, direction, branch_height, branch_radius, 0, max_depth)

    def write_obj(self, filepath: str) -> None:
        """Write the coral mesh to an OBJ file."""
        with open(filepath, 'w') as f:
            f.write("# Branching Coral - Generated\n")
            f.write(f"# Vertices: {len(self.vertices)}\n")
            f.write(f"# Faces: {len(self.faces)}\n\n")

            # Material reference
            mtl_name = filepath.replace('.obj', '.mtl')
            f.write(f"mtllib {mtl_name.split('/')[-1]}\n")
            f.write("usemtl coral\n\n")

            # Write vertices
            for v in self.vertices:
                f.write(f"v {v.x:.6f} {v.y:.6f} {v.z:.6f}\n")

            f.write("\n")

            # Write faces
            for face in self.faces:
                f.write(f"f {' '.join(str(i) for i in face)}\n")

        print(f"Wrote {len(self.vertices)} vertices, {len(self.faces)} faces to {filepath}")

    def write_mtl(self, filepath: str) -> None:
        """Write material file with coral color."""
        with open(filepath, 'w') as f:
            f.write("# Coral Material\n\n")
            f.write("newmtl coral\n")
            # Orange-pink coral color (like in the reference image)
            f.write("Kd 0.95 0.45 0.35\n")  # RGB: ~242, 115, 89
            f.write("Ka 0.1 0.05 0.03\n")
            f.write("Ks 0.1 0.1 0.1\n")
            f.write("Ns 10\n")

        print(f"Wrote material to {filepath}")


def main():
    parser = argparse.ArgumentParser(description='Generate branching coral OBJ model')
    parser.add_argument('-o', '--output', default='coral.obj', help='Output OBJ file')
    parser.add_argument('-s', '--seed', type=int, default=42, help='Random seed')
    parser.add_argument('-b', '--branches', type=int, default=6, help='Number of main branches')
    parser.add_argument('--height', type=float, default=3.5, help='Coral height')
    parser.add_argument('-d', '--depth', type=int, default=4, help='Max branching depth')
    parser.add_argument('-r', '--radius', type=float, default=0.12, help='Base branch radius')

    args = parser.parse_args()

    generator = CoralGenerator(seed=args.seed)
    generator.generate_coral(
        num_main_branches=args.branches,
        height=args.height,
        base_radius=args.radius,
        max_depth=args.depth
    )

    generator.write_obj(args.output)

    # Write MTL file
    mtl_path = args.output.replace('.obj', '.mtl')
    generator.write_mtl(mtl_path)

    print(f"\nTo voxelize with detail:")
    print(f"  python voxelize.py {args.output} -r 48 --detail -o {args.output.replace('.obj', '.json')}")


if __name__ == '__main__':
    main()
