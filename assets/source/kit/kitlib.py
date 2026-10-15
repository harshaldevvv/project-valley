"""Shared builders for the wood-tier base-building kit (3 m grid). Not an asset (no build.py here).

Snap conventions (all pieces: origin at base centre, front = -Z, +Y up):
- Cell = 3 x 3 m. Foundation top is y = 0.5. Storey = 3.0 m: walls are 3.0 high and sit on the foundation
  top (or a floor top); a floor's TOP is flush with the wall top (floor origin at wallBase + 2.8).
- Walls/doorways/windows are centred ON the cell edge (straddle it, 0.2 thick). Each has a 0.2 x 0.2 post
  centred on both ends (x = +/-1.5), so corners and neighbours share identical posts with no gaps.
- Floor/roof decks stop at x/z = +/-1.4 (the inner wall face) and their rim sits 1 cm below the top, so they
  never z-fight with wall top beams.
"""
WALL_T = 0.2
POST = 0.2
BEAM = 0.2  # sill/top beam height
CORE_T = 0.1
BOARD_T = 0.03
ROW = 0.26
FRAME = "wood_dark"
BOARD = "wood_raw"
CORE = "wood_dark"
BEV = 0.03  # chamfer on posts and beams (big pieces)


def _boards(m, x0, x1, y0, y1, y_base, lod):
    """Fill a rectangle on both faces with horizontal boards on a global row grid (seams line up)."""
    if x1 - x0 < 0.02 or y1 - y0 < 0.02:
        return
    m.box(((x0 + x1) / 2, (y0 + y1) / 2, 0), (x1 - x0, y1 - y0, CORE_T), CORE)
    if lod == 2:
        return
    for zs in (-1, 1):
        z = zs * (CORE_T / 2 + BOARD_T / 2)
        if lod == 1:
            m.box(((x0 + x1) / 2, (y0 + y1) / 2, z), (x1 - x0, y1 - y0, BOARD_T), BOARD)
            continue
        k = 0
        while y_base + k * ROW < y1 - 1e-6:
            a, b = max(y_base + k * ROW, y0), min(y_base + (k + 1) * ROW, y1)
            if b - a > 0.03:
                gap = 0.012 if b == y_base + (k + 1) * ROW and b < y1 - 1e-6 else 0.0
                m.box(((x0 + x1) / 2, (a + b - gap) / 2, z), (x1 - x0, b - a - gap, BOARD_T), BOARD)
            k += 1


def wall(m, H=3.0, opening=None, sill_board=False, lod=0):
    """Framed plank wall 3 m wide (posts make it 3.2 overall), height H, optional opening (x0, x1, y0, y1).
    Returns the compound collider boxes [(center, size)] for the solid parts."""
    bev = BEV if lod == 0 else 0.0
    xin = 1.5 - POST / 2  # inner face of the end posts
    y0b, y1b = BEAM, H - BEAM
    for x in (-1.5, 1.5):
        m.box((x, H / 2, 0), (POST, H, WALL_T), FRAME, bevel=bev)
    m.box((0, H - BEAM / 2, 0), (2 * xin, BEAM, WALL_T - 0.02), FRAME, bevel=bev if lod == 0 else 0)
    if opening is None:
        m.box((0, BEAM / 2, 0), (2 * xin, BEAM, WALL_T - 0.02), FRAME, bevel=bev)
        _boards(m, -xin, xin, y0b, y1b, y0b, lod)
        return [((0, H / 2, 0), (3.2, H, WALL_T))]
    ox0, ox1, oy0, oy1 = opening
    J = 0.1  # jamb / header / sill trim width
    tx0, tx1 = ox0 - J, ox1 + J
    # sill beam: split around a door, full under a window
    if oy0 <= 0.01:
        for a, b in ((-xin, tx0), (tx1, xin)):
            m.box(((a + b) / 2, BEAM / 2, 0), (b - a, BEAM, WALL_T - 0.02), FRAME, bevel=bev)
    else:
        m.box((0, BEAM / 2, 0), (2 * xin, BEAM, WALL_T - 0.02), FRAME, bevel=bev)
    # trim around the opening
    for x in (ox0 - J / 2, ox1 + J / 2):
        m.box((x, (oy0 + oy1 + J) / 2, 0), (J, oy1 + J - oy0, WALL_T - 0.01), FRAME, bevel=bev / 2)
    m.box(((ox0 + ox1) / 2, oy1 + J / 2, 0), (tx1 - tx0, J, WALL_T - 0.01), FRAME, bevel=bev / 2)  # header
    if oy0 > 0.01:
        m.box(((ox0 + ox1) / 2, oy0 - J / 2, 0), (tx1 - tx0, J, WALL_T - 0.01), FRAME, bevel=bev / 2)
        if sill_board:
            m.box(((ox0 + ox1) / 2, oy0 - 0.02, 0), (tx1 - tx0 + 0.1, 0.04, WALL_T + 0.08), FRAME,
                  bevel=0.01 if lod == 0 else 0)
    # boards: left, right, below, above
    _boards(m, -xin, tx0, y0b, y1b, y0b, lod)
    _boards(m, tx1, xin, y0b, y1b, y0b, lod)
    if oy0 > 0.01:
        _boards(m, tx0, tx1, y0b, oy0 - J, y0b, lod)
    _boards(m, tx0, tx1, oy1 + J, y1b, y0b, lod)
    cols = [(((-1.6 + ox0) / 2, H / 2, 0), (ox0 + 1.6, H, WALL_T)),
            (((ox1 + 1.6) / 2, H / 2, 0), (1.6 - ox1, H, WALL_T)),
            (((ox0 + ox1) / 2, (oy1 + H) / 2, 0), (ox1 - ox0, H - oy1, WALL_T))]
    if oy0 > 0.01:
        cols.append((((ox0 + ox1) / 2, oy0 / 2, 0), (ox1 - ox0, oy0, WALL_T)))
    return cols


def deck(m, y_top, thick, board_sw, lod, extent=1.4, along="x"):
    """Plank deck: boards along `along`, top at y_top, covering +/-extent, laid over a solid underlay."""
    m.box((0, y_top - thick / 2 - 0.01, 0), (2 * extent, thick - 0.02, 2 * extent), CORE)
    if lod == 2:
        m.box((0, y_top - 0.02, 0), (2 * extent, 0.04, 2 * extent), board_sw)
        return
    if lod == 1:
        m.box((0, y_top - 0.02, 0), (2 * extent, 0.04, 2 * extent), board_sw)
        return
    n = 9
    w = 2 * extent / n
    for i in range(n):
        c = -extent + w * (i + 0.5)
        size = (2 * extent, 0.04, w - 0.012) if along == "x" else (w - 0.012, 0.04, 2 * extent)
        pos = (0, y_top - 0.02, c) if along == "x" else (c, y_top - 0.02, 0)
        m.box(pos, size, board_sw)
