"""Inventory item icons (QA-023): one transparent PNG per item id in src/content/data/items.ts.
Run: blender --background --python assets/source/icons/build.py [-- --only <itemId>]

Items with a game model render from that GLB; the rest get a tiny icon-only model built here (palette swatches,
chamfered, same style as the props). Workbench: studio light, cavity + object outline, transparent film,
orthographic. Weapons in side profile (muzzle right), everything else at a 3/4 view.
Output: public/assets/icons/<id>.png (128 px on the longest side, tight crop, long axis matching the item's w x h
grid shape), public/assets/icons/index.json, assets/previews/icons_sheet.png (128 px row + 56 px row on tile colour).
"""
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "tools", "blender"))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import vlib  # noqa: E402

SIZE, RENDER = 128, 512
OUT = os.path.join(vlib.ROOT, "public", "assets", "icons")
WPN = os.path.join(vlib.ROOT, "public", "assets", "models", "wpn")
GLB = {"pistol_a": "wpn_pistol_a", "rifle_a": "wpn_rifle_a", "knife_a": "wpn_knife_a",
       "mag_pistol_a": "wpn_mag_pistol_a", "mag_rifle_a": "wpn_mag_rifle_a",
       "crowbar_a": "wpn_crowbar_a", "hammer_a": "wpn_hammer_a"}
SIDE = {"pistol_a", "rifle_a", "knife_a", "crowbar_a", "hammer_a", "metal_pipe"}  # side profile


def items():
    src = open(os.path.join(vlib.ROOT, "src", "content", "data", "items.ts"), encoding="utf8").read()
    return [(m[0], int(m[1]), int(m[2])) for m in re.findall(r"id: '([a-z0-9_]+)',[^}]*?\bw: (\d+), h: (\d+)", src)]


# ------------------------------------------------------------------------------- icon-only models (glTF coords, y up)
def ammo_9mm(m):  # open cardboard box of brass rounds
    m.box((0, 0.02, 0), (0.12, 0.04, 0.08), "cardboard", bevel=0.003)
    m.box((0, 0.018, 0), (0.122, 0.018, 0.082), "paper", bevel=0.001)  # label band
    m.box((0, 0.045, -0.055), (0.12, 0.003, 0.05), "cardboard", rot=(-35, 0, 0))  # open lid
    for i in range(5):
        for j in range(3):
            c = (-0.044 + i * 0.022, 0.04, -0.022 + j * 0.022)
            m.lathe([(0.0085, 0.0), (0.0085, 0.008), (0.0065, 0.014), (0.0, 0.018)], "paint_yellow_faded",
                    center=c, segments=8)


def ammo_762(m):  # olive ammo can with a yellow stripe and a carry handle
    m.box((0, 0.045, 0), (0.15, 0.09, 0.08), "military_olive", bevel=0.005)
    m.box((0, 0.093, 0), (0.156, 0.01, 0.086), "metal_dark", bevel=0.002)  # lid
    m.box((0, 0.055, 0), (0.152, 0.016, 0.082), "paint_yellow_faded")  # stripe
    m.box((0.035, 0.03, 0.041), (0.05, 0.016, 0.003), "stencil_white")  # stencil plate
    m.box((0, 0.106, 0), (0.07, 0.008, 0.012), "metal_dark", bevel=0.002)  # handle
    for x in (-0.034, 0.034):
        m.box((x, 0.101, 0), (0.008, 0.012, 0.012), "metal_dark")


def bandage(m):  # rolled bandage with a loose tail and a red stripe
    m.lathe([(0.0, -0.025), (0.028, -0.025), (0.031, -0.021), (0.032, 0.0), (0.031, 0.021), (0.028, 0.025),
             (0.0, 0.025)], "stencil_white", center=(0, 0.032, 0), segments=12, axis="x")
    m.lathe([(0.0, -0.0255), (0.009, -0.0255)], "wood_weathered", center=(0, 0.032, 0), segments=8, axis="x")  # core
    m.lathe([(0.0323, -0.017), (0.0323, -0.008)], "paint_red_faded", center=(0, 0.032, 0), segments=12, axis="x")
    m.box((0, 0.002, 0.045), (0.048, 0.003, 0.08), "stencil_white")  # tail unrolled on the ground


def canned_beans(m):
    m.lathe([(0.0, 0.0), (0.036, 0.0), (0.038, 0.004), (0.036, 0.008), (0.036, 0.092), (0.038, 0.096),
             (0.036, 0.1), (0.0, 0.1)], "metal_bare", center=(0, 0, 0), segments=14)
    m.lathe([(0.0375, 0.016), (0.0375, 0.084)], "paint_red_faded", center=(0, 0, 0), segments=14)  # label
    m.lathe([(0.0378, 0.038), (0.0378, 0.062)], "paper", center=(0, 0, 0), segments=14, rot=(0, 0, 0))
    m.box((0, 0.05, 0.0375), (0.03, 0.02, 0.004), "rust")  # beans picture on the label


def water_bottle(m):
    m.lathe([(0.0, 0.0), (0.03, 0.0), (0.033, 0.006), (0.033, 0.15), (0.029, 0.17), (0.013, 0.195),
             (0.013, 0.205), (0.0, 0.205)], "glass", segments=12)
    m.lathe([(0.0336, 0.06), (0.0336, 0.115)], "paint_blue_faded", segments=12)  # label
    m.lathe([(0.0, 0.2), (0.015, 0.2), (0.015, 0.222), (0.0, 0.222)], "plastic_white", segments=10)  # cap


def wood_planks(m):  # two planks side by side, a third laid across them at a slight angle
    for sw, x, y, ry in (("wood_raw", -0.056, 0.011, 0), ("wood_weathered", 0.056, 0.011, 0), ("plywood", 0.0, 0.032, 7)):
        m.box((x, y, 0), (0.1, 0.02, 0.6), sw, bevel=0.003, rot=(0, ry, 0))
        for dz, dx in ((0.12, 0.02), (-0.15, -0.025)):
            m.box((x + dx, y + 0.0105, dz), (0.006, 0.002, 0.12), "wood_dark", rot=(0, ry, 0))  # grain


def nails(m):  # small blue-labelled box, nails standing in it and a few loose ones
    m.box((0, 0.025, 0), (0.08, 0.05, 0.06), "cardboard", bevel=0.003)
    m.box((0, 0.025, 0), (0.082, 0.026, 0.062), "paint_blue_faded")
    for i, (x, z, tilt) in enumerate(((-0.022, -0.012, 8), (0.0, 0.01, -6), (0.02, -0.008, 12), (-0.01, 0.014, -14),
                                      (0.025, 0.016, 4), (-0.026, 0.012, -4))):
        m.cylinder((x, 0.06, z), 0.0025, 0.05, "metal_bare", segments=5)
        m.cylinder((x, 0.086, z), 0.006, 0.003, "metal_bare", segments=8)
    for x, z, r in ((0.07, 0.02, 30), (0.06, -0.04, -60)):
        m.box((x, 0.003, z), (0.004, 0.004, 0.06), "metal_bare", rot=(0, r, 0))
        m.box((x - 0.028 * math.sin(math.radians(r)), 0.003, z - 0.028 * math.cos(math.radians(r))),
              (0.011, 0.003, 0.011), "metal_bare", rot=(0, r, 0))


def scrap_metal(m):  # bent rusty sheet, a blue-painted offcut and a pipe stub
    m.box((-0.03, 0.006, 0), (0.12, 0.004, 0.14), "rust", rot=(0, 0, 4))
    m.box((0.055, 0.03, 0), (0.07, 0.004, 0.14), "rust", rot=(0, 0, 40))  # bent flap
    m.box((-0.01, 0.022, 0.03), (0.09, 0.004, 0.08), "paint_blue_faded", rot=(8, 25, -6))
    m.box((-0.03, 0.03, -0.03), (0.07, 0.004, 0.05), "metal_bare", rot=(-12, -20, 10))
    m.cylinder((0.0, 0.016, -0.075), 0.012, 0.1, "metal_dark", segments=8, axis="x")


def backpack_small(m):
    m.box((0, 0.17, 0), (0.28, 0.34, 0.13), "cloth_khaki", bevel=0.03)  # body
    m.box((0, 0.1, -0.075), (0.2, 0.15, 0.04), "leather_brown", bevel=0.012)  # front pocket
    m.box((0, 0.3, -0.035), (0.27, 0.1, 0.08), "leather_brown", bevel=0.015, rot=(-12, 0, 0))  # top flap
    for x in (-0.06, 0.06):
        m.box((x, 0.21, -0.07), (0.022, 0.18, 0.012), "cloth_black")  # flap straps
        m.box((x, 0.165, -0.077), (0.03, 0.02, 0.006), "metal_bare")  # buckles
    for x in (-0.155, 0.155):
        m.box((x, 0.1, 0), (0.04, 0.14, 0.09), "cloth_khaki", bevel=0.01)  # side pockets
    m.box((0, 0.36, 0.04), (0.06, 0.03, 0.02), "cloth_black", bevel=0.005)  # grab handle


def jacket_field(m):  # folded olive field jacket
    m.box((0, 0.03, 0), (0.32, 0.06, 0.36), "cloth_olive", bevel=0.015)
    m.box((0, 0.066, -0.15), (0.22, 0.016, 0.07), "military_olive", bevel=0.006)  # collar
    m.box((0, 0.062, 0.02), (0.018, 0.004, 0.3), "military_olive")  # placket
    for x in (-0.075, 0.075):
        m.box((x, 0.064, -0.06), (0.09, 0.006, 0.07), "military_olive", bevel=0.003)  # chest pockets
        m.box((x, 0.068, -0.085), (0.092, 0.004, 0.024), "cloth_olive", bevel=0.002)  # pocket flaps
        m.cylinder((x, 0.071, -0.085), 0.005, 0.003, "military_tan", segments=6)  # buttons
    m.box((-0.06, 0.064, 0.11), (0.2, 0.012, 0.05), "military_olive", bevel=0.005, rot=(0, 25, 0))  # folded sleeve


def cloth_rag(m):  # crumpled rag with a folded corner
    m.box((0, 0.004, 0), (0.17, 0.006, 0.13), "cloth_khaki", bevel=0.002, rot=(0, 8, 0))  # flat sheet
    m.box((0.035, 0.012, 0.035), (0.11, 0.006, 0.06), "cloth_khaki", bevel=0.002, rot=(0, -14, 4))  # fold over
    m.box((-0.05, 0.014, -0.03), (0.06, 0.012, 0.08), "cloth_khaki", bevel=0.005, rot=(0, 30, -12))  # bunched end
    m.box((0, 0.0075, 0), (0.172, 0.002, 0.03), "cloth_red", rot=(0, 8, 0))  # woven stripe
    m.box((0.075, 0.02, 0.05), (0.035, 0.004, 0.03), "cloth_grey", bevel=0.001, rot=(25, 40, 20))  # torn corner


def repair_kit(m):  # red metal toolbox, carry handle, two latches, a wrench laid across the lid
    m.box((0, 0.05, 0), (0.3, 0.1, 0.13), "paint_red_faded", bevel=0.006)  # body
    m.box((0, 0.106, 0), (0.306, 0.016, 0.136), "paint_red_faded", bevel=0.004)  # lid
    m.box((0, 0.098, 0), (0.308, 0.004, 0.138), "metal_dark")  # lid seam
    for x in (-0.1, 0.1):
        m.box((x, 0.09, -0.067), (0.026, 0.03, 0.006), "metal_bare", bevel=0.002)  # latches
        m.box((x * 0.55, 0.124, 0), (0.012, 0.02, 0.014), "metal_dark")  # handle posts
    m.box((0, 0.136, 0), (0.13, 0.012, 0.016), "metal_dark", bevel=0.003)  # handle grip
    m.box((0.02, 0.118, 0.035), (0.22, 0.006, 0.018), "metal_bare", bevel=0.002, rot=(0, 12, 0))  # wrench shaft
    for dx, r in ((-0.11, 12), (0.15, 12)):
        m.cylinder((0.02 + dx * math.cos(math.radians(r)), 0.118, 0.035 + dx * math.sin(math.radians(r))),
                   0.02, 0.006, "metal_bare", segments=8)  # wrench heads


MODELS = {f.__name__: f for f in (repair_kit, ammo_9mm, ammo_762, bandage, canned_beans, water_bottle, wood_planks, nails,
                                  scrap_metal, backpack_small, jacket_field, cloth_rag)}


# ------------------------------------------------------------------------------- M2 content items (asset-builder A)
# Authored with the showcase face toward -Z (the game's front); build() turns them 180 deg so that face is toward the
# icon camera (which sits on the +Z side). Real-ish sizes in metres; the camera fits the frame.
FRONT_TO_CAMERA = set()


def m2(f):
    FRONT_TO_CAMERA.add(f.__name__)
    return f


def _can(m, r, h, body, label, band=None, rim="metal_bare"):
    m.lathe([(0.0, 0.0), (r, 0.0), (r + 0.002, 0.004), (r, 0.008), (r, h - 0.008), (r + 0.002, h - 0.004), (r, h),
             (0.0, h)], rim, segments=14)
    m.lathe([(r + 0.0015, h * 0.15), (r + 0.0015, h * 0.85)], body, segments=14)
    if label:
        m.lathe([(r + 0.0018, h * 0.38), (r + 0.0018, h * 0.62)], label, segments=14)
    if band:
        m.lathe([(r + 0.0018, h * 0.7), (r + 0.0018, h * 0.78)], band, segments=14)


def _cross(m, c, s, t, sw="stencil_white", axis="z"):
    """Flat plus sign centred at c, arm length s, thickness t; on a face normal to `axis`."""
    x, y, z = c
    if axis == "z":
        m.box((x, y, z), (s, s / 3, t), sw)
        m.box((x, y, z), (s / 3, s, t), sw)
    else:  # on a top (y) face
        m.box((x, y, z), (s, t, s / 3), sw)
        m.box((x, y, z), (s / 3, t, s), sw)


@m2
def ammo_9mm_box(m):  # closed blue-labelled carton, rounds spilled in front
    m.box((0, 0.025, 0), (0.12, 0.05, 0.08), "cardboard", bevel=0.003)
    m.box((0, 0.025, -0.0405), (0.1, 0.03, 0.002), "paint_blue_faded")
    m.box((-0.02, 0.025, -0.042), (0.04, 0.012, 0.002), "stencil_white")
    m.box((0, 0.051, 0), (0.122, 0.003, 0.02), "paper")  # end flap tape
    for i, (x, z, r) in enumerate(((-0.03, -0.07, 70), (0.0, -0.075, 100), (0.035, -0.065, 80))):
        m.lathe([(0.0, 0.0), (0.0048, 0.0), (0.0048, 0.019), (0.003, 0.026), (0.0, 0.028)], "paint_yellow_faded",
                center=(x, 0.005, z), segments=8, axis="x", rot=(0, r, 0))


@m2
def medkit(m):  # red hard case, white cross on the lid, grey handle and latches
    m.box((0, 0.06, 0), (0.3, 0.12, 0.22), "paint_red_faded", bevel=0.012)
    m.box((0, 0.065, 0), (0.304, 0.008, 0.224), "metal_dark")  # lid seam
    _cross(m, (0, 0.121, 0.01), 0.11, 0.004, axis="y")
    for x in (-0.09, 0.09):
        m.box((x, 0.06, -0.112), (0.03, 0.03, 0.008), "metal_bare", bevel=0.002)  # latches
    m.box((0, 0.1, -0.118), (0.1, 0.014, 0.014), "plastic_black", bevel=0.004)  # handle


@m2
def splint(m):  # two slats bound with white tape
    for x in (-0.022, 0.022):
        m.box((x, 0.2, 0), (0.035, 0.4, 0.012), "wood_raw", bevel=0.003)
    for y in (0.07, 0.2, 0.33):
        m.box((0, y, 0), (0.084, 0.03, 0.02), "stencil_white", bevel=0.003)


@m2
def antibiotics(m):  # white/blue carton with a foil blister sheet half out
    m.box((0, 0.015, 0.02), (0.1, 0.03, 0.06), "plastic_white", bevel=0.002)
    m.box((0.01, 0.015, -0.0105), (0.07, 0.02, 0.002), "paint_blue_faded")
    m.box((-0.045, 0.031, 0.02), (0.01, 0.002, 0.06), "paint_blue_faded")
    m.box((0.035, 0.006, -0.03), (0.08, 0.004, 0.05), "metal_bare", rot=(0, 15, 0))  # blister foil
    for i in range(3):
        for j in range(2):
            m.cylinder((0.008 + i * 0.022, 0.011, -0.038 + j * 0.02), 0.006, 0.006, "plastic_white", segments=6)


@m2
def ifak(m):  # olive MOLLE pouch, red cross patch, black buckle strap
    m.box((0, 0.06, 0), (0.2, 0.12, 0.08), "military_olive", bevel=0.02)
    m.box((0, 0.1, -0.035), (0.2, 0.04, 0.03), "cloth_olive", bevel=0.01, rot=(-10, 0, 0))  # lid
    m.box((0, 0.055, -0.042), (0.06, 0.06, 0.004), "cloth_red", bevel=0.002)
    _cross(m, (0, 0.055, -0.045), 0.04, 0.002)
    for x in (-0.07, 0.07):
        m.box((x, 0.07, -0.042), (0.02, 0.09, 0.004), "cloth_black")


@m2
def painkillers(m):  # orange pharmacy bottle, white child cap, paper label
    m.lathe([(0.0, 0.0), (0.02, 0.0), (0.022, 0.004), (0.022, 0.06), (0.0, 0.06)], "fabric_orange", segments=12)
    m.lathe([(0.0225, 0.012), (0.0225, 0.046)], "paper", segments=12)
    m.lathe([(0.0, 0.058), (0.024, 0.058), (0.025, 0.062), (0.025, 0.078), (0.0, 0.08)], "plastic_white", segments=12)
    for k in range(6):  # cap ridges
        a = k * math.pi / 3
        m.box((0.0255 * math.cos(a), 0.07, 0.0255 * math.sin(a)), (0.004, 0.014, 0.004), "plastic_white")


@m2
def antiviral(m):  # autoinjector pen with an orange safety cap and a barcode band, plus a small vial
    with m.xform((0, 0.014, 0), (0, 30, 90)):
        m.lathe([(0.0, -0.075), (0.013, -0.075), (0.014, -0.07), (0.014, 0.06), (0.0, 0.06)], "plastic_white",
                segments=10)
        m.lathe([(0.0145, -0.02), (0.0145, 0.02)], "paint_blue_faded", segments=10)
        for k in range(5):
            m.lathe([(0.0148, -0.015 + k * 0.007), (0.0148, -0.012 + k * 0.007)], "plastic_black", segments=10)
        m.lathe([(0.0, 0.06), (0.012, 0.06), (0.012, 0.08), (0.0, 0.082)], "fabric_orange", segments=10)
    m.lathe([(0.0, 0.0), (0.011, 0.0), (0.011, 0.03), (0.006, 0.036), (0.0, 0.036)], "glass", center=(0.03, 0, -0.04),
            segments=8)
    m.lathe([(0.0, 0.034), (0.008, 0.034), (0.008, 0.045), (0.0, 0.045)], "paint_red_faded", center=(0.03, 0, -0.04),
            segments=8)


@m2
def energy_bar(m):  # wrapped bar with crimped ends
    m.box((0, 0.012, 0), (0.1, 0.022, 0.04), "paint_yellow_faded", bevel=0.006)
    for x in (-0.056, 0.056):
        m.box((x, 0.012, 0), (0.014, 0.004, 0.042), "paint_yellow_faded")
    m.box((0, 0.012, -0.0205), (0.05, 0.012, 0.002), "leather_brown")
    m.box((0, 0.0235, 0), (0.05, 0.002, 0.02), "leather_brown")


@m2
def canned_soup(m):
    _can(m, 0.034, 0.105, "plastic_white", None)
    m.lathe([(0.0357, 0.055), (0.0357, 0.09)], "paint_red_faded", segments=14)  # red top half of the label
    m.lathe([(0.0359, 0.03), (0.0359, 0.04)], "paint_yellow_faded", segments=14)  # gold medallion band


@m2
def canned_tuna(m):  # flat can, blue label, pull ring
    _can(m, 0.044, 0.04, "paint_blue_faded", "paper")
    m.lathe([(0.012, 0.041), (0.016, 0.041), (0.016, 0.043), (0.012, 0.043)], "metal_dark", center=(0.015, 0, 0),
            segments=8, closed=True)
    m.box((0.0, 0.042, 0), (0.016, 0.002, 0.008), "metal_dark")


@m2
def mre(m):  # tan retort pouch standing up, heat seal, black text block
    m.box((0, 0.13, 0), (0.18, 0.26, 0.04), "military_tan", bevel=0.014)
    m.box((0, 0.25, 0), (0.18, 0.025, 0.012), "military_tan", bevel=0.003)  # top seal
    for y in (0.23, 0.0035):
        m.box((0, y + 0.012, -0.0205), (0.16, 0.004, 0.002), "cardboard")
    m.box((0, 0.16, -0.0205), (0.11, 0.05, 0.002), "hazard_black")
    m.box((0, 0.1, -0.0205), (0.07, 0.015, 0.002), "hazard_black")


@m2
def energy_drink(m):  # tall slim can, black with green slashes
    _can(m, 0.028, 0.16, "hazard_black", None)
    for y, r in ((0.06, 20), (0.1, 20)):
        m.box((0, y, -0.0298), (0.03, 0.014, 0.002), "paint_green_faded", rot=(0, 0, r))
    m.lathe([(0.0, 0.16), (0.02, 0.16), (0.016, 0.165), (0.0, 0.165)], "metal_bare", segments=10)


@m2
def canteen(m):  # olive-covered steel canteen standing, black screw cap with chain
    m.lathe([(0.0, 0.0), (0.06, 0.0), (0.068, 0.02), (0.07, 0.12), (0.06, 0.17), (0.03, 0.19), (0.0, 0.19)],
            "cloth_olive", segments=12, scale=(1, 1, 0.55))
    m.lathe([(0.0, 0.185), (0.017, 0.185), (0.017, 0.215), (0.0, 0.216)], "plastic_black", segments=10)
    m.box((0, 0.12, -0.04), (0.06, 0.07, 0.004), "military_olive", bevel=0.002)  # cover pocket
    m.box((0.035, 0.18, -0.02), (0.006, 0.04, 0.004), "metal_bare", rot=(0, 0, -30))  # chain
    m.box((0, 0.02, -0.035), (0.09, 0.012, 0.012), "cloth_black")  # belt clip strap


@m2
def cloth(m):  # stack of three folded fabric squares
    for i, (sw, r) in enumerate((("cloth_denim", 0), ("cloth_grey", 9), ("cloth_red", -6))):
        m.box((0.004 * i, 0.012 + i * 0.018, 0), (0.17, 0.016, 0.13), sw, bevel=0.006, rot=(0, r, 0))
    m.box((0.06, 0.06, 0.03), (0.05, 0.004, 0.06), "cloth_red", rot=(0, -6, 18))  # loose corner


@m2
def duct_tape(m):  # silver roll lying flat, cardboard core, a tail hanging off
    m.lathe([(0.033, 0.0), (0.055, 0.0), (0.056, 0.004), (0.056, 0.046), (0.055, 0.05), (0.033, 0.05)],
            "metal_bare", segments=16, closed=True)
    m.lathe([(0.03, 0.0), (0.033, 0.0), (0.033, 0.05), (0.03, 0.05)], "cardboard", segments=16, closed=True)
    m.box((0.04, 0.025, -0.07), (0.045, 0.002, 0.06), "metal_bare", rot=(0, 30, 0))


@m2
def rope(m):  # coiled rope standing on edge, tail across
    for i in range(4):
        m.lathe([(0.1 + 0.016 * math.cos(a), 0.016 * math.sin(a))
                 for a in (2 * math.pi * k / 6 for k in range(6))], "fabric_orange" if i % 2 else "cloth_khaki",
                center=(0.004 * i, 0.12, -0.045 + i * 0.03), segments=14, axis="z", closed=True)
    m.box((0.0, 0.12, 0.0), (0.03, 0.06, 0.13), "cloth_khaki", bevel=0.008)  # binding wrap
    m.box((0.06, 0.012, -0.06), (0.024, 0.024, 0.2), "cloth_khaki", rot=(0, 40, 0))  # loose tail


@m2
def electronic_parts(m):  # green circuit board, chips, capacitors, two wires
    m.box((0, 0.004, 0), (0.15, 0.006, 0.1), "paint_green_faded", bevel=0.001)
    for x, z, w in ((-0.03, -0.01, 0.04), (0.035, 0.02, 0.025)):
        m.box((x, 0.011, z), (w, 0.008, 0.025), "plastic_black", bevel=0.001)
    for x, z in ((0.04, -0.025), (0.055, -0.025), (-0.055, 0.03)):
        m.cylinder((x, 0.017, z), 0.006, 0.02, "paint_blue_faded", segments=8)
    m.box((-0.05, 0.012, -0.03), (0.02, 0.01, 0.012), "paint_yellow_faded")
    for sw, z, r in (("cloth_red", 0.035, 12), ("paint_blue_faded", 0.045, -8)):
        m.box((-0.02, 0.01, z + 0.02), (0.13, 0.006, 0.006), sw, rot=(0, r, 0))


@m2
def gunpowder(m):  # black metal tin, red label, gold cap
    m.lathe([(0.0, 0.0), (0.045, 0.0), (0.045, 0.09), (0.03, 0.105), (0.0, 0.105)], "metal_dark", segments=14)
    m.lathe([(0.0455, 0.02), (0.0455, 0.075)], "paint_red_faded", segments=14)
    m.lathe([(0.0458, 0.04), (0.0458, 0.055)], "hazard_black", segments=14)
    m.lathe([(0.0, 0.1), (0.022, 0.1), (0.022, 0.122), (0.0, 0.123)], "paint_yellow_faded", segments=10)


@m2
def metal_pipe(m):  # steel pipe standing, threaded collar on top, rust bands
    m.lathe([(0.03, 0.0), (0.04, 0.0), (0.04, 0.84), (0.03, 0.84)], "metal_bare", segments=10, closed=True)  # icon: chunky
    m.lathe([(0.048, 0.8), (0.048, 0.9)], "metal_dark", segments=10)  # threaded coupling
    for y in (0.2, 0.55):
        m.lathe([(0.041, y), (0.041, y + 0.08)], "rust", segments=10)


@m2
def lockpick(m):  # tension wrench + hook pick, black grips, on a small leather wallet
    m.box((0, 0.003, 0), (0.12, 0.004, 0.08), "leather_brown", bevel=0.003)  # open leather roll
    for i, z in enumerate((-0.022, 0.0, 0.022)):  # three picks: bright handle + steel shank + tip shape
        m.box((-0.035, 0.009, z), (0.04, 0.008, 0.012), "fabric_orange", bevel=0.002)
        m.box((0.02, 0.008, z), (0.07, 0.004, 0.004), "metal_bare")
        m.box((0.054, 0.008, z - 0.003 * (i - 1)), (0.006, 0.004, 0.01 + 0.004 * i), "metal_bare")
    m.box((0.0, 0.009, 0.034), (0.08, 0.004, 0.006), "metal_bare", rot=(0, -4, 0))  # tension wrench
    m.box((-0.04, 0.009, 0.026), (0.006, 0.004, 0.02), "metal_bare")


@m2
def wrench(m):  # adjustable wrench standing, head up
    m.box((0, 0.11, 0), (0.024, 0.22, 0.009), "metal_bare", bevel=0.003)
    m.extrude([(-0.03, 0.21), (0.03, 0.21), (0.034, 0.25), (0.016, 0.28), (0.016, 0.245), (-0.008, 0.245),
               (-0.008, 0.275), (-0.026, 0.26)], 0.012, "metal_bare", axis="z", bevel=0.002)
    m.cylinder((0.0, 0.222, -0.007), 0.007, 0.006, "metal_dark", segments=8, axis="z")  # worm screw
    m.box((0, 0.06, -0.006), (0.012, 0.05, 0.002), "rust")
    m.cylinder((0, 0.018, 0), 0.006, 0.012, "metal_dark", segments=8, axis="z")  # hang hole


@m2
def flashlight_a(m):  # heavy aluminium flashlight standing, head up, warm lens
    m.lathe([(0.0, 0.0), (0.017, 0.0), (0.018, 0.01), (0.018, 0.16), (0.026, 0.19), (0.027, 0.23), (0.0, 0.23)],
            "metal_dark", segments=12)
    m.lathe([(0.0, 0.231), (0.022, 0.231)], "light_warm", segments=12)
    m.lathe([(0.0185, 0.04), (0.0185, 0.13)], "plastic_black", segments=12)  # knurled grip
    m.box((0, 0.15, -0.019), (0.012, 0.016, 0.006), "plastic_black", bevel=0.002)  # switch


@m2
def cash(m):  # banknote bundle with a paper band, one note sliding off
    for i, r in enumerate((0, 8, -6, 14)):  # fanned banknotes: pale green with a white border + portrait oval
        y = 0.004 + i * 0.006
        m.box((0.01 * i, y, -0.006 * i), (0.15, 0.004, 0.07), "paper", rot=(0, r, 0))
        m.box((0.01 * i, y + 0.0025, -0.006 * i), (0.136, 0.002, 0.058), "grass", rot=(0, r, 0))
        m.box((0.01 * i + 0.03, y + 0.004, -0.006 * i), (0.03, 0.002, 0.035), "leaf_dead", rot=(0, r, 0))
    m.box((0.0, 0.016, 0), (0.03, 0.026, 0.074), "cloth_red")  # rubber band


@m2
def wallet(m):  # brown bifold, slightly open, a card peeking out
    m.box((0.055, 0.004, 0), (0.11, 0.008, 0.09), "leather_brown", bevel=0.003)  # open bifold, right half flat
    m.box((-0.05, 0.035, 0), (0.11, 0.008, 0.09), "leather_brown", bevel=0.003, rot=(0, 0, -35))  # left half up
    for i in range(3):  # card slots + cards
        m.box((0.055, 0.0095 + i * 0.0012, -0.025 + i * 0.016), (0.09, 0.002, 0.03), "wood_dark" if i % 2 else "leather_brown")
    m.box((0.06, 0.013, -0.028), (0.075, 0.002, 0.03), "plastic_white")
    m.box((0.035, 0.013, -0.028), (0.02, 0.0025, 0.012), "paint_yellow_faded")  # card chip
    m.box((0.06, 0.012, 0.03), (0.09, 0.004, 0.02), "grass")  # a banknote


@m2
def lunchbox(m):  # tin lunchbox, blue body, faded yellow/red lid art, handle
    m.box((0, 0.08, 0), (0.25, 0.16, 0.1), "paint_blue_faded", bevel=0.01)
    m.box((0, 0.165, 0), (0.25, 0.012, 0.1), "paint_blue_faded", bevel=0.005)
    m.box((0, 0.085, -0.051), (0.18, 0.11, 0.002), "paint_yellow_faded")
    m.box((-0.03, 0.08, -0.053), (0.06, 0.06, 0.002), "paint_red_faded")
    m.box((0.05, 0.1, -0.053), (0.05, 0.03, 0.002), "plastic_white")
    m.box((0, 0.182, 0), (0.1, 0.01, 0.012), "metal_dark", bevel=0.003)
    for x in (-0.05, 0.05):
        m.box((x, 0.175, 0), (0.008, 0.016, 0.01), "metal_dark")
    m.box((0, 0.155, -0.052), (0.03, 0.02, 0.004), "metal_bare")  # latch


@m2
def medical_bag(m):  # red zip bag, white cross, black handles
    m.box((0, 0.11, 0), (0.35, 0.22, 0.2), "cloth_red", bevel=0.04)
    m.box((0, 0.218, 0), (0.3, 0.008, 0.012), "metal_dark")  # zip
    _cross(m, (0, 0.11, -0.101), 0.1, 0.004)
    for z in (-0.06, 0.06):
        m.box((0, 0.25, z), (0.14, 0.012, 0.016), "cloth_black", bevel=0.004)
        for x in (-0.06, 0.06):
            m.box((x, 0.23, z), (0.016, 0.04, 0.016), "cloth_black")


@m2
def ammo_tin(m):  # .50-style olive can, side latch lever, yellow stencil, handle on top
    m.box((0, 0.09, 0), (0.28, 0.18, 0.1), "military_olive", bevel=0.006)
    m.box((0, 0.185, 0), (0.29, 0.016, 0.11), "military_olive", bevel=0.004)  # lid
    m.box((0.15, 0.15, 0), (0.016, 0.07, 0.03), "metal_dark", bevel=0.003)  # latch lever
    m.box((-0.02, 0.1, -0.0505), (0.14, 0.03, 0.002), "paint_yellow_faded")
    m.box((0, 0.2, 0), (0.12, 0.01, 0.014), "metal_dark", bevel=0.003)
    for x in (-0.05, 0.05):
        m.box((x, 0.197, 0), (0.01, 0.012, 0.014), "metal_dark")


def _flat_shirt(m, body, trim, hood=False):
    """Garment shown upright (as if hung up), front toward -Z: torso, sleeves angled down, cuffs, hem band."""
    m.box((0, 0.24, 0), (0.34, 0.42, 0.05), body, bevel=0.015)  # torso
    for s in (-1, 1):
        m.box((s * 0.22, 0.25, 0.005), (0.1, 0.36, 0.045), body, bevel=0.012, rot=(0, 0, s * 22))  # sleeves
        m.box((s * 0.285, 0.085, 0.005), (0.1, 0.05, 0.05), trim, bevel=0.008, rot=(0, 0, s * 22))  # cuffs
    m.box((0, 0.045, 0), (0.34, 0.05, 0.055), trim, bevel=0.01)  # hem band
    if hood:
        m.box((0, 0.48, 0.02), (0.2, 0.16, 0.07), body, bevel=0.03)
        m.box((0, 0.47, -0.016), (0.13, 0.1, 0.004), "cloth_black")  # hood opening


@m2
def hoodie(m):  # grey hoodie: hood, kangaroo pocket, white drawstrings
    _flat_shirt(m, "cloth_grey", "cloth_black", hood=True)
    m.box((0, 0.14, -0.028), (0.2, 0.1, 0.008), "cloth_grey", bevel=0.004)  # pocket
    m.box((0, 0.14, -0.033), (0.16, 0.06, 0.002), "cloth_black")  # pocket shadow
    for x in (-0.035, 0.035):
        m.box((x, 0.36, -0.03), (0.008, 0.1, 0.006), "plastic_white")


@m2
def military_jacket(m):  # olive field jacket: collar, placket, 4 flapped pockets
    _flat_shirt(m, "cloth_olive", "military_olive")
    m.box((0, 0.45, 0.0), (0.22, 0.05, 0.07), "military_olive", bevel=0.01)  # collar
    m.box((0, 0.24, -0.027), (0.02, 0.4, 0.006), "military_olive")  # placket
    for x in (-0.085, 0.085):
        for y in (0.33, 0.14):
            m.box((x, y, -0.029), (0.1, 0.09, 0.008), "military_olive", bevel=0.003)
            m.box((x, y + 0.04, -0.034), (0.102, 0.025, 0.006), "cloth_olive", bevel=0.002)


@m2
def cargo_pants(m):  # tan cargo trousers laid flat, side pockets, belt band
    m.box((0, 0.012, -0.17), (0.3, 0.02, 0.06), "military_tan", bevel=0.006)  # waistband
    m.box((0, 0.012, -0.11), (0.3, 0.02, 0.1), "cloth_khaki", bevel=0.006)  # seat
    for s in (-1, 1):
        m.box((s * 0.085, 0.012, 0.09), (0.13, 0.02, 0.36), "cloth_khaki", bevel=0.006, rot=(0, s * -3, 0))
        m.box((s * 0.1, 0.025, 0.05), (0.08, 0.008, 0.09), "military_tan", bevel=0.003)  # cargo pockets
        m.box((s * 0.09, 0.023, 0.255), (0.12, 0.004, 0.03), "military_tan")  # hems
    for x in (-0.1, -0.03, 0.03, 0.1):
        m.box((x, 0.024, -0.17), (0.012, 0.004, 0.05), "military_olive")  # belt loops


@m2
def tactical_vest(m):  # plate carrier front: 4 mag pouches, admin pouch, shoulder straps
    m.box((0, 0.2, 0), (0.34, 0.4, 0.05), "military_olive", bevel=0.02)  # front plate bag
    for x in (-0.11, 0.11):
        m.box((x, 0.44, 0.0), (0.07, 0.1, 0.04), "military_olive", bevel=0.01)  # shoulder straps
    for i in range(4):
        x = -0.12 + i * 0.08
        m.box((x, 0.07, -0.05), (0.07, 0.12, 0.05), "cloth_olive", bevel=0.008)  # mag pouches
        m.box((x, 0.13, -0.055), (0.072, 0.02, 0.054), "military_olive", bevel=0.004)  # flaps
    m.box((0, 0.24, -0.035), (0.18, 0.12, 0.025), "cloth_olive", bevel=0.006)  # admin pouch
    for y in (0.3, 0.33, 0.36):  # MOLLE rows
        m.box((0, y, -0.027), (0.3, 0.008, 0.006), "cloth_black")
    m.box((0, 0.24, -0.049), (0.06, 0.03, 0.003), "stencil_white")  # name tape


@m2
def beanie(m):  # red knit beanie with a folded cuff
    m.lathe([(0.0, 0.17), (0.04, 0.165), (0.07, 0.14), (0.09, 0.1), (0.095, 0.06), (0.095, 0.03), (0.0, 0.03)],
            "cloth_red", segments=14)
    m.lathe([(0.0, 0.0), (0.1, 0.0), (0.102, 0.045), (0.0, 0.045)], "cloth_red", segments=14)
    for k in range(7):  # knit ribs on the cuff
        a = k * 2 * math.pi / 7
        m.box((0.103 * math.cos(a), 0.022, 0.103 * math.sin(a)), (0.008, 0.04, 0.008), "blood_dry")


@m2
def cap(m):  # baseball cap: blue crown, white front panel, curved brim (-Z)
    m.lathe([(0.0, 0.11), (0.05, 0.105), (0.085, 0.07), (0.098, 0.03), (0.1, 0.0), (0.0, 0.0)], "paint_blue_faded",
            segments=14)
    m.box((0, 0.055, -0.07), (0.1, 0.07, 0.04), "plastic_white", rot=(-35, 0, 0))  # front panel
    m.extrude([(-0.09, 0.0), (0.09, 0.0), (0.07, -0.06), (0.0, -0.085), (-0.07, -0.06)], 0.01, "paint_blue_faded",
              axis="y", center=(0, 0.005, -0.08), rot=(8, 0, 0))
    m.cylinder((0, 0.112, 0), 0.01, 0.008, "paint_blue_faded", segments=8)  # button


@m2
def helmet_military(m):  # olive MICH-style dome, chin strap, NVG plate
    m.lathe([(0.0, 0.18), (0.06, 0.175), (0.1, 0.15), (0.125, 0.1), (0.13, 0.04), (0.128, 0.0), (0.11, 0.0),
             (0.0, 0.0)], "military_olive", segments=16, scale=(0.9, 1, 1.05))
    m.box((0, 0.12, -0.12), (0.06, 0.05, 0.02), "metal_dark", bevel=0.004, rot=(-30, 0, 0))  # NVG mount
    for s in (-1, 1):
        m.box((s * 0.11, 0.04, -0.02), (0.012, 0.05, 0.04), "cloth_black")  # strap
    m.box((0, 0.002, -0.06), (0.16, 0.004, 0.02), "cloth_black")


@m2
def gas_mask(m):  # black rubber face piece, two round eye lenses, olive filter on one side
    m.lathe([(0.0, 0.0), (0.06, 0.005), (0.09, 0.04), (0.1, 0.1), (0.085, 0.16), (0.04, 0.19), (0.0, 0.195)],
            "rubber_black", segments=14, scale=(1, 1, 0.55))
    for x in (-0.042, 0.042):
        m.lathe([(0.0, 0.0), (0.03, 0.0), (0.03, 0.01), (0.0, 0.01)], "glass", center=(x, 0.12, -0.045), segments=10,
                axis="z", rot=(0, 180, 0))
        m.lathe([(0.032, 0.0), (0.034, 0.0), (0.034, 0.012), (0.032, 0.012)], "metal_dark", center=(x, 0.12, -0.045),
                segments=10, axis="z", rot=(0, 180, 0), closed=True)
    m.lathe([(0.0, 0.0), (0.04, 0.0), (0.042, 0.05), (0.035, 0.06), (0.0, 0.06)], "military_olive",
            center=(0.06, 0.045, -0.05), segments=12, axis="x", rot=(0, -30, 0))  # filter
    m.box((0, 0.11, 0.06), (0.2, 0.02, 0.01), "cloth_black")  # head strap


@m2
def glasses(m):  # wire-rim glasses, temples folded open
    for x in (-0.033, 0.033):
        m.lathe([(0.024, -0.002), (0.026, -0.002), (0.026, 0.002), (0.024, 0.002)], "metal_dark",
                center=(x, 0.03, 0), segments=12, axis="z", closed=True)
        m.lathe([(0.0, 0.0), (0.024, 0.0)], "glass", center=(x, 0.03, 0), segments=12, axis="z")
        m.box((x * 2.1, 0.034, 0.06), (0.003, 0.004, 0.12), "metal_dark")  # temples
    m.box((0, 0.042, 0), (0.02, 0.003, 0.003), "metal_dark")  # bridge


@m2
def secure_pouch(m):  # black zipped body pouch with a lock tab
    m.box((0, 0.02, 0), (0.15, 0.04, 0.12), "cloth_black", bevel=0.012)
    m.box((0, 0.041, -0.035), (0.13, 0.004, 0.008), "metal_dark")
    m.box((0.06, 0.044, -0.035), (0.016, 0.006, 0.02), "metal_bare")
    m.box((0, 0.042, 0.02), (0.06, 0.003, 0.03), "military_olive")  # patch
    m.box((-0.08, 0.02, 0.03), (0.012, 0.012, 0.06), "metal_bare")  # belt loop D-ring


# backpacks: showcase (pocket) side at -Z, straps at +Z
def _pack(m, w, h, d, body, trim, pocket=True, sides=True, top=True):
    m.box((0, h / 2, 0), (w, h, d), body, bevel=min(0.045, d / 4))
    if pocket:
        m.box((0, h * 0.3, -d / 2 - 0.02), (w * 0.7, h * 0.35, 0.05), trim, bevel=0.018)
        m.box((0, h * 0.47, -d / 2 - 0.044), (w * 0.6, 0.008, 0.006), "metal_dark")  # zip
    if sides:
        for s in (-1, 1):
            m.box((s * (w / 2 + 0.02), h * 0.3, 0), (0.05, h * 0.35, d * 0.7), trim, bevel=0.015)
    if top:
        m.box((0, h - 0.02, -0.01), (w * 0.95, 0.06, d * 0.9), trim, bevel=0.02)
    for x in (-w * 0.25, w * 0.25):
        m.box((x, h * 0.55, d / 2 + 0.012), (0.05, h * 0.75, 0.02), "cloth_black", bevel=0.005)  # straps
    m.box((0, h + 0.015, d * 0.2), (0.07, 0.025, 0.02), "cloth_black", bevel=0.006)  # grab handle


@m2
def school_bag(m):  # blue kid backpack, red front pocket, yellow keychain
    _pack(m, 0.3, 0.4, 0.14, "paint_blue_faded", "cloth_red", sides=False, top=False)
    m.lathe([(0.0, 0.4), (0.12, 0.38), (0.15, 0.3), (0.15, 0.0)], "paint_blue_faded", segments=12,
            scale=(1, 1, 0.46))  # rounded top
    m.box((0.07, 0.08, -0.115), (0.03, 0.04, 0.012), "paint_yellow_faded", bevel=0.005, rot=(0, 0, 20))  # charm
    m.box((0.06, 0.15, -0.11), (0.004, 0.06, 0.004), "metal_bare")


@m2
def hiking_pack(m):  # orange body, grey bottom + pockets, hip belt
    _pack(m, 0.32, 0.5, 0.2, "fabric_orange", "cloth_grey")
    m.box((0, 0.06, 0), (0.33, 0.12, 0.21), "cloth_grey", bevel=0.03)
    for s in (-1, 1):
        m.box((s * 0.2, 0.1, 0.06), (0.1, 0.06, 0.1), "cloth_black", bevel=0.01)  # hip belt wings
    for y in (0.3, 0.38):
        m.box((0, y, -0.105), (0.26, 0.012, 0.006), "cloth_black")  # compression straps


@m2
def military_pack(m):  # olive assault pack with MOLLE rows
    _pack(m, 0.35, 0.5, 0.25, "military_olive", "cloth_olive", sides=False)
    for k in range(5):
        m.box((0, 0.1 + k * 0.035, -0.172), (0.22, 0.01, 0.006), "cloth_black")
    for s in (-1, 1):
        for k in range(4):
            m.box((s * 0.177, 0.15 + k * 0.06, 0), (0.006, 0.012, 0.2), "cloth_black")


@m2
def alice_pack(m):  # army frame pack: big bag + 2 side pouches + exposed metal frame
    _pack(m, 0.38, 0.48, 0.22, "cloth_olive", "military_olive", sides=False, pocket=False)
    for s in (-1, 1):
        m.box((s * 0.12, 0.18, -0.14), (0.12, 0.17, 0.08), "military_olive", bevel=0.02)  # 2 front pouches
        m.box((s * 0.12, 0.27, -0.15), (0.125, 0.04, 0.085), "cloth_olive", bevel=0.01)
        m.box((s * 0.22, 0.2, -0.02), (0.06, 0.18, 0.12), "military_olive", bevel=0.015)  # side pouches
    for s in (-1, 1):  # frame uprights
        m.box((s * 0.15, 0.29, 0.14), (0.025, 0.66, 0.025), "metal_dark", bevel=0.004)
    for y in (0.02, 0.3, 0.55):
        m.box((0, y, 0.14), (0.32, 0.02, 0.025), "metal_dark", bevel=0.003)
    m.box((0, 0.07, 0.16), (0.3, 0.06, 0.02), "cloth_black")  # kidney pad


@m2
def large_hiking_pack(m):  # tall expedition pack, red lid, grey body, bedroll strapped below
    _pack(m, 0.34, 0.72, 0.24, "cloth_grey", "cloth_red", sides=True)
    m.box((0, 0.72, -0.02), (0.33, 0.1, 0.24), "cloth_red", bevel=0.035)  # extended lid
    m.lathe([(0.0, -0.2), (0.07, -0.2), (0.075, -0.19), (0.075, 0.19), (0.07, 0.2), (0.0, 0.2)], "cloth_khaki",
            center=(0, -0.05, -0.01), segments=12, axis="x")  # bedroll under the pack
    for x in (-0.12, 0.12):
        m.lathe([(0.077, -0.012), (0.077, 0.012)], "cloth_black", center=(x, -0.05, -0.01), segments=12, axis="x")


@m2
def laboratory_pack(m):  # white hard-shell field-lab pack, hazard band, sealed grey lid
    m.box((0, 0.3, 0), (0.42, 0.6, 0.26), "plastic_white", bevel=0.05)
    m.box((0, 0.6, 0), (0.43, 0.06, 0.27), "cloth_grey", bevel=0.02)
    n = 8
    for i in range(n):  # diagonal hazard band
        x = -0.19 + 0.38 * (i + 0.5) / n
        m.box((x, 0.2, -0.132), (0.035, 0.07, 0.004), "hazard_yellow" if i % 2 else "hazard_black", rot=(0, 0, 30))
    m.box((0, 0.2, -0.131), (0.4, 0.075, 0.003), "hazard_black")
    m.box((0, 0.42, -0.133), (0.12, 0.09, 0.004), "cloth_grey", bevel=0.003)  # sample port
    m.cylinder((0, 0.42, -0.137), 0.03, 0.006, "metal_bare", segments=10, axis="z")
    for x in (-0.12, 0.12):
        m.box((x, 0.33, 0.14), (0.05, 0.45, 0.02), "cloth_black", bevel=0.005)


MODELS.update({k: v for k, v in globals().items() if callable(v) and k in FRONT_TO_CAMERA})


def build(item):
    """Fresh scene with the item's visible meshes; returns them."""
    if item in GLB:
        vlib.reset_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.join(WPN, f"{GLB[item]}.glb"))
        for mat in bpy.data.materials:  # the GLB's untextured "palette" would shadow vlib's textured one
            mat.name = "_imported_" + mat.name
        obs = []
        for o in bpy.context.scene.objects:
            n = o.name.split(".")[0]
            if o.type != "MESH" or n.endswith(("_LOD1", "_LOD2")) or "_COL" in n:
                o.hide_render = True
                continue
            o.data.materials.clear()
            o.data.materials.append(vlib._palette_material())
            obs.append(o)
        return obs
    if item not in MODELS:
        print(f"ICON_SKIP {item}: no model or icon builder")
        return []
    m = vlib.Builder(f"icon_{item}", category="icon")
    with m.xform(rot=(0, 180 if item in FRONT_TO_CAMERA else 0, 0)):
        MODELS[item](m)
    m.finish(lods=(), collider=None)
    return [bpy.data.objects[f"icon_{item}_LOD0"]]


# ------------------------------------------------------------------------------- render
def shade():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light, sh.color_type = "STUDIO", "TEXTURE"
    sh.show_cavity, sh.cavity_type = True, "BOTH"
    sh.cavity_ridge_factor, sh.cavity_valley_factor = 1.2, 1.4
    sh.curvature_ridge_factor, sh.curvature_valley_factor = 0.9, 1.2
    sh.show_object_outline, sh.object_outline_color = True, (0.05, 0.05, 0.05)
    sh.show_specular_highlight = True
    sc.display.render_aa = "32"
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = True
    sc.render.resolution_percentage = 100
    sc.render.image_settings.color_mode = "RGBA"
    return sc


def render(item, obs):
    sc = shade()
    side = item in SIDE
    d = Vector((1, 0, 0.09) if side else (0.75, -1.0, 0.85)).normalized()  # from the target toward the camera
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    rot = (-d).to_track_quat("-Z", "Z")
    bpy.context.view_layer.update()
    vs = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
    R = rot.to_matrix()
    loc = [R.transposed() @ v for v in vs]  # camera-aligned coords (x right, y up)
    lo = Vector([min(p[i] for p in loc) for i in range(3)])
    hi = Vector([max(p[i] for p in loc) for i in range(3)])
    ex, ey = hi.x - lo.x, hi.y - lo.y
    c = R @ Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 1.0))
    cam.location, cam.rotation_euler = c, rot.to_euler()
    cam.data.clip_end = (hi.z - lo.z) + 2.0
    span = max(ex, ey) * 1.06
    cam.data.ortho_scale = span
    sc.render.resolution_x = max(16, round(RENDER * ex * 1.06 / span))
    sc.render.resolution_y = max(16, round(RENDER * ey * 1.06 / span))
    tmp = os.path.join(OUT, f"_tmp_{item}.png")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    os.remove(tmp)
    return a.reshape(h, w, 4)


def crop_fit(a, w_cells, h_cells):
    ys, xs = np.nonzero(a[..., 3] > 0.02)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if w_cells != h_cells and (a.shape[1] > a.shape[0]) != (w_cells > h_cells):
        a = np.rot90(a)  # long axis follows the item's grid shape (bottom-up rows: rot90 = clockwise on screen)
    return np.ascontiguousarray(a)


def resize(a, longest):
    h, w = a.shape[:2]
    s = longest / max(w, h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    im = bpy.data.images.new("_r", w, h, alpha=True)
    im.pixels.foreach_set(a.ravel())
    im.scale(nw, nh)
    b = np.empty(nw * nh * 4, dtype=np.float32)
    im.pixels.foreach_get(b)
    bpy.data.images.remove(im)
    return b.reshape(nh, nw, 4)


def halo(a, col=(0.82, 0.83, 0.85), alpha=0.45):
    """1 px light rim under the icon so dark guns still separate from dark inventory tiles."""
    al = a[..., 3]
    d = al.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        d = np.maximum(d, np.roll(np.roll(al, dy, 0), dx, 1))
    rim = np.clip(d - al, 0, 1) * alpha
    out = a.copy()
    out[..., 3] = al + rim
    w = np.where(out[..., 3] > 0, al / np.maximum(out[..., 3], 1e-6), 1)[..., None]
    out[..., :3] = a[..., :3] * w + np.array(col) * (1 - w)
    return out


def save(a, path):
    im = bpy.data.images.new("_s", a.shape[1], a.shape[0], alpha=True)
    im.pixels.foreach_set(np.clip(a, 0, 1).ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def contact_sheet(icons, path):
    """Row per size: 128 px cells, then the same icons at 56 px (inventory scale), on the inventory tile colour."""
    n = len(icons)
    cols = 8
    rows = (n + cols - 1) // cols
    big, small, pad = 136, 64, 4
    H = rows * big + rows * small
    S = np.zeros((H, cols * big, 4), dtype=np.float32)
    S[..., :3], S[..., 3] = (0.16, 0.17, 0.18), 1.0
    for i, (_, a) in enumerate(icons):
        r, c = i // cols, i % cols
        for cell, y0, im in ((big, r * big, a), (small, rows * big + r * small, resize(a, small - 2 * pad))):
            x0 = c * big
            S[H - y0 - cell:H - y0, x0 + 1:x0 + cell - 1, :3] = (0.22, 0.23, 0.25)  # tile (rows are bottom-up)
            h, w = im.shape[:2]
            yy, xx = H - y0 - cell + (cell - h) // 2, x0 + (cell - w) // 2
            al = im[..., 3:4]
            S[yy:yy + h, xx:xx + w, :3] = im[..., :3] * al + S[yy:yy + h, xx:xx + w, :3] * (1 - al)
    save(S, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    only = vlib._args().get("only")
    done = []
    for item, w, h in items():
        if only and item != only:
            continue
        obs = build(item)
        if not obs:
            continue
        a = resize(crop_fit(render(item, obs), w, h), SIZE - 2)
        a = halo(np.pad(a, ((1, 1), (1, 1), (0, 0))))
        save(a, os.path.join(OUT, f"{item}.png"))
        done.append((item, a))
        print(f"ICON {item} {a.shape[1]}x{a.shape[0]}")
    if not only:
        json.dump({"size": SIZE, "ids": [i for i, _ in done]}, open(os.path.join(OUT, "index.json"), "w"), indent=1)
        contact_sheet(done, os.path.join(vlib.ROOT, "assets", "previews", "icons_sheet.png"))


main()
