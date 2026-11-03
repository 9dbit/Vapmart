import {CatalogProductEditor} from '@/components/catalog-product-editor';
export default async function Page({params}:{params:Promise<{id:string}>}){return <CatalogProductEditor id={(await params).id}/>;}
