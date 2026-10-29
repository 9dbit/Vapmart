import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
for (const [label,url] of [
  ['WORDPRESS','https://vapmart.co.id/'],
  ['NEXTJS','https://vapmart-web-staging.up.railway.app/']
]){
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(2000);
    await page.evaluate(async()=>{try{await document.fonts.ready}catch{}});
    const data=await page.evaluate(()=>{
      const s=(el)=>{if(!el)return null;const x=getComputedStyle(el);const r=el.getBoundingClientRect();return {text:el.innerText?.slice(0,160),bg:x.backgroundColor,color:x.color,font:x.fontFamily,size:x.fontSize,width:Math.round(r.width),height:Math.round(r.height)};};
      return {
        title:document.title,
        background:s(document.body),
        header:s(document.querySelector('header')),
        firstH1:s(document.querySelector('h1')),
        firstH2:s(document.querySelector('h2')),
        images:Array.from(document.images).slice(0,8).map(i=>({alt:i.alt,src:i.src.split('?')[0].slice(0,170),width:i.naturalWidth,height:i.naturalHeight})),
        links:Array.from(document.querySelectorAll('nav a')).slice(0,10).map(a=>a.innerText.trim())
      };
    });
    console.log('VISUAL_META_'+label+' '+JSON.stringify({status:response?.status(),data}));
    const shot=await page.screenshot({type:'jpeg',quality:30,fullPage:false});
    console.log('VISUAL_CAPTURE_'+label+' '+shot.toString('base64'));
  }catch(err){console.log('VISUAL_FAILED_'+label+' '+String(err))}
  await page.close();
}
await browser.close();
