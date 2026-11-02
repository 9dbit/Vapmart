import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
// Legacy bookmark only. The single admin entry point is /admin.
export default function LegacyAdminLogin(){redirect('/admin');}
