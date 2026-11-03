// Test runner only. No fixture identity is imported or compiled into the deployed apps.
const {resolve}=require('node:path');const {createRequire}=require('node:module');
const ROOT=resolve(__dirname,'..'),req=createRequire(resolve(ROOT,'apps/api/package.json'));req('reflect-metadata');
const parsed=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||parsed.hostname!=='127.0.0.1'||!parsed.pathname.startsWith('/vapmart_cp39_'))throw Error('Refuse any database except isolated CP39 loopback database');
const {Module,UnauthorizedException}=req('@nestjs/common'),{NestFactory}=req('@nestjs/core');
const {AppModule}=require(resolve(ROOT,'apps/api/dist/module'));
const {SupabaseAuthService}=require(resolve(ROOT,'apps/api/dist/auth'));
const {DatabaseService}=require(resolve(ROOT,'apps/api/dist/database'));
const {WarehouseService}=require(resolve(ROOT,'apps/api/dist/warehouses'));
const users={
 'fixture-admin':{id:'39000000-0000-4000-8000-000000009999',email:'catalog-admin@example.invalid',emailVerified:true},
 'fixture-buyer':{id:'39000000-0000-4000-8000-000000009998',email:'catalog-buyer@example.invalid',emailVerified:true},
 'fixture-other':{id:'39000000-0000-4000-8000-000000009997',email:'catalog-other@example.invalid',emailVerified:true},
 'fixture-unverified':{id:'39000000-0000-4000-8000-000000009996',email:'catalog-unverified@example.invalid',emailVerified:false}
};
async function createFixture(port=0){
 class TestModule{}
 const providers=Reflect.getMetadata('providers',AppModule).map(p=>p===SupabaseAuthService?{provide:SupabaseAuthService,useValue:{verify:async(a)=>{const u=users[(a||'').replace(/^Bearer /,'')];if(!u)throw new UnauthorizedException();return u;}}}:p);
 Module({controllers:Reflect.getMetadata('controllers',AppModule),providers})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false,rawBody:true});app.useBodyParser('json',{limit:'3mb'});
 const db=app.get(DatabaseService);await db.query("INSERT INTO public.staff_roles(user_id,role,is_active) VALUES($1,'admin',true) ON CONFLICT(user_id,role) DO UPDATE SET is_active=true",[users['fixture-admin'].id]);
 const wh=app.get(WarehouseService);for(const [code,name] of [['CP39-A','Gudang Uji A'],['CP39-B','Gudang Uji B']]){let w=(await db.query('SELECT id FROM product.warehouses WHERE code=$1',[code])).rows[0];if(!w)w=(await wh.create(users['fixture-admin'],{code,name,address:'Jalan Pengujian Nomor 39',city:'Bandung',province:'Jawa Barat',postalCode:'40115'})).warehouse;await wh.update(users['fixture-admin'],w.id,{dispatchEnabled:true});}
 await app.listen(port,'127.0.0.1');return {app,db,users,base:await app.getUrl()};
}
module.exports={createFixture,users,ROOT};
if(require.main===module)createFixture(4100).then(({app})=>{console.log('CP39_FIXTURE_READY');for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)))}).catch(e=>{console.error(e);process.exit(1)});
