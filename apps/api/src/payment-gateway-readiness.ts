import {createHash,timingSafeEqual} from 'node:crypto';
import {xenditSandboxReadiness,xenditChannelsForMethod} from './xendit-sandbox';

export type FutureGatewayProvider='midtrans'|'xendit'|'genesis';
export type PaymentMethod='bank_transfer'|'qris'|'virtual_account'|'ewallet';

const supportedProviders=new Set<FutureGatewayProvider>(['midtrans','xendit','genesis']);

/** Do not infer a live connection solely from the presence of a secret or env var.
 * Only the manual bank-transfer flow is currently wired into Vapmart orders.
 */
export function paymentGatewayReadiness(){
 const raw=process.env.VAPMART_PAYMENT_PROVIDER;
 const xendit=xenditSandboxReadiness();
 const provider=raw&&supportedProviders.has(raw as FutureGatewayProvider)?raw as FutureGatewayProvider:
  xendit.testKeyConfigured?'xendit':null;
 if(provider==='xendit')return {
  provider,connected:xendit.connected,paymentEnabled:xendit.paymentEnabled,livePaymentEnabled:false,
  status:xendit.paymentEnabled?'sandbox_active':xendit.connected?'sandbox_connected':'sandbox_incomplete',
  environment:'test',
  availableMethods:['bank_transfer',...(['qris','virtual_account','ewallet'] as const).filter(m=>
   xendit.paymentEnabled&&xenditChannelsForMethod(m,xendit.channels).length>0)] as PaymentMethod[],
  requires:xendit.missing
 };
 return {
  provider,
  connected:false,
  paymentEnabled:false,
  status:provider?'integration_not_activated':'provider_not_selected',
  environment:'not_connected',
  availableMethods:['bank_transfer'] as PaymentMethod[],
  requires:['merchant_account','sandbox_credentials','signed_webhook','reconciliation_tests','explicit_activation']
 };
}
/** Midtrans notification signature contract, for the future sandbox adapter.
 * Never apply a webhook as paid without confirming provider status, amount,
 * currency, order ownership and state transition in a database transaction.
 */
export function verifyMidtransSignature(input:unknown,serverKey:string):boolean{
 if(!serverKey||serverKey.length<8||!input||typeof input!=='object'||Array.isArray(input))return false;
 const data=input as Record<string,unknown>;
 const fields=['order_id','status_code','gross_amount','signature_key'] as const;
 if(fields.some(key=>typeof data[key]!=='string'))return false;
 const [orderId,statusCode,grossAmount,signature]=fields.map(k=>data[k] as string);
 if(!/^[A-Za-z0-9._~-]{1,50}$/.test(orderId)||!/^[0-9]{3}$/.test(statusCode)||
  !/^[0-9]{1,14}(?:\.0{1,2})?$/.test(grossAmount)||!/^[0-9a-fA-F]{128}$/.test(signature))return false;
 const expected=createHash('sha512').update(orderId+statusCode+grossAmount+serverKey).digest();
 const provided=Buffer.from(signature,'hex');
 return provided.length===expected.length&&timingSafeEqual(provided,expected);
}
export function gatewayAmountMatches(grossAmount:unknown,expectedIdr:number):boolean{
 if(typeof grossAmount!=='string'||!/^[0-9]{1,14}(?:\.0{1,2})?$/.test(grossAmount))return false;
 if(!Number.isSafeInteger(expectedIdr)||expectedIdr<=0)return false;
 return Number(grossAmount)===expectedIdr;
}
