import {googleMapsPinUrl,type DeliveryPin} from '@/lib/delivery-pin';
export function DeliveryPinLink({pin}:{pin?:DeliveryPin|null}){
 if(!pin||pin.confirmed!==true||!Number.isFinite(pin.latitude)||!Number.isFinite(pin.longitude))return null;
 return <p><a target="_blank" rel="noopener noreferrer" href={googleMapsPinUrl(pin)}>📍 Pin tujuan Google Maps ↗</a><br/><small>{pin.latitude}, {pin.longitude}</small></p>;
}
