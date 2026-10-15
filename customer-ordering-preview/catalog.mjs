import {PRODUCT_IMAGES} from './product-images.mjs';
const sprite = './assets/individual-price-list.png';

const piece = (id, name, price, category, x, y, scale = 1) => ({
  id, name, price, category, type: 'piece', unitLabel: 'piece', piecesPerUnit: 1,
  image: sprite, crop: {x, y, scale},
});
// Product-photo centers on the supplied posters, measured against a 1717 × 1440 display.
const BOX_CROPS = {
  1: {6:[425,720,.22],12:[1265,710,.22]},
  2: {12:[435,705,.23],20:[1280,690,.23]},
  3: {a:[395,595,.18],b:[1310,595,.18]},
  4: {6:[460,420,.24],12:[1280,425,.24]},
  5: {6:[435,550,.20],12:[1290,930,.17]},
  6: {15:[455,540,.19],30:[1295,840,.19]},
  7: {30:[470,530,.18],60:[1280,845,.18]},
  8: {30:[445,525,.18],60:[1290,840,.18]},
  9: {30:[445,525,.18],60:[1310,840,.18]},
  10: {30:[445,525,.18],60:[1300,840,.18]},
  11: {30:[455,515,.18],60:[1290,910,.18]},
};
const box = (id, name, price, piecesPerUnit, image, category = 'Box sets') => {
  const [x,y,scale] = BOX_CROPS[image][image === 3 ? id.endsWith('-b') ? 'b' : 'a' : piecesPerUnit];
  return {
    id, name, price, category, type: 'box', unitLabel: id.startsWith('giant-bavarian-') ? 'bundle' : `box of ${piecesPerUnit}`,
    piecesPerUnit, image: `./assets/box-${image}.png`, imageIndex: image, crop: {x,y,scale},
    groupId: `box-family-${image}`,
    groupName: image === 3 ? 'Giant Bavarian Ring Bundles' : name.split(' · ')[0],
    optionLabel: image === 3 ? `Bundle ${id.endsWith('-b') ? 'B' : 'A'}` : `${piecesPerUnit} pcs`,
  };
};

export const PRODUCTS = [
  piece('double-choco','Double Choco',25,'Rings',193,192),
  piece('nuts-kisses','Nuts & Kisses',25,'Rings',383,192),
  piece('choco-almonds','Choco Almonds',25,'Rings',570,192),
  piece('choco-nut','Choco Nut',25,'Rings',781,192),
  piece('green-tealiscious','Green-tealiscious',25,'Rings',191,389),
  piece('cookie-crumble','Cookie Crumble',25,'Rings',383,389),
  piece('cookies-cream','Cookies & Cream',25,'Rings',571,389),
  piece('choco-drizzle','Choco Drizzle',25,'Rings',781,389),
  piece('snow-sprinkle','Snow Sprinkle Delight',25,'Rings',191,578),
  piece('midnight-sprinkles','Midnight Sprinkles',25,'Rings',383,578),
  piece('berry-crown','Berry Crown',25,'Rings',571,578),
  piece('zigzag-supreme','ZigZag Supreme',25,'Rings',780,578),
  piece('choco-mallow','Choco Mallow',25,'Rings',192,965),
  piece('chocolate-filled','Chocolate Filled',26,'Filled',193,770),
  piece('caramel-filled','Caramel Filled',26,'Filled',384,770),
  piece('bavarian-breeze','Bavarian Breeze',26,'Filled',571,770),
  piece('strawberry-filled','Strawberry Filled',26,'Filled',780,770),
  piece('bavarian-midnight','Bavarian Midnight',28,'Premium',191,1150),
  piece('matcha-supreme','Matcha Supreme',30,'Premium',780,965),
  piece('fanfans','Fan-Fans',33,'Premium',570,965),
  piece('oreo-dream','Oreo Dream',33,'Premium',572,1150),
  piece('almond-glitz','Almond Glitz',35,'Premium',383,1150),
  piece('lotus-cloud','Lotus Cloud',35,'Premium',781,1150),
  piece('matcha-pops','Matcha Pops',6,'Bites & pops',1294,250),
  piece('strawberry-pops','Strawberry Pops',6,'Bites & pops',1516,250),
  piece('taro-pops','Taro Pops',6,'Bites & pops',1743,250),
  piece('bavarian-bites','Bavarian Bites',6,'Bites & pops',1300,440),
  piece('bavarian-pops','Bavarian Pops',6,'Bites & pops',1510,440),
  piece('choco-balls','Choco Balls',6,'Bites & pops',1745,440),
  piece('choco-lollisticks','Choco Lollisticks',7,'Bites & pops',1092,442),
  piece('circlet-snow','Snow Sprinkle Delight Circlet',13,'Glaze Circlets',1064,725,1.7),
  piece('circlet-midnight','Midnight Sprinkles Circlet',13,'Glaze Circlets',1192,725,1.7),
  piece('circlet-berry','Berry Crown Circlet',13,'Glaze Circlets',1319,725,1.7),
  piece('circlet-matcha','Matcha Drizzle Circlet',13,'Glaze Circlets',1064,921,1.7),
  piece('circlet-zigzag','ZigZag Supreme Circlet',13,'Glaze Circlets',1192,921,1.7),
  piece('circlet-choco-drizzle','Choco Drizzle Circlet',13,'Glaze Circlets',1320,921,1.7),
  piece('circlet-almonds','Choco Almonds Circlet',13,'Glaze Circlets',1065,1080,1.7),
  piece('circlet-nut','Choco Nut Circlet',13,'Glaze Circlets',1191,1080,1.7),
  piece('circlet-cookies','Cookies & Cream Circlet',13,'Glaze Circlets',1319,1080,1.7),
  piece('circlet-double','Double Choco Circlet',13,'Glaze Circlets',1065,1240,1.7),
  piece('giant-donut','Giant Donut (approx. 7x11 inches)',219,'Giant',1650,875,.8),
  box('assorted-rings-6','Assorted Rings · 6 pcs',150,6,1),
  box('assorted-rings-12','Assorted Rings · 12 pcs',300,12,1),
  box('assorted-circlets-12','Assorted Circlets · 12 pcs',156,12,2),
  box('assorted-circlets-20','Assorted Circlets · 20 pcs',260,20,2),
  box('bavarian-midnight-6','Bavarian Midnight · 6 pcs',168,6,4),
  box('bavarian-midnight-12','Bavarian Midnight · 12 pcs',336,12,4),
  box('fanfans-6','Fan-Fans · 6 pcs',198,6,5),
  box('fanfans-12','Fan-Fans · 12 pcs',396,12,5),
  box('bavarian-bites-15','Bavarian Bites · 15 pcs',15*6,15,6),
  box('bavarian-bites-30','Bavarian Bites · 30 pcs',30*6,30,6),
  ...[
    ['bavarian-pops','Bavarian Pops',7],
    ['taro-pops','Taro Pops',8],
    ['strawberry-pops','Strawberry Pops',9],
    ['matcha-pops','Matcha Pops',10],
    ['choco-balls','Choco Balls',11],
  ].flatMap(([id,name,image])=>[
    box(`${id}-30`,`${name} · 30 pcs`,30*6,30,image),
    box(`${id}-60`,`${name} · 60 pcs`,60*6,60,image),
  ]),
];

for (const product of PRODUCTS) product.cleanImage = PRODUCT_IMAGES[product.id];

// Shells are a separate Filled product in the main system (₱26 each).
for (const count of [6,12]) PRODUCTS.push({
  id:`shells-${count}`, name:`Shells · ${count} pcs`, price:26*count,
  category:'Box sets', type:'box', unitLabel:`box of ${count}`, piecesPerUnit:count,
  groupId:'shells', groupName:'Shells', optionLabel:`${count} pcs`,
  cleanImage:`./assets/flavor-boxes/${count===6?'shells-6-packed.png':'shells-12.png'}`,
});
export const findProduct = id => PRODUCTS.find(product => product.id === id);

// Group display cards only. Cart and checkout retain each size's existing SKU.
export function catalogCards(mode, search = '') {
  const query = search.trim().toLowerCase();
  if (mode !== 'box') return PRODUCTS.filter(p => p.type === mode && p.name.toLowerCase().includes(query));
  const groups = new Map();
  for (const product of PRODUCTS.filter(p => p.type === 'box')) {
    if (!groups.has(product.groupId)) groups.set(product.groupId, {
      id: product.groupId, name: product.groupName, cleanImage: product.cleanImage, variants: [],
    });
    groups.get(product.groupId).variants.push(product);
  }
  return [...groups.values()].filter(group => group.name.toLowerCase().includes(query) || group.variants.some(p => p.name.toLowerCase().includes(query)));
}
