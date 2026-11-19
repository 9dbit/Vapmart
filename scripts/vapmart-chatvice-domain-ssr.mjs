import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const merchantId='m_d74410c444e2726c';
const embedPath='https://chatvice.app/api/widget/chatvice.js?merchant='+merchantId;
const [layout,care]=await Promise.all([
  readFile(new URL('../apps/web/src/app/layout.tsx',import.meta.url),'utf8'),
  readFile(new URL('../apps/web/src/components/vapmart-care.tsx',import.meta.url),'utf8')
]);
assert.ok(layout.includes('<VapmartCare/>'),'Client widget remains installed');
assert.ok(care.includes(embedPath),'Client widget uses the approved merchant');
assert.ok(layout.includes('data-merchant-id="'+merchantId+'"'),'SSR merchant marker is present');
assert.ok(layout.includes(embedPath),'SSR marker names the real widget endpoint');

const port=31971;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{
  cwd:new URL('../apps/web/',import.meta.url),
  env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},
  stdio:['ignore','pipe','pipe'],
  windowsHide:true
});
let processErrors='';
child.stderr.on('data',d=>{processErrors+=String(d).slice(0,1000)});
try{
  let html=null;
  for(let i=0;i<50;i++){
    if(child.exitCode!==null)throw Error('Next exited early: '+processErrors);
    try{
      const res=await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(2200)});
      if(res.ok){html=await res.text();break}
    }catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  assert.ok(html,'Next SSR response did not become available: '+processErrors);
  assert.match(html,new RegExp('data-merchant-id="'+merchantId+'"'),'SSR includes exact merchant ownership marker');
  assert.ok(html.includes(embedPath),'SSR declares installed Chatvice script for non-JS validation');
  assert.ok(html.includes('chatvice-widget-embed'),'SSR marker has an identifiable name');
  assert.ok(!html.includes('data-merchant-id="m_other-merchant"'),'Unrelated merchant must not be present');
  console.log('PASS: Vapmart SSR contains exact Chatvice merchant marker; client widget implementation retained.');
}finally{
  child.kill();
}
