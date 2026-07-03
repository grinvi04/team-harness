#!/usr/bin/env python3
"""
Architecture diagram generator — dark theme SVG.
Usage: Copy this file to your project's docs/gen_arch_svg.py,
       implement the diagram functions at the bottom, then run:
       python3 docs/gen_arch_svg.py
Standards: team-harness/docs/architecture-diagram-standards.md
"""

# ─── Constants ───────────────────────────────────────────────────────────────
BG   = '#0f172a'   # background
AREA = '#1e293b'   # content area
BW, BH, BR = 130, 80, 10  # box width, height, border-radius

# ─── Semantic color palette ───────────────────────────────────────────────────
C = {  # s=stroke, f=fill, t=text
    'client':   {'s': '#94a3b8', 'f': '#1e293b', 't': '#e2e8f0'},
    'fe':       {'s': '#60a5fa', 'f': '#1e3a8a', 't': '#bfdbfe'},
    'proxy':    {'s': '#38bdf8', 'f': '#0c4a6e', 't': '#bae6fd'},
    'api':      {'s': '#4ade80', 'f': '#14532d', 't': '#bbf7d0'},
    'queue':    {'s': '#fb923c', 'f': '#7c2d12', 't': '#fed7aa'},
    'db':       {'s': '#34d399', 'f': '#065f46', 't': '#a7f3d0'},
    'dlq':      {'s': '#f87171', 'f': '#7f1d1d', 't': '#fecaca'},
    'auth':     {'s': '#c084fc', 'f': '#4a044e', 't': '#e9d5ff'},
    'edge':     {'s': '#818cf8', 'f': '#312e81', 't': '#c7d2fe'},
    'monitor':  {'s': '#818cf8', 'f': '#312e81', 't': '#c7d2fe'},
    'storage':  {'s': '#2dd4bf', 'f': '#134e4a', 't': '#99f6e4'},
    'external': {'s': '#fbbf24', 'f': '#78350f', 't': '#fde68a'},
    'ci':       {'s': '#a78bfa', 'f': '#3b0764', 't': '#ddd6fe'},
}

# ─── Arrow markers ────────────────────────────────────────────────────────────
ARROW = '''<defs>
  <marker id="arr" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
    <polygon points="0 0,9 3.5,0 7" fill="#94a3b8"/>
  </marker>
  <marker id="arr-dash" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
    <polygon points="0 0,9 3.5,0 7" fill="#64748b"/>
  </marker>
</defs>'''


# ─── Primitives ───────────────────────────────────────────────────────────────

def box(cx, cy, ctype, title, sub):
    """Render a labeled box centered at (cx, cy)."""
    clr = C[ctype]
    x, y = cx - BW // 2, cy - BH // 2
    return (
        f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="{BR}" '
        f'fill="{clr["f"]}" stroke="{clr["s"]}" stroke-width="2.5"/>'
        f'<text x="{cx}" y="{cy-8}" text-anchor="middle" '
        f'font-family="\'Segoe UI\',system-ui,sans-serif" font-size="14" '
        f'font-weight="700" fill="#f1f5f9">{title}</text>'
        f'<text x="{cx}" y="{cy+14}" text-anchor="middle" '
        f'font-family="\'Segoe UI\',system-ui,sans-serif" font-size="11" '
        f'fill="{clr["t"]}" opacity="0.9">{sub}</text>'
    )


def lbl(lx, ly, text):
    """Render a dark-background label at (lx, ly).
    ly is the text baseline; the bg rect spans ly-13 to ly+4.
    Width: 14px per CJK char, 8px per ASCII, +14 padding.
    """
    w = sum(14 if ord(c) > 127 else 8 for c in text) + 14
    return (
        f'<rect x="{lx-w//2}" y="{ly-13}" width="{w}" height="17" rx="3" '
        f'fill="#0f172a" opacity="0.92"/>'
        f'<text x="{lx}" y="{ly}" text-anchor="middle" '
        f'font-family="\'Segoe UI\',system-ui,sans-serif" '
        f'font-size="11" font-weight="600" fill="#e2e8f0">{text}</text>'
    )


def line(x1, y1, x2, y2, text='', dash=False, lx=None, ly=None):
    """Straight arrow from (x1,y1) to (x2,y2).
    text: edge label. lx/ly: manual label position override.
    dash: dashed line for async/optional/deploy flows.
    """
    stroke  = '#64748b' if dash else '#94a3b8'
    sw      = '1.5' if dash else '2'
    d       = 'stroke-dasharray="6 3"' if dash else ''
    marker  = 'url(#arr-dash)' if dash else 'url(#arr)'
    _lx     = lx if lx is not None else (x1 + x2) // 2
    _ly     = (ly if ly is not None else (y1 + y2) // 2) - 7
    label_svg = lbl(_lx, _ly, text) if text else ''
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="{stroke}" stroke-width="{sw}" {d} marker-end="{marker}"/>'
        + label_svg
    )


def curve(x1, y1, cx1, cy1, cx2, cy2, x2, y2,
          text='', lx=None, ly=None, dash=False):
    """Cubic bezier arrow. Use for bypass paths that would cross boxes."""
    stroke = '#64748b' if dash else '#94a3b8'
    sw     = '1.5' if dash else '2'
    d      = 'stroke-dasharray="6 3"' if dash else ''
    marker = 'url(#arr-dash)' if dash else 'url(#arr)'
    _lx    = lx if lx is not None else (x1 + x2) // 2
    _ly    = (ly if ly is not None else (cy1 + cy2) // 2) - 7
    label_svg = lbl(_lx, _ly, text) if text else ''
    return (
        f'<path d="M{x1},{y1} C{cx1},{cy1} {cx2},{cy2} {x2},{y2}" '
        f'fill="none" stroke="{stroke}" stroke-width="{sw}" {d} '
        f'marker-end="{marker}"/>'
        + label_svg
    )


# ─── Edge helpers: box boundary shortcuts ────────────────────────────────────
def r(cx, cy): return cx + BW // 2, cy   # right edge center
def l(cx, cy): return cx - BW // 2, cy   # left edge center
def t(cx, cy): return cx, cy - BH // 2   # top edge center
def b(cx, cy): return cx, cy + BH // 2   # bottom edge center


# ─── Legend ──────────────────────────────────────────────────────────────────

def legend(items, y, W):
    """Horizontal legend row. items: list of (ctype, label) tuples."""
    n     = len(items)
    total = sum(len(lbl_text) * 8 + 60 for _, lbl_text in items)
    x     = (W - total) // 2
    parts = []
    for ctype, lbl_text in items:
        clr = C[ctype]
        parts.append(
            f'<rect x="{x}" y="{y-10}" width="14" height="14" rx="3" '
            f'fill="{clr["f"]}" stroke="{clr["s"]}" stroke-width="1.5"/>'
            f'<text x="{x+20}" y="{y+2}" '
            f'font-family="\'Segoe UI\',system-ui,sans-serif" '
            f'font-size="11" fill="#94a3b8">{lbl_text}</text>'
        )
        x += len(lbl_text) * 8 + 60
    return ''.join(parts)


# ─── SVG wrapper ─────────────────────────────────────────────────────────────

def wrap(W, H, title, subtitle, body, leg):
    """Full SVG document. body: box+edge SVG. leg: legend SVG."""
    cx = W - 28  # content area right edge
    cy = H - 28  # content area bottom edge
    return f'''<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
{ARROW}
<rect width="{W}" height="{H}" fill="{BG}"/>
<text x="48" y="42" font-family="'Segoe UI',system-ui,sans-serif" font-size="20" font-weight="700" fill="#f1f5f9">{title}</text>
<text x="48" y="62" font-family="'Segoe UI',system-ui,sans-serif" font-size="12" fill="#64748b">{subtitle}</text>
<rect x="28" y="72" width="{cx-28}" height="{cy-72}" rx="12" fill="{AREA}" opacity="0.6"/>
{body}
{leg}
</svg>'''


# ─── Label collision checker ──────────────────────────────────────────────────

def check_labels(diagram_name, boxes, labels):
    """Verify that no label rect overlaps any box rect.
    boxes:  [(cx, cy, name), ...]
    labels: [(lx, ly, text), ...]  — ly is text baseline
    Returns True if no overlaps found.
    """
    ok = True
    for lx, ly, text in labels:
        w  = sum(14 if ord(c) > 127 else 8 for c in text) + 14
        lx1, ly1 = lx - w // 2, ly - 13
        lx2, ly2 = lx + w // 2, ly + 4
        for cx, cy, name in boxes:
            bx1, by1 = cx - BW // 2, cy - BH // 2
            bx2, by2 = cx + BW // 2, cy + BH // 2
            if lx1 < bx2 and lx2 > bx1 and ly1 < by2 and ly2 > by1:
                print(f'  OVERLAP [{diagram_name}] label "{text}" ↔ box "{name}"')
                ok = False
    if ok:
        print(f'  OK [{diagram_name}] no label overlaps')
    return ok


# ─── Project-specific diagram functions ──────────────────────────────────────
# Copy this file to your project's docs/gen_arch_svg.py, then replace the
# example below with your own diagram(s).

def gen_example(out_path='docs/architecture.svg'):
    """Example: 3-node linear pipeline → docs/architecture.svg"""
    W, H = 1030, 330

    # Node centers: spacing = 270px, main row y = H/2 = 165
    N = {
        'client': (115, 165),
        'api':    (385, 165),
        'db':     (655, 165),
    }

    boxes_list = [(cx, cy, name) for name, (cx, cy) in N.items()]

    nodes_svg = (
        box(*N['client'], 'client', 'Browser',  'HTTP')
        + box(*N['api'],  'api',    'API',       '/v1/*')
        + box(*N['db'],   'db',     'Postgres',  'primary')
    )

    # Edges: right-edge → left-edge straight lines
    e1 = line(*r(*N['client']), *l(*N['api']), 'REST')
    e2 = line(*r(*N['api']),    *l(*N['db']),  'SQL')
    edges_svg = e1 + e2

    # Labels for collision check: (lx, ly, text)
    label_pairs = [
        ((N['client'][0] + N['api'][0]) // 2, (N['client'][1] + N['api'][1]) // 2 - 7, 'REST'),
        ((N['api'][0]    + N['db'][0])  // 2, (N['api'][1]    + N['db'][1])  // 2 - 7, 'SQL'),
    ]
    check_labels('example', boxes_list, label_pairs)

    leg = legend([('client', 'Browser'), ('api', 'API'), ('db', 'DB')], H - 30, W)
    svg = wrap(W, H, 'My Project — Architecture', 'Example 3-node pipeline', nodes_svg + edges_svg, leg)

    with open(out_path, 'w') as f:
        f.write(svg)
    print(f'Written: {out_path}')


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    gen_example()
    # Add more diagram calls here, e.g.:
    # gen_gitflow('docs/architecture-gitflow.svg')
