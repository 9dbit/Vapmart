import {readFileSync} from 'node:fs';
const file=process.argv[2]||'audit.json';
const report=JSON.parse(readFileSync(file,'utf8'));
const counts=report.metadata?.vulnerabilities||{};
const items=Object.entries(report.vulnerabilities||{}).map(([name,v])=>({
 name,severity:v.severity,fixAvailable:v.fixAvailable,
 advisories:(v.via||[]).filter(x=>typeof x==='object').map(x=>({title:x.title,url:x.url,range:x.range}))
}));
console.log('VAPMART_DEPENDENCY_AUDIT',JSON.stringify({counts,items},null,2));
const high=(counts.high||0)+(counts.critical||0);
if(high>0){console.error('RELEASE_BLOCKED: high or critical production dependency vulnerabilities:',high);process.exitCode=1;}
