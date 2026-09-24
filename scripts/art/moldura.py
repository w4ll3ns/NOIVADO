"""
Extrai a moldura do Save the Date (public/brand/save-the-date.jpg) para o site.

    python3 scripts/art/moldura.py

O miolo (textos e casarão) é apagado; o traço vira sépia com fundo transparente e é ampliado
2x com as bordas redesenhadas (o original tem só 882 x 1280 px). Saídas em public/brand/:

  moldura.avif / .webp          a moldura inteira (dossel com querubins, cortinas, volutas, arremate)
  filete-arabesco.avif / .webp  o filete com arabesco sob "SAVE THE DATE"
  filete-losango.avif / .webp   o filete com losango sob a data
  canto.avif / .webp            o canto inferior esquerdo (voluta + arremate), para cantos de cartões
  coroa.avif / .webp            o topo do dossel (urna com folhagem e cúpula), usado como brasão

Dependências (só para gerar): numpy, scipy, pillow.
"""
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'public', 'brand', 'save-the-date.jpg')
OUT = os.path.join(ROOT, 'public', 'brand')

PAPER = np.array([247.0, 237.0, 227.0])
INK = np.array([104.0, 86.0, 68.0])
SCALE = 2

# Miolo a apagar (coordenadas do original): textos, filetes e casarão. Entre as cortinas o
# vão é mais estreito; abaixo delas vai até as volutas laterais.
MIOLO = [(252, 385), (638, 385), (638, 600), (690, 600), (690, 1072), (205, 1072), (205, 600), (252, 600)]

# Peças soltas (caixas no original), quanto ampliar e onde esmaecer as pontas cortadas.
FILETES = {
    'filete-arabesco': ((322, 474, 582, 500), 4),
    'filete-losango': ((356, 1011, 544, 1032), 4),
}
PECAS = {  # recortadas depois de apagar o miolo
    'canto': ((104, 1036, 340, 1214), 3, {'direita': 70, 'topo': 34}),
    'coroa': ((376, 36, 510, 152), 4, {'base': 10}),
}


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def alpha_of(rgb):
    l_bg, l_ink = luminance(PAPER) - 4.0, luminance(INK)
    a = np.clip((l_bg - luminance(rgb)) / (l_bg - l_ink), 0.0, 1.0)
    a[a < 0.06] = 0.0
    return a


def ampliar(a, scale=SCALE):
    """Amplia o traço e redesenha as bordas: interpolação bicúbica + curva de contraste
    no canal alfa (tira o borrão do JPEG e deixa a linha nítida sem mudar a espessura)."""
    im = Image.fromarray((a * 255).astype(np.uint8), 'L')
    big = np.asarray(im.resize((im.width * scale, im.height * scale), Image.BICUBIC)).astype(float) / 255
    t = np.clip((big - 0.1) / (0.78 - 0.1), 0, 1)
    return t * t * (3 - 2 * t)


def esmaecer(a, bordas):
    """Some suavemente com o traço nas bordas em que a peça foi cortada (px do original)."""
    h, w = a.shape
    out = a.copy()
    for lado, n in bordas.items():
        ramp = np.clip(np.arange(n) / n, 0, 1) ** 1.5
        if lado == 'direita':
            out[:, w - n:] *= ramp[::-1][None, :]
        elif lado == 'topo':
            out[:n, :] *= ramp[:, None]
        elif lado == 'base':
            out[h - n:, :] *= ramp[::-1][:, None]
    return out


def salvar(a, name, color=INK):
    rgba = np.dstack([np.broadcast_to(color, a.shape + (3,)), a * 255]).round().astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    im.save(os.path.join(OUT, name + '.avif'), 'AVIF', quality=62, speed=2)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82, alpha_quality=75, method=6)
    return im.size


if __name__ == '__main__':
    rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    a = alpha_of(rgb)

    for name, ((x0, y0, x1, y1), scale) in FILETES.items():
        print(name, salvar(ampliar(a[y0:y1, x0:x1], scale), name))

    mask = Image.new('L', (rgb.shape[1], rgb.shape[0]), 0)
    ImageDraw.Draw(mask).polygon(MIOLO, fill=255)
    a[np.asarray(mask) > 0] = 0.0
    # restos soltos (pontinhos de compressão) somem
    lab, n = ndi.label(a > 0.2, structure=np.ones((3, 3)))
    sizes = ndi.sum(np.ones_like(a), lab, range(1, n + 1))
    small = np.isin(lab, np.flatnonzero(sizes < 6) + 1)
    a[small] = 0.0
    print('moldura', salvar(ampliar(a), 'moldura'))
    for name, ((x0, y0, x1, y1), scale, bordas) in PECAS.items():
        print(name, salvar(ampliar(esmaecer(a[y0:y1, x0:x1], bordas), scale), name))
    for f in sorted(os.listdir(OUT)):
        if f.startswith(('moldura', 'filete', 'canto', 'coroa')):
            print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
