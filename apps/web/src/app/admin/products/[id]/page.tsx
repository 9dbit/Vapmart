import {CatalogProductEditor} from '@/components/catalog-product-editor';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string}>}){const {id}=await params;const query=await searchParams;return <CatalogProductEditor id={id} archivePublish={query.from==='archive'}/>;}
