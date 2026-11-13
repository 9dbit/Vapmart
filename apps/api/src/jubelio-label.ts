import {ServiceUnavailableException} from '@nestjs/common';
import {isIP} from 'node:net';

const fail=():never=>{throw new ServiceUnavailableException('Alamat label Jubelio belum terverifikasi');};

/**
 * The label address is returned by Jubelio's authenticated shipment-label API,
 * not provided by an administrator or customer. It is opened by the admin's
 * browser only; the API does not fetch it, so it is not an SSRF entry point.
 *
 * Jubelio may use rotating signed storage/CDN hosts, so do not bind a legitimate
 * label to an obsolete fixed list of four domain suffixes.
 */
export function verifiedJubelioLabelLink(raw:unknown):{url:string;hostname:string}{
 if(typeof raw!=='string'||raw.length<12||raw.length>8192||raw!==raw.trim())return fail();
 let url:URL;
 try{url=new URL(raw);}catch{return fail();}
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!host||
  host.length>253||host.indexOf('.')<1||isIP(host)!==0||!(/^[a-z0-9.-]+$/.test(host))||
  host.split('.').some(part=>!part||part.startsWith('-')||part.endsWith('-'))||
  ['localhost','local','internal','lan','home','test','invalid','onion','arpa'].some(x=>host===x||host.endsWith('.'+x)))
   return fail();
 return {url:url.href,hostname:host};
}
