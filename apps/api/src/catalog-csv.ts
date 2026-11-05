import {BadRequestException} from '@nestjs/common';
import {createHash} from 'node:crypto';
export const MAX_CSV_BYTES=2*1024*1024;
// RFC4180-style quoted records, including embedded newlines and escaped quotes.
export function parseCSV(text:string) {
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_CSV_BYTES)throw new BadRequestException('CSV maksimal 2 MiB');
 if(text.includes('\uFFFD')||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text))throw new BadRequestException('Encoding CSV tidak valid. Simpan ulang sebagai CSV UTF-8.');
 text=text.replace(/^\uFEFF/,'');
 const explicit=/^sep=([,;\t])\r?\n/i.exec(text);if(explicit)text=text.slice(explicit[0].length);
 const counts:Record<string,number>={',':0,';':0,'\t':0};let inHeaderQuote=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inHeaderQuote&&text[i+1]==='"')i++;else inHeaderQuote=!inHeaderQuote;}else if(!inHeaderQuote){if(c==='\n'||c==='\r')break;if(c in counts)counts[c]++;}}
 const candidates=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
 if(!explicit&&candidates[0][1]>0&&candidates[0][1]===candidates[1][1])throw new BadRequestException('Pemisah CSV ambigu. Gunakan koma atau titik koma secara konsisten.');
 const delimiter=explicit?.[1]||candidates[0][0];
 const rows:string[][]=[],warnings:{row:number;field:string;message:string}[]=[];let row:string[]=[],cell='',quoted=false,closed=false,literalQuote=false,record=1,line=1;
 const fail=(message:string):never=>{throw new BadRequestException(`Record ${record}, baris ${line}, kolom ${row.length+1}: ${message}`);};
 const add=(c:string)=>{cell+=c;if(cell.length>100000)fail('Sel CSV terlalu panjang (maksimal 100.000 karakter)');};
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(quoted){if(c===undefined)fail('Tanda kutip CSV tidak ditutup. Bungkus isi sel dengan kutip dan tulis kutip di dalamnya sebagai dua kutip.');if(c==='"'){if(text[i+1]==='"'){add('"');i++;}else{quoted=false;closed=true;}}else{add(c);if(c==='\n')line++;}continue;}
  if(c==='"'){if(closed)fail('Kutip CSV tidak valid');if(cell){add(c);literalQuote=true;}else quoted=true;continue;}
  if(closed&&c!==delimiter&&c!=='\r'&&c!=='\n'&&c!==undefined)fail('Karakter setelah kutip CSV tidak valid. Untuk tanda inci gunakan dua kutip di dalam sel yang dibungkus kutip.');
  if(c===delimiter||c==='\r'||c==='\n'||c===undefined){
   if(literalQuote)warnings.push({row:record,field:rows[0]?.[row.length]||String(row.length+1),message:'Tanda kutip literal dipertahankan (misalnya ukuran inci). Periksa isi pada preview sebelum impor.'});
   row.push(cell);cell='';closed=false;literalQuote=false;
   if(row.length>128)throw new BadRequestException('Maksimal 128 kolom CSV');
   if(c!==delimiter){if(row.some(v=>v!=='')){rows.push(row);record++;}row=[];if(c==='\r'&&text[i+1]==='\n')i++;if(c!==undefined)line++;}
  }else add(c);
  if(rows.length>2001)throw new BadRequestException('Maksimal 2.000 baris per impor');
 }
 if(!rows.length)throw new BadRequestException('CSV kosong');const headers=rows.shift()!.map(x=>x.trim());
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new BadRequestException('Header kosong atau ganda');
 return {headers,delimiter,warnings,rows:rows.map((r,i)=>{if(r.length!==headers.length)throw new BadRequestException(`Jumlah kolom berbeda pada record ${i+2}: ditemukan ${r.length}, seharusnya ${headers.length}. Periksa pemisah dan kutip pada sel.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));})};
}
export const importFields={id:'ID',type:'Type',sku:'SKU',name:'Name',slug:'Slug',description:'Description',shortDescription:'Short description',regularPrice:'Regular price',salePrice:'Sale price',saleStart:'Date sale price starts',saleEnd:'Date sale price ends',stock:'Stock',categories:'Categories',images:'Images',parent:'Parent',brand:'Brands',weight:'Weight (g)',length:'Length (cm)',width:'Width (cm)',height:'Height (cm)',attribute1:'Attribute 1 name',values1:'Attribute 1 value(s)',attribute2:'Attribute 2 name',values2:'Attribute 2 value(s)',attribute3:'Attribute 3 name',values3:'Attribute 3 value(s)'} as const;
export function csvInteger(value:string,label:string,nullable=false):number|null{
 if(!value.trim()&&nullable)return null;
 if(!/^\d+(?:\.0+)?$/.test(value.trim()))throw new BadRequestException(label+' harus angka bulat tanpa pemisah ribuan');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>2000000000)throw new BadRequestException(label+' di luar batas');return n;
}
export function plainDescription(value:string){return value.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi,'').replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(?:0*39|x27);/gi,"'").replace(/&quot;/g,'"').replace(/\n{3,}/g,'\n\n').trim();}
export function slugify(value:string){return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');}
export function generatedImportSlug(name:string,sourceKey:string,sourceId:string){
 const prefix=slugify(name).slice(0,100).replace(/-+$/,'')||'product';
 return prefix+'-'+createHash('sha256').update(sourceKey+':'+sourceId).digest('hex').slice(0,10);
}
