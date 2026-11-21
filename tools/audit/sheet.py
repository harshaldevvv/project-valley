# python tools/audit/sheet.py <out.png> <cols> <scale> <in1.png> <in2.png> ...   grid contact sheet of same-size images
import sys
from PIL import Image
out, cols, scale, files = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
W, H = ims[0].size
rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (W * cols, H * rows), 'black')
for i, im in enumerate(ims):
    s.paste(im.resize((W, H)), ((i % cols) * W, (i // cols) * H))
s.resize((int(W * cols * scale), int(H * rows * scale))).save(out)
