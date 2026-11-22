import {CustomerAccountPanel} from '@/components/customer-account-panel';
export const metadata={title:'Akun Saya | Vapmart',robots:{index:false,follow:false}};
export default function AccountPage(){
 return <main className="vm21-account-page vm-account-page"><CustomerAccountPanel/></main>;
}
