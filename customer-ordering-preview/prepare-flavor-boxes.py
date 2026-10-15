"""Compose Shells boxes from the supplied product and original carton photos.

Deterministic presentation mockups, not photographs of newly packed boxes.
Run after prepare-product-images.py. Requires Pillow, NumPy, and OpenCV.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets' / 'flavor-boxes'
OUT.mkdir(exist_ok=True)
product = {'id':'shells','name':'Shells'}

def compose(product, count):
    # Reuse the photographed outer carton, rim, folds and camera angle exactly.
    box = Image.open(ROOT / 'assets' / 'products' / f'assorted-rings-{count}.png').convert('RGBA')
    quad = np.float32([(110,128),(450,153),(447,371),(67,323)] if count == 6 else [(113,102),(451,136),(443,400),(64,351)])
    cols, rows = (3,2) if count == 6 else (4,3)
    width,height = cols*320,rows*300
    # Carton floor: warm white, with the same gentle lighting as the box photo.
    gradient = np.linspace(225,250,height)[:,None,None]
    floor = np.tile(gradient,(1,width,3))
    floor[:,:,1] -= 9
    floor[:,:,2] -= 20
    floor = Image.fromarray(floor.astype('uint8')).convert('RGBA')
    # Bavarian Breeze shows the closest supplied unglazed filled-shell exterior.
    donut = Image.open(ROOT / 'assets' / 'products' / 'bavarian-breeze.png').convert('RGBA')
    donut = donut.crop(donut.getbbox())
    donut.thumbnail((350,340) if count == 6 else (306,282),Image.Resampling.LANCZOS)
    if count == 6:
        # Fill the original carton interior edge to edge. Neighboring shells
        # overlap slightly, as they would when six are packed in two rows.
        positions = [
            (round(col*(width-donut.width)/(cols-1)), round(row*(height-donut.height)/(rows-1)))
            for row in range(rows) for col in range(cols)
        ]
    else:
        positions = [
            (col*320+(320-donut.width)//2, row*300+(300-donut.height)//2)
            for row in range(rows) for col in range(cols)
        ]
    def add_shadow(x,y):
        # A small complete contact shadow lives inside the carton floor.
        shadow = Image.new('RGBA',floor.size,(0,0,0,0))
        shade = Image.new('L',floor.size,0)
        shade.paste(donut.getchannel('A'),(x+2,y+6))
        shade = shade.filter(ImageFilter.GaussianBlur(5)).point(lambda value:round(value*.18))
        shadow.putalpha(shade)
        floor.alpha_composite(shadow)
    if count == 6:
        for x,y in positions: add_shadow(x,y)
        for x,y in positions: floor.alpha_composite(donut,(x,y))
    else:
        for x,y in positions:
            add_shadow(x,y)
            floor.alpha_composite(donut,(x,y))
    transform=cv2.getPerspectiveTransform(np.float32([(0,0),(width-1,0),(width-1,height-1),(0,height-1)]),quad)
    packed=cv2.warpPerspective(np.asarray(floor),transform,(512,512),flags=cv2.INTER_CUBIC)
    box.alpha_composite(Image.fromarray(packed))
    # Interior quadrilateral stops behind the original photographed front rim.
    filename = 'shells-6-packed.png' if count == 6 else 'shells-12.png'
    box.save(OUT/filename)

for count in (6,12): compose(product,count)
sheet=Image.new('RGB',(600,330),'#fffaf4')
draw=ImageDraw.Draw(sheet)
for offset,count in enumerate((6,12)):
    filename = 'shells-6-packed.png' if count == 6 else 'shells-12.png'
    photo=Image.open(OUT/filename)
    photo.thumbnail((290,280))
    sheet.paste(photo,(offset*300,0),photo)
    draw.text((offset*300+12,283),f"Shells | {count} pcs",fill='#751a1f')
sheet.save(OUT/'review-shells.jpg')
print('Prepared Shells 6- and 12-piece presentations.')
