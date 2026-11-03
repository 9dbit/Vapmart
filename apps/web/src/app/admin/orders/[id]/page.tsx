import {CatalogOrdersAdmin} from '@/components/catalog-orders-admin';
export default async function Page({params}:{params:Promise<{id:string}>}){return <CatalogOrdersAdmin id={(await params).id}/>;}
