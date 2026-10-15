"""Extract original menu photographs, without generating or repainting products."""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets' / 'products'
OUT.mkdir(exist_ok=True)
SHEET = ROOT / 'assets' / 'individual-price-list.png'
# Photo-only boundaries on the 1888 x 1334 reference. Printed captions are excluded.
REGIONS = {
 'double-choco':(110,113,278,275), 'nuts-kisses':(296,113,463,274),
 'choco-almonds':(491,111,656,278), 'choco-nut':(698,120,869,276),
 'green-tealiscious':(120,309,285,463), 'cookie-crumble':(306,311,479,463),
 'cookies-cream':(494,309,684,464), 'choco-drizzle':(704,303,883,453),
 'snow-sprinkle':(119,488,285,649), 'midnight-sprinkles':(310,485,487,648),
 'berry-crown':(519,492,693,650), 'zigzag-supreme':(709,490,878,647),
 'chocolate-filled':(118,685,281,851), 'caramel-filled':(305,689,478,853),
 'bavarian-breeze':(494,690,682,855), 'strawberry-filled':(718,689,891,855),
 'choco-mallow':(107,913,291,1080), 'fanfans':(491,915,693,1077),
 'matcha-supreme':(710,915,892,1077), 'bavarian-midnight':(104,1104,289,1264),
 'almond-glitz':(295,1103,471,1265), 'oreo-dream':(492,1102,655,1259),
 'lotus-cloud':(693,1101,864,1262),
 'matcha-pops':(1190,172,1394,314), 'strawberry-pops':(1428,167,1609,312),
 'taro-pops':(1642,175,1838,312), 'choco-lollisticks':(1008,359,1176,531),
 'bavarian-bites':(1244,442,1321,528), 'bavarian-pops':(1420,397,1612,531),
 'choco-balls':(1663,377,1825,538),
 'circlet-snow':(1008,654,1119,760), 'circlet-midnight':(1135,654,1246,760),
 'circlet-berry':(1260,654,1372,760), 'circlet-matcha':(1004,843,1109,945),
 'circlet-zigzag':(1124,841,1227,943), 'circlet-choco-drizzle':(1257,844,1369,939),
 'circlet-almonds':(1006,1023,1107,1127), 'circlet-nut':(1128,1027,1230,1129),
 'circlet-cookies':(1259,1018,1365,1118), 'circlet-double':(1009,1175,1108,1273),
 'giant-donut':(1423,640,1798,1106),
}
BOXES = {
 'assorted-rings-6':(1,(114,488,739,960)),
 'assorted-rings-12':(1,(958,448,1590,972)),
 'assorted-circlets-12':(2,(150,515,723,907)),
 'assorted-circlets-20':(2,(997,482,1565,912)),
 'giant-bavarian-a':(3,(73,353,715,864)),
 'giant-bavarian-b':(3,(1000,352,1650,863)),
 'bavarian-midnight-6':(4,(168,208,755,639)),
 'bavarian-midnight-12':(4,(1012,229,1573,636)),
}
BOX_OUTLINES = {
 'assorted-rings-6':[(191,497),(716,548),(718,894),(696,941),(137,867),(121,820)],
 'assorted-rings-12':[(1042,470),(1568,535),(1553,933),(1528,963),(982,897),(967,862)],
 'assorted-circlets-12':[(241,526),(685,576),(690,857),(699,865),(687,895),(166,830),(156,785)],
 'assorted-circlets-20':[(1074,492),(1533,534),(1547,880),(1034,886),(1010,792)],
 'giant-bavarian-a':[(188,352),(338,352),(362,325),(700,406),(636,804),(608,854),(97,723),(77,649)],
 'giant-bavarian-b':[(1126,296),(1619,410),(1560,803),(1525,855),(1018,724),(1002,665)],
 'bavarian-midnight-6':[(232,217),(731,271),(732,602),(715,643),(183,574),(169,529)],
 'bavarian-midnight-12':[(1091,238),(1557,289),(1557,602),(1543,632),(1044,575),(1020,528)],
}

def extract(path, bounds, reference, yellow=False, polygon=None, threshold=8, strip_fringe=False, red=False):
    source=Image.open(path).convert('RGB')
    sx,sy=source.width/reference[0],source.height/reference[1]
    photo=source.crop(tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(bounds)))
    # Work at up to 720 px; original photographs are never synthesized.
    photo.thumbnail((720,720),Image.Resampling.LANCZOS)
    rgb=np.asarray(photo).astype(np.int16)
    if yellow:
        candidate=(rgb[:,:,0]>170)&(rgb[:,:,1]>130)&(rgb[:,:,2]<125)&(rgb[:,:,0]>rgb[:,:,2]*1.45)
        if red:
            candidate=((rgb[:,:,0]>170)&(rgb[:,:,1]>130)&(rgb[:,:,2]<70))|((rgb[:,:,0]>130)&(rgb[:,:,1]<65)&(rgb[:,:,2]<75))
    else:
        corners=np.concatenate([rgb[:3,:3].reshape(-1,3),rgb[:3,-3:].reshape(-1,3),rgb[-3:,:3].reshape(-1,3),rgb[-3:,-3:].reshape(-1,3)])
        bg=np.median(corners,axis=0)
        candidate=np.max(np.abs(rgb-bg),axis=2)<threshold
    # Remove only background connected to the outside; preserve icing highlights.
    h,w=candidate.shape
    removed=np.zeros((h,w),bool)
    q=deque()
    for x in range(w):
        for y in (0,h-1):
            if candidate[y,x]: removed[y,x]=True;q.append((y,x))
    for y in range(h):
        for x in (0,w-1):
            if candidate[y,x] and not removed[y,x]: removed[y,x]=True;q.append((y,x))
    while q:
        y,x=q.popleft()
        for yy,xx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0<=yy<h and 0<=xx<w and candidate[yy,xx] and not removed[yy,xx]:
                removed[yy,xx]=True;q.append((yy,xx))
    rgba=photo.convert('RGBA')
    rgba.putalpha(Image.fromarray(np.where(removed,0,255).astype('uint8')))
    if polygon:
        mask=Image.new('L',photo.size,0)
        ImageDraw.Draw(mask).polygon([((x-bounds[0])/(bounds[2]-bounds[0])*photo.width,(y-bounds[1])/(bounds[3]-bounds[1])*photo.height) for x,y in polygon],fill=255)
        rgba.putalpha(mask)
        if strip_fringe:
            # Strip the remaining yellow poster fringe along the cutaway edge.
            alpha=np.asarray(mask).copy()
            poster_yellow=(rgb[:,:,0]>200)&(rgb[:,:,1]>170)&(rgb[:,:,2]<65)
            if red:
                poster_yellow |= (rgb[:,:,0]>150)&(rgb[:,:,1]<65)&(rgb[:,:,2]<75)
            alpha[poster_yellow]=0
            rgba.putalpha(Image.fromarray(alpha))
    bbox=rgba.getbbox()
    if not bbox: raise ValueError(path)
    rgba=rgba.crop(bbox)
    scale=400/max(rgba.size)
    rgba=rgba.resize((round(rgba.width*scale),round(rgba.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(512,512),(255,255,255,0))
    canvas.alpha_composite(rgba,((512-rgba.width)//2,(512-rgba.height)//2))
    return canvas

# Lower product outlines measured on the normalized original photographs.
# Remove only the cast-shadow area beneath these curves, preserving the bread.
SHADOW_EDGES = {
 'bavarian-midnight':[(456,265),(442,316),(417,357),(382,389),(337,412),(290,424),(245,425),(199,417),(155,401),(117,375),(88,340)],
 'choco-almonds':[(440,258),(437,305),(420,348),(393,386),(357,416),(312,439),(264,451),(222,450),(180,440),(146,423),(117,398),(96,370)],
 'cookie-crumble':[(455,252),(451,298),(437,344),(411,383),(378,410),(339,431),(295,443),(251,449),(210,446),(171,436),(138,419),(110,395),(90,366)],
 'green-tealiscious':[(452,255),(448,306),(430,355),(401,392),(365,420),(320,440),(270,450),(222,447),(178,435),(139,414),(105,384),(80,348)],
 'choco-nut':[(455,265),(450,310),(434,353),(408,389),(372,418),(331,437),(286,450),(243,452),(201,445),(162,428),(126,402),(99,372),(77,337)],
 'cookies-cream':[(449,264),(440,311),(418,357),(386,394),(345,421),(297,438),(250,443),(203,440),(163,429),(125,410),(95,383),(72,350)],
 'choco-drizzle':[(451,260),(442,304),(419,340),(385,369),(342,392),(295,408),(247,418),(199,415),(157,406),(120,389),(90,365),(69,333)],
 'circlet-almonds':[(435,255),(430,304),(415,350),(388,388),(353,418),(312,437),(266,448),(223,447),(184,436),(150,417),(120,393),(99,366)],
}

def remove_cut_shadow(photo, points):
    # Interpolate the measured outline smoothly without repainting any pixels.
    pts=np.asarray(points,dtype=float)
    padded=np.vstack((pts[0],pts,pts[-1]))
    curve=[]
    for i in range(1,len(padded)-2):
        a,b,c,d=padded[i-1:i+3]
        for t in np.linspace(0,1,16,endpoint=False):
            curve.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    curve.append(tuple(pts[-1]))
    mask=Image.new('L',(2048,2048),0)
    outline=[(0,0),(512,0),(512,points[0][1])]+curve+[(0,points[-1][1])]
    ImageDraw.Draw(mask).polygon([(round(x*4),round(y*4)) for x,y in outline],fill=255)
    mask=mask.resize((512,512),Image.Resampling.LANCZOS)
    photo.putalpha(Image.fromarray(np.minimum(np.asarray(photo.getchannel('A')),np.asarray(mask))))
    return photo

mapping={}
for name,bounds in REGIONS.items():
    if name == 'bavarian-bites':
        # Use the fully visible cutaway in the original poster; the group in the
        # individual sheet was already cut off before it reached this project.
        outline=[(1227,728),(1230,708),(1240,695),(1260,684),(1283,674),(1310,664),(1340,656),(1370,651),(1400,650),(1430,653),(1460,658),(1487,667),(1507,680),(1520,696),(1526,715),(1525,728),(1517,741),(1520,765),(1521,786),(1526,810),(1524,827),(1514,843),(1498,849),(1474,855),(1448,861),(1424,866),(1406,865),(1387,871),(1364,868),(1346,866),(1327,871),(1307,867),(1288,864),(1267,863),(1251,858),(1237,848),(1228,832),(1223,810),(1220,789),(1222,767),(1225,747)]
        extract(ROOT/'assets'/'box-6.png',(1217,647,1530,875),(1717,1440),True,outline).save(OUT/f'{name}.png')
    elif name == 'choco-balls':
        # User-selected original group from 11.png, retaining every photographed piece.
        extract(ROOT/'assets'/'box-11.png',(1017,616,1578,1201),(1717,1440),yellow=True,red=True).save(OUT/f'{name}.png')
    else:
        photo=extract(SHEET,bounds,(1888,1334),threshold=8)
        if name in SHADOW_EDGES:
            photo=remove_cut_shadow(photo,SHADOW_EDGES[name])
        photo.save(OUT/f'{name}.png')
    mapping[name]=f'./assets/products/{name}.png'
for name,(poster,bounds) in BOXES.items():
    polygon=BOX_OUTLINES[name]
    bounds=(min(x for x,y in polygon)-2,min(y for x,y in polygon)-2,max(x for x,y in polygon)+2,max(y for x,y in polygon)+2)
    extract(ROOT/'assets'/f'box-{poster}.png',bounds,(1717,1440),True,polygon).save(OUT/f'{name}.png')
    mapping[name]=f'./assets/products/{name}.png'
for name,counts in {'fanfans':[6,12],'bavarian-bites':[15,30],'bavarian-pops':[30,60],'taro-pops':[30,60],'strawberry-pops':[30,60],'matcha-pops':[30,60],'choco-balls':[30,60]}.items():
    for count in counts: mapping[f'{name}-{count}']=mapping[name]
# The Per Box card uses the original full group, independently of the piece photo.
group_outline=[(964,675),(1000,657),(1045,636),(1094,613),(1126,599),(1144,596),(1166,605),(1188,625),(1203,647),(1213,674),(1219,689),(1231,709),(1243,694),(1274,677),(1312,664),(1353,654),(1395,650),(1433,654),(1468,661),(1497,674),(1515,690),(1525,711),(1526,732),(1546,747),(1562,769),(1570,798),(1572,826),(1566,848),(1592,866),(1620,891),(1620,1141),(1611,1166),(1586,1183),(1551,1196),(1515,1200),(1476,1195),(1439,1182),(1404,1164),(1378,1137),(1361,1104),(1345,1067),(1334,1094),(1316,1119),(1284,1138),(1248,1153),(1207,1163),(1168,1160),(1129,1151),(1092,1135),(1069,1114),(1051,1081),(1040,1040),(1012,1054),(987,1063),(964,1070)]
extract(ROOT/'assets'/'box-6.png',(961,592,1623,1204),(1717,1440),yellow=True,polygon=group_outline,strip_fringe=True,red=True).save(OUT/'bavarian-bites-box.png')
for count in (15,30): mapping[f'bavarian-bites-{count}']='./assets/products/bavarian-bites-box.png'
(ROOT/'product-images.mjs').write_text('export const PRODUCT_IMAGES = '+json.dumps(mapping,indent=2)+';\n',encoding='utf-8')

# Review every distinct source extraction on the actual menu background.
names=list(REGIONS)+list(BOXES)+['bavarian-bites-box']
for batch in range(0,len(names),20):
    group=names[batch:batch+20]
    sheet=Image.new('RGB',(1000,240*((len(group)+4)//5)), '#fffaf4')
    draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(group):
        img=Image.open(OUT/f'{name}.png');img.thumbnail((190,190))
        x=(i%5)*200;y=(i//5)*240
        sheet.paste(img,(x+5,y+5),img)
        draw.text((x+8,y+202),name,fill='#751a1f')
    sheet.save(OUT/f'review-{batch//20+1}.jpg')
print(f'Prepared {len(names)} original photo assets for {len(mapping)} menu entries.')
