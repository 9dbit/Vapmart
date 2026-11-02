import type {Product} from './types';

export type DigitalKind='membership_activation'|'coin_pack';
export type DigitalPack={sku:string;label:string;amount:number;coins:number;kind:DigitalKind;coinCount:number;caption:string};

export const digitalPacks:readonly DigitalPack[]=[
 {sku:'COIN-050',label:'Starter',amount:50000,coins:50000,kind:'coin_pack',coinCount:3,caption:'3 gold coins'},
 {sku:'COIN-100',label:'Essential',amount:100000,coins:100000,kind:'coin_pack',coinCount:5,caption:'5 gold coins'},
 {sku:'COIN-300',label:'Plus',amount:300000,coins:300000,kind:'coin_pack',coinCount:9,caption:'9 gold coins'},
 {sku:'COIN-500',label:'Premium',amount:500000,coins:500000,kind:'coin_pack',coinCount:13,caption:'13 gold coins'},
 {sku:'COIN-1000',label:'Elite',amount:1000000,coins:1000000,kind:'coin_pack',coinCount:19,caption:'19 gold coins'},
 {sku:'COIN-2000',label:'Royal',amount:2000000,coins:2000000,kind:'coin_pack',coinCount:26,caption:'26 gold coins'}
] as const;

export const membershipActivation:DigitalPack={
 sku:'MEMBER-ACTIVATION',label:'Vapmart Membership',amount:100000,coins:100000,
 kind:'membership_activation',coinCount:5,caption:'Member Card + 100.000 Coin'
};

export function isDigitalProduct(p:Product):boolean {
 return typeof p.sku==='string' && (p.sku===membershipActivation.sku || digitalPacks.some(x=>x.sku===p.sku))
   && p.id==='digital:'+p.sku;
}
export function digitalPackFor(sku:string|null|undefined):DigitalPack|undefined {
 return sku===membershipActivation.sku?membershipActivation:digitalPacks.find(p=>p.sku===sku);
}
export function digitalProduct(pack:DigitalPack):Product {
 return {
  id:'digital:'+pack.sku,sku:pack.sku,slug:'digital-'+pack.sku.toLowerCase(),
  name:pack.kind==='membership_activation'?'Vapmart Member Activation':pack.coins.toLocaleString('id-ID')+' Vapmart Coin',
  description:pack.kind==='membership_activation'?'Aktivasi member satu kali dan kredit 100.000 Coin setelah pembayaran terverifikasi.':'Top up Coin setelah pembayaran berhasil diverifikasi.',
  category:'other',price_idr:pack.amount,stock_qty:1,image_url:null,is_active:true
 };
}
