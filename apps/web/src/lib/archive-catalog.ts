import {archivedProducts,type ArchivedProduct} from './archived-reference';

/** Historical visual references extracted from public WordPress HTML and media.
 * Not active inventory, verified stock, real-time prices, or checkout input.
 */
export type ArchiveCategory='pod'|'mod'|'cartridge'|'e-juice';
export type ArchiveItem=ArchivedProduct&{
  slug:string;
  category:ArchiveCategory;
  brand:string;
  source:'homepage-20260316'|'pod-category-20260414';
};
const homeRecord=[
 ['into-mission-replacement-pods','cartridge','Into'],
 ['into-mercury-mission-1100mah-pod-system-kit','pod','Into'],
 ['into-neptune-mission-1100mah-pod-system-kit','pod','Into'],
 ['into-moon-mission-1100mah-pod-system-kit','pod','Into'],
 ['sp2s-uranus-pod-kit-30w-1000mah-2','pod','SP2S'],
 ['into-earth-mission-1100mah-pod-system-kit','pod','Into'],
 ['into-venus-mission-1100mah-pod-system-kit','pod','Into'],
 ['sp2s-venus-pod-kit-30w-1500mah-screen-display-bigger-capacity-2-5ml-airflow-adjustable-type-c-fast-charging-black-gray-green-pink-white-gratis-liquid-15ml','pod','SP2S'],
 ['sp2s-cartridge-uranus-pod-2-5ml-per-pcs','cartridge','SP2S'],
 ['mystery-box-liquid-15ml-dan-30ml','e-juice','SP2S'],
 ['oxva-xlim-go-kit-bundling-ox-passion-black','pod','OXVA'],
 ['rolv-rock-master-pod','pod','ROLV']
] as const;
export const featuredArchiveItems:ArchiveItem[]=archivedProducts.map((item,i)=>({
 ...item,
 slug:homeRecord[i]![0],category:homeRecord[i]![1],brand:homeRecord[i]![2],
 source:'homepage-20260316'
}));

const additionalPodItems:ArchiveItem[]=[
 {slug:'once-disposable-1200-puff',name:'SP2S Once Disposable 1200 Puff',
  image:'/legacy/categories/pod-06.jpeg',price:'Rp 60.000',originalPrice:'Rp 116.000',category:'pod',brand:'SP2S',source:'pod-category-20260414'},
 {slug:'gem-disposable-3500-puff-6ml',name:'GEM Disposable 3500 Puff 6ml FREE ONCE',
  image:'/legacy/categories/pod-07.jpeg',price:'Rp 200.000',originalPrice:'Rp 260.000',category:'pod',brand:'SP2S',source:'pod-category-20260414'},
 {slug:'sp2s-sii-pro-device',name:'SP2S SII PRO Device Only',
  image:'/legacy/categories/pod-08.jpg',price:'Rp 150.000',originalPrice:'Rp 245.000',category:'pod',brand:'SP2S',source:'pod-category-20260414'},
 {slug:'emkay-pod-free-liquid-15ml-black-majesty',name:'EMKAY Pod Free Liquid 15ml – Black Majesty',
  image:'/legacy/categories/pod-09.png',price:'Rp 160.000',category:'pod',brand:'Liquid Cult',source:'pod-category-20260414'},
 {slug:'emkay-pod-free-liquid-15ml-rose-gold',name:'EMKAY Pod Free Liquid 15ml – Rose Gold',
  image:'/legacy/categories/pod-10.png',price:'Rp 160.000',category:'pod',brand:'Liquid Cult',source:'pod-category-20260414'},
 {slug:'emkay-pod-free-liquid-15ml-blue-ocean',name:'EMKAY Pod Free Liquid 15ml – Blue Ocean',
  image:'/legacy/categories/pod-11.png',price:'Rp 160.000',category:'pod',brand:'Liquid Cult',source:'pod-category-20260414'},
 {slug:'emkay-pod-free-liquid-15ml-maple-shine',name:'EMKAY Pod Free Liquid 15ml – Maple Shine',
  image:'/legacy/categories/pod-12.png',price:'Rp 160.000',category:'pod',brand:'Liquid Cult',source:'pod-category-20260414'}
];

export const originalPodCategory:ArchiveItem[]=[
 featuredArchiveItems[5]!,featuredArchiveItems[3]!,featuredArchiveItems[6]!,
 featuredArchiveItems[1]!,featuredArchiveItems[2]!,...additionalPodItems
];

export const allArchiveItems:ArchiveItem[]=[...featuredArchiveItems,...additionalPodItems];
export const archiveBySlug=new Map<string,ArchiveItem>(allArchiveItems.map(item=>[item.slug,item]));
export const archiveCategories:Record<ArchiveCategory,{label:string;slug:string}>={
 pod:{label:'Pod',slug:'pod'},
 mod:{label:'Mod',slug:'mod'},
 cartridge:{label:'Cartridge',slug:'cartridge'},
 'e-juice':{label:'Liquid',slug:'e-juice'}
};
export function categoryArchiveItems(category:ArchiveCategory):ArchiveItem[]{
 if(category==='pod')return originalPodCategory;
 return featuredArchiveItems.filter(item=>item.category===category);
}
export function isArchiveCategory(slug:string):slug is ArchiveCategory{
 return Object.prototype.hasOwnProperty.call(archiveCategories,slug);
}
