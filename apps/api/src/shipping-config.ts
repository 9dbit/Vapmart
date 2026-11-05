export function shippingProvider(){return process.env.SHIPPING_PROVIDER==='jubelio'?'jubelio':'biteship';}
export function shippingSnapshotProvider(){return shippingProvider()==='jubelio'?'jubelio':'biteship_test';}
export function jubelioConfigured(){return Boolean(process.env.JUBELIO_SHIPMENT_CLIENT_ID?.trim()&&process.env.JUBELIO_SHIPMENT_CLIENT_SECRET?.trim());}
export function shippingConfig(){
 const provider=shippingProvider(),postal=process.env.SHIPPING_ORIGIN_POSTAL_CODE||'';
 const originReady=/^\d{5}$/.test(postal)&&(provider!=='jubelio'||/^\d{10}$/.test(process.env.JUBELIO_SHIPMENT_ORIGIN_AREA_ID||''));
 const credentialsReady=provider==='jubelio'?jubelioConfigured():Boolean(process.env.BITESHIP_API_KEY?.startsWith('biteship_test.'));
 return {provider,rateLookupEnabled:process.env.SHIPPING_RATE_LOOKUP_ENABLED==='true'&&originReady&&credentialsReady,
  credentialsConfigured:credentialsReady,originConfigured:originReady,requiresArea:provider==='jubelio',
  originPostalCode:postal,originLabel:process.env.SHIPPING_ORIGIN_LABEL||'',
  bookingEnabled:false,paymentEnabled:false,insuranceIncluded:provider==='jubelio',
  rateType:provider==='jubelio'?'live_quote':'sandbox_snapshot',ttlMinutes:15};
}
