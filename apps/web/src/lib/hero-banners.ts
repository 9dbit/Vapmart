export type HeroSlide={key:string;desktop:string;mobile:string;label:string;reference?:boolean};
export const heroAssetPath=/^\/api\/hero-banners\/assets\/[0-9a-f-]{36}$/i;
const imagePath=(x:unknown)=>typeof x==='string'&&(heroAssetPath.test(x)||/^\/legacy\/banners\/(desktop|mobile)-0[123]\.png$/.test(x));
export async function getHeroResult():Promise<{ok:boolean;items:HeroSlide[];error:string|null}>{
 try{
  const base=process.env.API_INTERNAL_URL;if(!base)throw Error('HERO_NOT_CONFIGURED');
  const r=await fetch(new URL('/v1/hero-banners',base),{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('HERO_UNAVAILABLE');const d=await r.json();
  if(!Array.isArray(d.items)||d.items.length>30||d.items.some((x:HeroSlide)=>!x||typeof x.key!=='string'||!imagePath(x.desktop)||!imagePath(x.mobile)||typeof x.label!=='string')||new Set(d.items.map((x:HeroSlide)=>x.key)).size!==d.items.length)throw Error('HERO_INVALID_RESPONSE');
  return {ok:true,items:d.items,error:null};
 }catch{return {ok:false,items:[],error:'HERO_UNAVAILABLE'};}
}
