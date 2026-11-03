import {BadRequestException} from '@nestjs/common';
export const MAX_CSV_BYTES=2*1024*1024;
// RFC4180-style quoted records, including embedded newlines and escaped quotes.
export function parseCSV(text:string):{headers:string[];rows:Record<string,string>[]} {
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_CSV_BYTES)throw new BadRequestException('CSV maksimal 2 MiB');
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(quoted){if(c===undefined)throw new BadRequestException('Tanda kutip CSV tidak ditutup');if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new BadRequestException('Kutip CSV tidak valid');quoted=true;continue;}
  if(closed&&c!==','&&c!=='\r'&&c!=='\n'&&c!==undefined)throw new BadRequestException('Karakter setelah kutip CSV tidak valid');
  if(c===','||c==='\r'||c==='\n'||c===undefined){row.push(cell);cell='';closed=false;
   if(row.length>128)throw new BadRequestException('Maksimal 128 kolom CSV');
   if(c!==','){if(row.some(v=>v!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
  }else cell+=c;
  if(cell.length>100000)throw new BadRequestException('Sel CSV terlalu panjang');
  if(rows.length>2001)throw new BadRequestException('Maksimal 2.000 baris per impor');
 }
 if(!rows.length)throw new BadRequestException('CSV kosong');const headers=rows.shift()!.map(x=>x.trim());
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new BadRequestException('Header kosong atau ganda');
 return {headers,rows:rows.map((r,i)=>{if(r.length!==headers.length)throw new BadRequestException('Jumlah kolom berbeda pada record '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));})};
}
export const importFields={id:'ID',type:'Type',sku:'SKU',name:'Name',slug:'Slug',description:'Description',shortDescription:'Short description',regularPrice:'Regular price',salePrice:'Sale price',saleStart:'Date sale price starts',saleEnd:'Date sale price ends',stock:'Stock',categories:'Categories',images:'Images',parent:'Parent',brand:'Brands',weight:'Weight (g)',length:'Length (cm)',width:'Width (cm)',height:'Height (cm)',attribute1:'Attribute 1 name',values1:'Attribute 1 value(s)',attribute2:'Attribute 2 name',values2:'Attribute 2 value(s)',attribute3:'Attribute 3 name',values3:'Attribute 3 value(s)'} as const;
export function csvInteger(value:string,label:string,nullable=false):number|null{
 if(!value.trim()&&nullable)return null;
 if(!/^\d+(?:\.0+)?$/.test(value.trim()))throw new BadRequestException(label+' harus angka bulat tanpa pemisah ribuan');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>2000000000)throw new BadRequestException(label+' di luar batas');return n;
}
export function plainDescription(value:string){return value.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi,'').replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(?:0*39|x27);/gi,"'").replace(/&quot;/g,'"').replace(/\n{3,}/g,'\n\n').trim();}
export function slugify(value:string){return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');}
