import {AccountDashboard} from '@/components/account-dashboard';
import {getProductsResult} from '@/lib/api';
export const metadata={title:'Akun Saya | Vapmart',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AccountPage(){
 const result=await getProductsResult();
 const active=result.items.filter(p=>p.is_active&&!p.slug.startsWith('demo-'));
 return <AccountDashboard products={active}/>;
}
