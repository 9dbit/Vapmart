// Test-only server: refuses all non-loopback databases. Never imported by the app.
const {resolve}=require('node:path');
const {createRequire}=require('node:module');
const req=createRequire(resolve('apps/api/package.json'));
req('reflect-metadata');
const database=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.HERO_LOCAL_TEST!=='1'||database.hostname!=='127.0.0.1'||!database.pathname.startsWith('/vapmart_cp38_'))throw Error('Disposable CP38 localhost test database required');
const {Module,UnauthorizedException}=req('@nestjs/common');const {NestFactory}=req('@nestjs/core');
const {DatabaseService}=require(resolve('apps/api/dist/database'));
const {AdminGuard,SupabaseAuthService}=require(resolve('apps/api/dist/auth'));
const {HeroBannersService}=require(resolve('apps/api/dist/hero-banners'));
const {HeroBannersAdminController,HeroBannersPublicController}=require(resolve('apps/api/dist/hero-banners-controller'));
const principal={id:'38000000-0000-4000-8000-000000009999',email:'hero-ui@example.invalid',emailVerified:true};
class FixtureModule{}
Module({controllers:[HeroBannersAdminController,HeroBannersPublicController],providers:[DatabaseService,HeroBannersService,AdminGuard,
 {provide:SupabaseAuthService,useValue:{verify:async authorization=>{if(authorization!=='Bearer fixture-admin')throw new UnauthorizedException();return principal;}}}]})(FixtureModule);
async function main(){
 const app=await NestFactory.create(FixtureModule,{logger:false});
 await app.get(DatabaseService).query("INSERT INTO public.staff_roles(user_id,role,is_active) VALUES($1,'admin',true) ON CONFLICT(user_id,role) DO UPDATE SET is_active=true",[principal.id]);
 const http=app.getHttpAdapter().getInstance();
 http.get('/v1/admin/status',(req,res)=>req.headers.authorization==='Bearer fixture-admin'?res.json({admin:true}):res.status(401).json({message:'Authentication required'}));
 for(const path of ['/v1/products','/v1/brands'])http.get(path,(req,res)=>res.json({items:[],total:0,page:Number(req.query.page||1),pageSize:Number(req.query.pageSize||100),hasMore:false}));
 http.get('/health',(req,res)=>res.json({testOnly:true}));
 await app.listen(4100,'127.0.0.1');console.log('CP38_LOCAL_FIXTURE_READY');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
main().catch(e=>{console.error(e);process.exit(1);});
