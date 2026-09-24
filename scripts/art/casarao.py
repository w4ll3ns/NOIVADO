"""
Gera a arte do casarão usada no site a partir do desenho original (art/casarao-original.webp).

    python3 scripts/art/casarao.py

Saídas em public/brand/:
  casarao.avif / casarao.webp       traço sépia com fundo transparente (encaixa no papel do site)
  casarao-640.avif / .webp          o mesmo, menor (celulares e usos secundários)
  casarao-forte-640.avif / .webp    traço reforçado para tamanhos pequenos (rodapé, cartões de QR)
  casarao-tempo.webp                mapa de tempo da animação: quando cada ponto do traço aparece
e em src/components/casarao/casarao-data.ts os recortes das janelas e do portão (para as luzes).

Dependências (só para gerar; o site não usa Python): numpy, scipy, scikit-image, pillow.
"""
import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.draw import polygon as skpoly
from skimage.measure import approximate_polygon, find_contours
import heapq

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'casarao-original.webp')
OUT = os.path.join(ROOT, 'public', 'brand')
DATA_TS = os.path.join(ROOT, 'src', 'components', 'casarao', 'casarao-data.ts')

BG = np.array([254.0, 252.0, 251.0])  # papel do desenho original
INK = np.array([72.0, 56.0, 45.0])     # tinta sépia escura (média dos traços mais fortes)
MARGIN = 14


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def load():
    rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
    L = luminance(rgb)
    # Tinta única + transparência: sobre o papel original reproduz a luminância de cada pixel
    # (e comprime bem melhor que guardar a cor pixel a pixel).
    l_bg, l_ink = luminance(BG) - 2.5, luminance(INK)
    alpha = np.clip((l_bg - L) / (l_bg - l_ink), 0.0, 1.0)
    alpha[alpha < 0.05] = 0.0   # ruído do papel
    color = np.broadcast_to(INK, rgb.shape)
    return rgb, L, alpha, color


def crop_box(alpha):
    ys, xs = np.where(alpha > 0.12)
    x0, x1 = max(xs.min() - MARGIN, 0), min(xs.max() + MARGIN + 1, alpha.shape[1])
    y0, y1 = max(ys.min() - MARGIN, 0), min(ys.max() + MARGIN + 1, alpha.shape[0])
    return int(x0), int(y0), int(x1), int(y1)


def save_rgba(color, alpha, name, width=None):
    """Grava name.avif (menor) e name.webp (navegadores sem AVIF)."""
    rgba = np.dstack([color, alpha * 255.0]).round().astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    if width and width < im.width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.avif'), 'AVIF', quality=60, speed=2)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=80, alpha_quality=70, method=6)
    return im.size



def geodesic(ink, seeds_cost, ratio):
    """Dijkstra multi-fonte sobre os pixels de tinta. seeds_cost: array com custo inicial (inf = não é semente)."""
    H, W = ink.shape
    dist = np.full(H*W, np.inf)
    inkf = ink.ravel()
    sc = seeds_cost.ravel()
    idx = np.flatnonzero(np.isfinite(sc) & inkf)
    dist[idx] = sc[idx]
    heap = list(zip(sc[idx].tolist(), idx.tolist()))
    heapq.heapify(heap)
    s2 = 2 ** 0.5
    nb = [(-1,-1,s2),(-1,0,1),(-1,1,s2),(0,-1,1),(0,1,1),(1,-1,s2),(1,0,1),(1,1,s2)]
    while heap:
        d, i = heapq.heappop(heap)
        if d > dist[i]: continue
        y, x = divmod(i, W)
        for dy, dx, w in nb:
            yy, xx = y+dy, x+dx
            if 0 <= yy < H and 0 <= xx < W:
                j = yy*W+xx
                if inkf[j]:
                    nd = d + w/ratio
                    if nd < dist[j]:
                        dist[j] = nd
                        heapq.heappush(heap, (nd, j))
    return dist.reshape(H, W)


def arch(cx, cy, rx, ry, bl, br, n=24):
    """Janela em arco: lados verticais até bl/br (pontos de baixo), arco elíptico no topo."""
    pts = [bl]
    for k in range(n + 1):
        th = math.pi - math.pi * k / n
        pts.append((cx + rx * math.cos(th), cy - ry * math.sin(th)))
    pts.append(br)
    return pts

REGIONS = {
    # térreo, da porta para fora; depois o andar de cima
    'porta': arch(668, 680, 48.5, 77, (617, 1150), (717, 1150)),
    'g3': arch(488.5, 705, 33.5, 65, (451, 902), (519, 902)),
    'g2': arch(357.5, 737, 23, 52, (327, 902), (376, 902)),
    'g1': arch(242, 757, 17, 45, (217, 905), (254, 905)),
    's1': [(872, 810), (912, 815), (914, 930), (875, 930)],
    's2': [(955, 850), (958, 838), (965, 833), (972, 838), (975, 850), (976, 942), (956, 942)],
    'u4': [(642, 315), (717, 297), (717, 409), (643, 427)],
    'u3': [(484, 393), (549, 381), (550, 451), (484, 463)],
    'u2': [(377, 440), (408, 434), (408, 523), (376, 528)],
    'u1': [(279, 490), (307, 484), (306, 586), (273, 592)],
}

def poly_mask(shape, pts):
    m = np.zeros(shape, bool)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    rr, cc = skpoly(ys, xs, shape)
    m[rr, cc] = True
    return m

def cells(alpha, pm, thr, dil, minfrac):
    ink = ndi.binary_dilation(alpha > thr, iterations=dil)
    lab, n = ndi.label(~ink)
    area = np.bincount(lab.ravel(), minlength=n + 1).astype(float)
    inside = np.bincount(lab[pm].ravel(), minlength=n + 1)
    keep = (inside / np.maximum(area, 1) >= minfrac) & (area >= 2)
    keep[0] = False
    return keep[lab]

def region_masks(alpha):
    out = {}
    for name, pts in REGIONS.items():
        pm = poly_mask(alpha.shape, pts)
        # finas (grades do portão) + robustas (vidraças com falhas no traço)
        m = cells(alpha, pm, 0.3, 1, 0.9) | cells(alpha, pm, 0.2, 2, 0.85)
        if name == 'porta':
            m |= ndi.binary_erosion(pm, iterations=4)   # a luz vem de dentro: o vão inteiro
        m = ndi.binary_closing(ndi.binary_dilation(m, iterations=3), iterations=4)
        m = ndi.binary_fill_holes(m)
        m &= ndi.binary_dilation(pm, iterations=2)
        out[name] = m
    return out


DOOR_ORIGIN = (668, 880)   # (x, y) no original: o desenho nasce no portão
PEN_RATIO = 3.0            # a tinta corre pelas linhas 3x mais rápido que a "onda" que sai do portão


def time_map(alpha):
    ink = alpha > 0.12
    H, W = ink.shape
    yy, xx = np.mgrid[0:H, 0:W]
    E = np.hypot(yy - DOOR_ORIGIN[1], xx - DOOR_ORIGIN[0])
    T = geodesic(ink, np.where(ink, E, np.inf), ratio=PEN_RATIO)
    tmax = np.percentile(T[ink], 99.5)
    t = np.clip(T / tmax, 0, 1)
    # fora do traço: repete o tempo do traço mais próximo (reduções suaves no navegador)
    _, (iy, ix) = ndi.distance_transform_edt(~ink, return_indices=True)
    return t[iy, ix]


def region_paths(masks, box):
    x0, y0 = box[0], box[1]
    out = []
    for name, m in masks.items():
        sub = np.pad(m[box[1]:box[3], box[0]:box[2]], 1)
        d = []
        for c in find_contours(sub.astype(float), 0.5):
            c = approximate_polygon(c, tolerance=0.9)
            if len(c) < 3:
                continue
            pts = ' '.join(f'{x - 1:.1f} {y - 1:.1f}' for y, x in c)
            d.append('M' + pts + 'Z')
        ys, xs = np.nonzero(m)
        out.append({
            'id': name,
            'd': ''.join(d),
            'cx': round(float(xs.mean()) - x0, 1), 'cy': round(float(ys.mean()) - y0, 1),
            'box': [int(xs.min() - x0), int(ys.min() - y0), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
        })
    return out


if __name__ == '__main__':
    rgb, L, alpha, color = load()
    box = crop_box(alpha)
    x0, y0, x1, y1 = box
    a, c = alpha[y0:y1, x0:x1], color[y0:y1, x0:x1]
    W, H = x1 - x0, y1 - y0
    print('arte', save_rgba(c, a, 'casarao'))
    print('arte 640', save_rgba(c, a, 'casarao-640', width=640))
    # versão de traço reforçado para tamanhos pequenos (rodapé, cartões de QR)
    strong = np.clip(ndi.grey_dilation(a, size=(3, 3)) * 0.55 + a * 0.6, 0, 1)
    print('arte forte 640', save_rgba(c, strong, 'casarao-forte-640', width=640))

    t = time_map(alpha)[y0:y1, x0:x1]
    Image.fromarray(np.round(t * 255).astype(np.uint8), 'L').save(
        os.path.join(OUT, 'casarao-tempo.webp'), 'WEBP', quality=90, method=6)

    masks = region_masks(alpha)
    data = {
        'width': W, 'height': H,
        'origin': [DOOR_ORIGIN[0] - x0, DOOR_ORIGIN[1] - y0],
        'regions': region_paths(masks, box),
    }
    with open(DATA_TS, 'w') as fh:
        fh.write('// Gerado por scripts/art/casarao.py — não edite à mão.\n')
        fh.write('// Coordenadas no espaço da arte (public/brand/casarao.*): janelas e portão, na ordem em que acendem.\n')
        fh.write('export const CASARAO = ' + json.dumps(data, indent=2, ensure_ascii=False) + ' as const\n')
    print('dados', os.path.relpath(DATA_TS, ROOT), os.path.getsize(DATA_TS) // 1024, 'KB')
    for f in sorted(os.listdir(OUT)):
        if not f.startswith('casarao'):
            continue
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
