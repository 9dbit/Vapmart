import {Suspense} from 'react';
import {CustomerAuthPanel} from '@/components/customer-auth-panel';
export const metadata={title:'Masuk & Daftar | Vapmart',robots:{index:false,follow:false}};
export default function LoginPage(){
 return <main className="vm21-account-page"><Suspense fallback={<p role="status">Menyiapkan halaman akun…</p>}><CustomerAuthPanel/></Suspense></main>;
}
