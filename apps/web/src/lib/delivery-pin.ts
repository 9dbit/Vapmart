export type DeliveryPin={latitude:number;longitude:number;confirmed:true};
export function googleMapsPinUrl(pin:DeliveryPin){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(pin.latitude+','+pin.longitude);}
