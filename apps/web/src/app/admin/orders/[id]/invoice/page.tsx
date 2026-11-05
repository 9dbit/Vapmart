import {CatalogOrderInvoice} from '@/components/catalog-order-invoice';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{revision?:string}>}){
 const {id}=await params,{revision}=await searchParams;
 return <CatalogOrderInvoice id={id} revision={revision===undefined?undefined:Number(revision)}/>;
}
