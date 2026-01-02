#!/usr/bin/env python3
"""
OBJ to Voxel Converter
Converts 3D OBJ models to voxel format for use in voxel engines.

Usage:
    python voxelize.py model.obj --resolution 64 --output model.json
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
import math


@dataclass
class Vec3:
    x: float
    y: float
    z: float

    def __add__(self, other):
        return Vec3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return Vec3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar):
        return Vec3(self.x * scalar, self.y * scalar, self.z * scalar)

    def dot(self, other):
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other):
        return Vec3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x
        )

    def length(self):
        return math.sqrt(self.x * self.x + self.y * self.y + self.z * self.z)

    def normalize(self):
        l = self.length()
        if l > 0:
            return Vec3(self.x / l, self.y / l, self.z / l)
        return Vec3(0, 0, 0)


@dataclass
class Triangle:
    v0: Vec3
    v1: Vec3
    v2: Vec3
    color: Tuple[int, int, int] = (128, 128, 128)


@dataclass
class BoundingBox:
    min_pt: Vec3
    max_pt: Vec3


def parse_mtl(mtl_path: str) -> Dict[str, Tuple[int, int, int]]:
    """Parse MTL file to extract material colors."""
    materials = {}
    current_material = None

    # Default colors for common material names (when textures are used instead of Kd colors)
    default_colors = {
        'korpus': (139, 90, 43),      # Brown wood
        'korpus.1': (120, 80, 40),    # Darker wood
        'korpus.2': (150, 100, 50),   # Lighter wood
        'korpus.3': (130, 85, 45),    # Wood variation
        'korpus.4': (140, 95, 48),    # Wood variation
        'korpus.5': (135, 88, 42),    # Wood variation
        'korpus.6': (145, 92, 46),    # Wood variation
        'korpus.7': (125, 82, 38),    # Wood variation
        'korpus.8': (148, 98, 52),    # Wood variation
        'wheel': (80, 50, 30),        # Dark wood for wheel
        'sails': (240, 230, 210),     # Cream/off-white sails
        'cable': (60, 50, 40),        # Dark rope
        'window': (100, 150, 180),    # Blueish glass
        'window2': (90, 140, 170),    # Glass variation
        'flag': (180, 30, 30),        # Red flag
        'mast': (100, 70, 40),        # Mast wood
    }

    if not os.path.exists(mtl_path):
        print(f"  Warning: MTL file not found: {mtl_path}")
        return default_colors

    try:
        with open(mtl_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('newmtl '):
                    current_material = line[7:].strip()
                    # Use default color if available, otherwise generate one
                    if current_material in default_colors:
                        materials[current_material] = default_colors[current_material]
                    else:
                        # Generate color from name hash
                        h = hash(current_material)
                        materials[current_material] = (
                            80 + (h % 100),
                            60 + ((h >> 8) % 80),
                            40 + ((h >> 16) % 60)
                        )
                elif line.startswith('Kd ') and current_material:
                    # Diffuse color - only use if not white (1 1 1)
                    parts = line[3:].split()
                    if len(parts) >= 3:
                        r = float(parts[0])
                        g = float(parts[1])
                        b = float(parts[2])
                        # Only override if it's not pure white (texture placeholder)
                        if not (r > 0.99 and g > 0.99 and b > 0.99):
                            materials[current_material] = (
                                int(r * 255), int(g * 255), int(b * 255)
                            )
    except Exception as e:
        print(f"  Warning: Could not parse MTL file: {e}")

    return materials


def parse_obj(obj_path: str, exclude_materials: List[str] = None, include_objects: List[str] = None) -> Tuple[List[Triangle], BoundingBox]:
    """Parse OBJ file and return list of triangles."""
    vertices = []
    triangles = []
    materials = {}
    current_color = (128, 128, 128)  # Default gray
    current_material = None
    current_object = None
    exclude_materials = exclude_materials or []
    include_objects = include_objects or []
    excluded_count = 0

    # Look for MTL file
    obj_dir = os.path.dirname(obj_path)
    mtl_file = None

    print(f"Parsing OBJ file: {obj_path}")

    # First pass: find MTL reference and parse it
    with open(obj_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith('mtllib '):
                mtl_name = line[7:].strip()
                mtl_path = os.path.join(obj_dir, mtl_name)
                if mtl_path.startswith('./'):
                    mtl_path = os.path.join(obj_dir, mtl_name[2:])
                materials = parse_mtl(mtl_path)
                print(f"  Found {len(materials)} materials")
                break

    # Second pass: parse vertices and faces
    line_count = 0
    face_count = 0

    with open(obj_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line_count += 1
            line = line.strip()

            if line.startswith('v '):
                # Vertex
                parts = line[2:].split()
                if len(parts) >= 3:
                    vertices.append(Vec3(
                        float(parts[0]),
                        float(parts[1]),
                        float(parts[2])
                    ))

            elif line.startswith('usemtl '):
                # Material switch
                mat_name = line[7:].strip()
                current_material = mat_name
                if mat_name in materials:
                    current_color = materials[mat_name]
                else:
                    # Generate a color based on material name hash
                    h = hash(mat_name)
                    current_color = (
                        80 + (h % 120),
                        80 + ((h >> 8) % 120),
                        80 + ((h >> 16) % 120)
                    )

            elif line.startswith('o '):
                # Object name
                current_object = line[2:].strip()

            elif line.startswith('f '):
                # Skip faces from excluded materials
                if current_material and any(excl.lower() in current_material.lower() for excl in exclude_materials):
                    excluded_count += 1
                    continue
                # Skip faces from non-included objects (if filter is set)
                # Use exact match (case-insensitive) to avoid partial matches
                if include_objects and current_object and not any(inc.lower() == current_object.lower() for inc in include_objects):
                    excluded_count += 1
                    continue

                # Face - can be triangles, quads, or n-gons
                parts = line[2:].split()
                face_vertices = []

                for part in parts:
                    # Format can be: v, v/vt, v/vt/vn, or v//vn
                    idx = part.split('/')[0]
                    try:
                        vi = int(idx)
                        # OBJ indices are 1-based, can be negative
                        if vi < 0:
                            vi = len(vertices) + vi + 1
                        if 0 < vi <= len(vertices):
                            face_vertices.append(vertices[vi - 1])
                    except ValueError:
                        continue

                # Triangulate face (fan triangulation)
                if len(face_vertices) >= 3:
                    for i in range(1, len(face_vertices) - 1):
                        triangles.append(Triangle(
                            face_vertices[0],
                            face_vertices[i],
                            face_vertices[i + 1],
                            current_color
                        ))
                    face_count += 1

            # Progress indicator
            if line_count % 50000 == 0:
                print(f"  Processed {line_count} lines, {len(vertices)} vertices, {len(triangles)} triangles...")

    print(f"  Total: {len(vertices)} vertices, {len(triangles)} triangles from {face_count} faces")
    if excluded_count > 0:
        print(f"  Excluded {excluded_count} faces from materials: {exclude_materials}")

    # Calculate bounding box
    if not vertices:
        raise ValueError("No vertices found in OBJ file")

    min_pt = Vec3(float('inf'), float('inf'), float('inf'))
    max_pt = Vec3(float('-inf'), float('-inf'), float('-inf'))

    for v in vertices:
        min_pt.x = min(min_pt.x, v.x)
        min_pt.y = min(min_pt.y, v.y)
        min_pt.z = min(min_pt.z, v.z)
        max_pt.x = max(max_pt.x, v.x)
        max_pt.y = max(max_pt.y, v.y)
        max_pt.z = max(max_pt.z, v.z)

    bbox = BoundingBox(min_pt, max_pt)
    print(f"  Bounding box: ({min_pt.x:.2f}, {min_pt.y:.2f}, {min_pt.z:.2f}) to ({max_pt.x:.2f}, {max_pt.y:.2f}, {max_pt.z:.2f})")

    return triangles, bbox


def triangle_aabb_intersect(tri: Triangle, box_center: Vec3, box_half: Vec3) -> bool:
    """Check if a triangle intersects an axis-aligned bounding box."""
    # Translate triangle to box center
    v0 = tri.v0 - box_center
    v1 = tri.v1 - box_center
    v2 = tri.v2 - box_center

    # Edge vectors
    e0 = v1 - v0
    e1 = v2 - v1
    e2 = v0 - v2

    # Test the 9 separating axes from cross products of edges with box normals
    axes = [
        Vec3(0, -e0.z, e0.y), Vec3(0, -e1.z, e1.y), Vec3(0, -e2.z, e2.y),
        Vec3(e0.z, 0, -e0.x), Vec3(e1.z, 0, -e1.x), Vec3(e2.z, 0, -e2.x),
        Vec3(-e0.y, e0.x, 0), Vec3(-e1.y, e1.x, 0), Vec3(-e2.y, e2.x, 0)
    ]

    for axis in axes:
        p0 = axis.dot(v0)
        p1 = axis.dot(v1)
        p2 = axis.dot(v2)
        r = box_half.x * abs(axis.x) + box_half.y * abs(axis.y) + box_half.z * abs(axis.z)
        if max(-max(p0, p1, p2), min(p0, p1, p2)) > r:
            return False

    # Test the 3 box face normals
    if max(v0.x, v1.x, v2.x) < -box_half.x or min(v0.x, v1.x, v2.x) > box_half.x:
        return False
    if max(v0.y, v1.y, v2.y) < -box_half.y or min(v0.y, v1.y, v2.y) > box_half.y:
        return False
    if max(v0.z, v1.z, v2.z) < -box_half.z or min(v0.z, v1.z, v2.z) > box_half.z:
        return False

    # Test triangle normal
    normal = e0.cross(e1)
    d = normal.dot(v0)
    r = box_half.x * abs(normal.x) + box_half.y * abs(normal.y) + box_half.z * abs(normal.z)
    if abs(d) > r:
        return False

    return True


def hollow_out(voxels: dict, grid_size: tuple) -> dict:
    """Remove interior voxels, keeping only the shell/surface."""
    print("Hollowing out interior voxels...")

    grid_x, grid_y, grid_z = grid_size
    surface_voxels = {}

    # A voxel is on the surface if at least one neighbor is empty
    directions = [
        (1, 0, 0), (-1, 0, 0),
        (0, 1, 0), (0, -1, 0),
        (0, 0, 1), (0, 0, -1)
    ]

    for (vx, vy, vz), color in voxels.items():
        is_surface = False

        for dx, dy, dz in directions:
            neighbor = (vx + dx, vy + dy, vz + dz)
            # If neighbor is outside bounds or empty, this is a surface voxel
            if neighbor not in voxels:
                is_surface = True
                break

        if is_surface:
            surface_voxels[(vx, vy, vz)] = color

    removed = len(voxels) - len(surface_voxels)
    print(f"  Removed {removed} interior voxels, {len(surface_voxels)} surface voxels remain")
    return surface_voxels


def voxelize(triangles: List[Triangle], bbox: BoundingBox, resolution: int) -> List[dict]:
    """Convert triangles to voxels."""
    print(f"Voxelizing at resolution {resolution}...")

    # Calculate voxel size
    size = Vec3(
        bbox.max_pt.x - bbox.min_pt.x,
        bbox.max_pt.y - bbox.min_pt.y,
        bbox.max_pt.z - bbox.min_pt.z
    )

    max_size = max(size.x, size.y, size.z)
    voxel_size = max_size / resolution

    # Calculate grid dimensions (maintaining aspect ratio)
    grid_x = max(1, int(math.ceil(size.x / voxel_size)))
    grid_y = max(1, int(math.ceil(size.y / voxel_size)))
    grid_z = max(1, int(math.ceil(size.z / voxel_size)))

    print(f"  Grid size: {grid_x} x {grid_y} x {grid_z}")
    print(f"  Voxel size: {voxel_size:.4f}")

    # Voxel storage: key = (x, y, z), value = color
    voxels = {}
    half_voxel = voxel_size / 2
    box_half = Vec3(half_voxel, half_voxel, half_voxel)

    # Process each triangle
    total = len(triangles)
    for i, tri in enumerate(triangles):
        if (i + 1) % 10000 == 0:
            print(f"  Processing triangle {i + 1}/{total}...")

        # Find bounding box of triangle in voxel coordinates
        tri_min = Vec3(
            min(tri.v0.x, tri.v1.x, tri.v2.x),
            min(tri.v0.y, tri.v1.y, tri.v2.y),
            min(tri.v0.z, tri.v1.z, tri.v2.z)
        )
        tri_max = Vec3(
            max(tri.v0.x, tri.v1.x, tri.v2.x),
            max(tri.v0.y, tri.v1.y, tri.v2.y),
            max(tri.v0.z, tri.v1.z, tri.v2.z)
        )

        # Convert to voxel indices
        min_vx = max(0, int((tri_min.x - bbox.min_pt.x) / voxel_size))
        min_vy = max(0, int((tri_min.y - bbox.min_pt.y) / voxel_size))
        min_vz = max(0, int((tri_min.z - bbox.min_pt.z) / voxel_size))
        max_vx = min(grid_x - 1, int((tri_max.x - bbox.min_pt.x) / voxel_size))
        max_vy = min(grid_y - 1, int((tri_max.y - bbox.min_pt.y) / voxel_size))
        max_vz = min(grid_z - 1, int((tri_max.z - bbox.min_pt.z) / voxel_size))

        # Check each voxel in the triangle's bounding box
        for vx in range(min_vx, max_vx + 1):
            for vy in range(min_vy, max_vy + 1):
                for vz in range(min_vz, max_vz + 1):
                    key = (vx, vy, vz)
                    if key in voxels:
                        continue

                    # Calculate voxel center in world coordinates
                    center = Vec3(
                        bbox.min_pt.x + (vx + 0.5) * voxel_size,
                        bbox.min_pt.y + (vy + 0.5) * voxel_size,
                        bbox.min_pt.z + (vz + 0.5) * voxel_size
                    )

                    # Check if triangle intersects this voxel
                    if triangle_aabb_intersect(tri, center, box_half):
                        voxels[key] = tri.color

    # Convert to list format
    result = []
    for (vx, vy, vz), (r, g, b) in voxels.items():
        result.append({
            'x': vx,
            'y': vy,
            'z': vz,
            'r': r,
            'g': g,
            'b': b
        })

    print(f"  Generated {len(result)} voxels")
    return result, (grid_x, grid_y, grid_z)


def voxelize_detail(triangles: List[Triangle], bbox: BoundingBox, resolution: int) -> Tuple[List[dict], List[dict], tuple]:
    """
    Convert triangles to voxels with 4x4x4 sub-voxel detail.
    Returns (regular_voxels, detail_voxels, grid_size).
    """
    print(f"Voxelizing with detail at base resolution {resolution} (sub-voxels at {resolution * 4})...")

    DETAIL_SIZE = 4  # 4x4x4 sub-voxels per voxel

    size = Vec3(
        bbox.max_pt.x - bbox.min_pt.x,
        bbox.max_pt.y - bbox.min_pt.y,
        bbox.max_pt.z - bbox.min_pt.z
    )

    max_size = max(size.x, size.y, size.z)
    base_voxel_size = max_size / resolution
    sub_voxel_size = base_voxel_size / DETAIL_SIZE

    grid_x = max(1, int(math.ceil(size.x / base_voxel_size)))
    grid_y = max(1, int(math.ceil(size.y / base_voxel_size)))
    grid_z = max(1, int(math.ceil(size.z / base_voxel_size)))

    detail_grid_x = grid_x * DETAIL_SIZE
    detail_grid_y = grid_y * DETAIL_SIZE
    detail_grid_z = grid_z * DETAIL_SIZE

    print(f"  Base grid size: {grid_x} x {grid_y} x {grid_z}")
    print(f"  Detail grid size: {detail_grid_x} x {detail_grid_y} x {detail_grid_z}")

    sub_voxels = {}
    half_sub = sub_voxel_size / 2
    box_half = Vec3(half_sub, half_sub, half_sub)

    total = len(triangles)
    for i, tri in enumerate(triangles):
        if (i + 1) % 10000 == 0:
            print(f"  Processing triangle {i + 1}/{total}...")

        tri_min = Vec3(
            min(tri.v0.x, tri.v1.x, tri.v2.x),
            min(tri.v0.y, tri.v1.y, tri.v2.y),
            min(tri.v0.z, tri.v1.z, tri.v2.z)
        )
        tri_max = Vec3(
            max(tri.v0.x, tri.v1.x, tri.v2.x),
            max(tri.v0.y, tri.v1.y, tri.v2.y),
            max(tri.v0.z, tri.v1.z, tri.v2.z)
        )

        min_sx = max(0, int((tri_min.x - bbox.min_pt.x) / sub_voxel_size))
        min_sy = max(0, int((tri_min.y - bbox.min_pt.y) / sub_voxel_size))
        min_sz = max(0, int((tri_min.z - bbox.min_pt.z) / sub_voxel_size))
        max_sx = min(detail_grid_x - 1, int((tri_max.x - bbox.min_pt.x) / sub_voxel_size))
        max_sy = min(detail_grid_y - 1, int((tri_max.y - bbox.min_pt.y) / sub_voxel_size))
        max_sz = min(detail_grid_z - 1, int((tri_max.z - bbox.min_pt.z) / sub_voxel_size))

        for sx in range(min_sx, max_sx + 1):
            for sy in range(min_sy, max_sy + 1):
                for sz in range(min_sz, max_sz + 1):
                    key = (sx, sy, sz)
                    if key in sub_voxels:
                        continue

                    center = Vec3(
                        bbox.min_pt.x + (sx + 0.5) * sub_voxel_size,
                        bbox.min_pt.y + (sy + 0.5) * sub_voxel_size,
                        bbox.min_pt.z + (sz + 0.5) * sub_voxel_size
                    )

                    if triangle_aabb_intersect(tri, center, box_half):
                        sub_voxels[key] = tri.color

    print(f"  Generated {len(sub_voxels)} sub-voxels")

    # Group sub-voxels by parent voxel position
    parent_voxels = {}
    for (sx, sy, sz), color in sub_voxels.items():
        vx = sx // DETAIL_SIZE
        vy = sy // DETAIL_SIZE
        vz = sz // DETAIL_SIZE
        sub_x = sx % DETAIL_SIZE
        sub_y = sy % DETAIL_SIZE
        sub_z = sz % DETAIL_SIZE

        parent_key = (vx, vy, vz)
        if parent_key not in parent_voxels:
            parent_voxels[parent_key] = {}
        parent_voxels[parent_key][(sub_x, sub_y, sub_z)] = color

    # Separate into regular voxels (fully filled same color) and detail voxels
    regular_voxels = []
    detail_voxels = []
    TOTAL_SUB_VOXELS = DETAIL_SIZE ** 3

    for (vx, vy, vz), sub_data in parent_voxels.items():
        if len(sub_data) == TOTAL_SUB_VOXELS:
            colors = list(sub_data.values())
            first_color = colors[0]
            if all(c == first_color for c in colors):
                regular_voxels.append({
                    'x': vx, 'y': vy, 'z': vz,
                    'r': first_color[0], 'g': first_color[1], 'b': first_color[2]
                })
                continue

        # Partial fill or mixed colors - use detail voxels
        sub_list = []
        for (sub_x, sub_y, sub_z), (r, g, b) in sub_data.items():
            sub_list.append({
                'sx': sub_x, 'sy': sub_y, 'sz': sub_z,
                'r': r, 'g': g, 'b': b
            })
        detail_voxels.append({
            'x': vx, 'y': vy, 'z': vz,
            'subVoxels': sub_list
        })

    print(f"  Regular voxels (fully solid): {len(regular_voxels)}")
    print(f"  Detail voxels (with sub-voxels): {len(detail_voxels)}")

    return regular_voxels, detail_voxels, (grid_x, grid_y, grid_z)


def main():
    parser = argparse.ArgumentParser(description='Convert OBJ models to voxels')
    parser.add_argument('input', help='Input OBJ file')
    parser.add_argument('-r', '--resolution', type=int, default=64,
                        help='Voxel resolution (default: 64)')
    parser.add_argument('-o', '--output', help='Output JSON file (default: input.json)')
    parser.add_argument('--compact', action='store_true',
                        help='Output compact array format instead of objects')
    parser.add_argument('-e', '--exclude', nargs='+', default=[],
                        help='Material names to exclude (e.g., --exclude sails)')
    parser.add_argument('-i', '--include-objects', nargs='+', default=[],
                        help='Only include these objects (e.g., --include-objects Plane)')
    parser.add_argument('--color', type=str, default=None,
                        help='Override color as R,G,B (e.g., --color 128,128,128)')
    parser.add_argument('--rotate-y', type=float, default=0,
                        help='Rotate model around Y axis in degrees')
    parser.add_argument('--hollow', action='store_true',
                        help='Make model hollow (remove interior voxels)')
    parser.add_argument('--detail', action='store_true',
                        help='Generate detail voxels with 4x4x4 sub-voxels for higher resolution')

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: File not found: {args.input}")
        sys.exit(1)

    output_path = args.output or args.input.rsplit('.', 1)[0] + '.json'

    if args.exclude:
        print(f"Excluding materials: {args.exclude}")

    # Parse OBJ
    triangles, bbox = parse_obj(args.input, args.exclude, args.include_objects)

    if not triangles:
        print("Error: No triangles found in OBJ file")
        sys.exit(1)

    # Rotate around Y axis if requested
    if args.rotate_y != 0:
        angle_rad = math.radians(args.rotate_y)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        print(f"Rotating {args.rotate_y} degrees around Y axis...")
        rotated_triangles = []
        for tri in triangles:
            def rotate_y(v):
                return Vec3(
                    v.x * cos_a + v.z * sin_a,
                    v.y,
                    -v.x * sin_a + v.z * cos_a
                )
            rotated_triangles.append(Triangle(
                rotate_y(tri.v0), rotate_y(tri.v1), rotate_y(tri.v2), tri.color
            ))
        triangles = rotated_triangles
        # Recalculate bounding box after rotation
        all_verts = []
        for tri in triangles:
            all_verts.extend([tri.v0, tri.v1, tri.v2])
        bbox = BoundingBox(
            Vec3(min(v.x for v in all_verts), min(v.y for v in all_verts), min(v.z for v in all_verts)),
            Vec3(max(v.x for v in all_verts), max(v.y for v in all_verts), max(v.z for v in all_verts))
        )

    # Voxelize (with or without detail)
    if args.detail:
        regular_voxels, detail_voxels, grid_size = voxelize_detail(triangles, bbox, args.resolution)
        voxels = regular_voxels
    else:
        voxels, grid_size = voxelize(triangles, bbox, args.resolution)
        detail_voxels = []

    # Hollow out interior if requested (only for non-detail mode)
    if args.hollow and not args.detail:
        voxel_dict = {(v['x'], v['y'], v['z']): (v['r'], v['g'], v['b']) for v in voxels}
        voxel_dict = hollow_out(voxel_dict, grid_size)
        voxels = [{'x': x, 'y': y, 'z': z, 'r': r, 'g': g, 'b': b}
                  for (x, y, z), (r, g, b) in voxel_dict.items()]

    # Override color if requested
    if args.color:
        r, g, b = [int(c) for c in args.color.split(',')]
        print(f"Overriding color to RGB({r}, {g}, {b})")
        for v in voxels:
            v['r'], v['g'], v['b'] = r, g, b
        for dv in detail_voxels:
            for sv in dv['subVoxels']:
                sv['r'], sv['g'], sv['b'] = r, g, b

    # Save output
    print(f"Saving to {output_path}...")

    output_data = {
        'resolution': args.resolution,
        'gridSize': {'x': grid_size[0], 'y': grid_size[1], 'z': grid_size[2]},
        'voxelCount': len(voxels),
        'voxels': voxels
    }

    if args.detail:
        output_data['hasDetail'] = True
        output_data['detailVoxelCount'] = len(detail_voxels)
        output_data['detailVoxels'] = detail_voxels

    if args.compact:
        # Compact format: [[x, y, z, r, g, b], ...]
        output_data['voxels'] = [[v['x'], v['y'], v['z'], v['r'], v['g'], v['b']] for v in voxels]

    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2 if not args.compact else None)

    file_size = os.path.getsize(output_path)
    print(f"Done! Output: {output_path} ({file_size / 1024:.1f} KB)")
    print(f"\nTo use in your voxel engine:")
    print(f"  1. Load the JSON file")
    if args.detail:
        print(f"  2. For each voxel: world.setVoxel(x + offsetX, y + offsetY, z + offsetZ, r, g, b)")
        print(f"  3. For each detailVoxel: world.setDetailVoxel(x + offsetX, y + offsetY, z + offsetZ, sx, sy, sz, r, g, b)")
    else:
        print(f"  2. For each voxel: world.setVoxel(x + offsetX, y + offsetY, z + offsetZ, r, g, b)")


if __name__ == '__main__':
    main()
