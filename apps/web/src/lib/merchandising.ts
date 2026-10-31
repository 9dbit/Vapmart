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

/** Original partner image files checked against docs/legacy-assets-manifest.json.
 * Several authentic wordmarks are white, so use a dark contrast stage rather than replacing the logos.
 * The order here is the original media order, not a claim about active partnerships.
 */
export const brandPartners=[
  {slug:'oxva',name:'OXVA',image:'/legacy/brands/brand-01.png'},
  {slug:'foom',name:'FOOM',image:'/legacy/brands/brand-02.png'},
  {slug:'iqos',name:'IQOS',image:'/legacy/brands/brand-03.png'},
  {slug:'into',name:'INTO',image:'/legacy/brands/brand-04.png'},
  {slug:'joiway',name:'JOIWAY',image:'/legacy/brands/brand-05.png'},
  {slug:'sp2s',name:'SP2S',image:'/legacy/brands/brand-06.png'},
  {slug:'lanavape',name:'LANAVAPE',image:'/legacy/brands/brand-07.png'},
  {slug:'e-super',name:'E-SUPER',image:'/legacy/brands/brand-08.png'},
  {slug:'rolv',name:'ROLV',image:'/legacy/brands/brand-09.png'},
  {slug:'liquid-cult',name:'LIQUID CULT',image:'/legacy/brands/brand-10.png'},
  {slug:'taze',name:'TAZE',image:'/legacy/brands/brand-11.png'},
  {slug:'seven-liquid',name:'SEVEN LIQUID',image:'/legacy/brands/brand-12.png'},
] as const;

export const homepageHeroSlides=[
  {key:'legacy-hero-01',desktop:'/legacy/banners/desktop-01.png',mobile:'/legacy/banners/mobile-01.png',label:'Banner arsip Vapmart pertama'},
  {key:'legacy-hero-02',desktop:'/legacy/banners/desktop-02.png',mobile:'/legacy/banners/mobile-02.png',label:'Banner arsip Vapmart kedua'},
  {key:'legacy-hero-03',desktop:'/legacy/banners/desktop-03.png',mobile:'/legacy/banners/mobile-03.png',label:'Banner arsip Vapmart ketiga'}
] as const;
