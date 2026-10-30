/** Archived merchandising reference index sourced from the verified WordPress media snapshot.
 * Presentational data only. It does not represent active inventory, promotions or purchasable offers.
 * Source digests and file provenance: docs/legacy-source-capture-cp17.json.
 */
export const homepageCategoryTiles=[
  {name:'Brand',image:'/legacy/categories/brand.png',href:'/brand-partner',legacy_key:'brand'},
  {name:'Pod',image:'/legacy/categories/pod.png',href:'/product-category/pod',legacy_key:'pod'},
  {name:'Mod',image:'/legacy/categories/mod.png',href:'/product-category/mod',legacy_key:'mod'},
  {name:'Cartridge',image:'/legacy/categories/cartridge.png',href:'/product-category/cartridge',legacy_key:'cartridge'},
  {name:'Liquid',image:'/legacy/categories/liquid.png',href:'/product-category/e-juice',legacy_key:'e-juice'}
] as const;

export const homepageBrands=[
  'OXVA','FOOM','IQOS','INTO','JOIWAY','SP2S','LANAVAPE','E-SUPER',
  'ROLV','LIQUID CULT','TAZE','SEVEN LIQUID'
] as const;

export const homepageHeroSlides=[
  {key:'legacy-hero-01',desktop:'/legacy/banners/desktop-01.png',mobile:'/legacy/banners/mobile-01.png',label:'Banner arsip Vapmart pertama'},
  {key:'legacy-hero-02',desktop:'/legacy/banners/desktop-02.png',mobile:'/legacy/banners/mobile-02.png',label:'Banner arsip Vapmart kedua'},
  {key:'legacy-hero-03',desktop:'/legacy/banners/desktop-03.png',mobile:'/legacy/banners/mobile-03.png',label:'Banner arsip Vapmart ketiga'}
] as const;
