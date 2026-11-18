'use client';
import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const indonesia = L.latLngBounds([-11.5, 94.5], [6.5, 141.5]);

export default function DestinationMap({initial, region, onConfirm}) {
  const container = useRef(null);
  const [point, setPoint] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const map = L.map(container.current, {scrollWheelZoom:false, maxBounds:indonesia.pad(0.15)})
      .setView(initial ? [initial.latitude, initial.longitude] : [-2, 118], initial ? 18 : 4);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    tiles.on('tileerror', () => setNotice('Sebagian peta gagal dimuat. Anda juga bisa memakai lokasi perangkat atau tautan Google Maps.'));
    function updatePoint() {
      const center = map.getCenter();
      setPoint(map.getZoom() >= 16 && indonesia.contains(center)
        ? {latitude:+center.lat.toFixed(6), longitude:+center.lng.toFixed(6), confirmed:true} : null);
    }
    updatePoint();
    map.on('movestart zoomstart', () => setPoint(null));
    map.on('moveend zoomend', updatePoint);
    map.on('click', e => map.setView(e.latlng, Math.max(map.getZoom(), 16)));
    if (!initial) {
      // Only use the selected administrative area to find a starting viewport.
      let moved = false;
      map.once('movestart', () => { moved = true; });
      const query = new URLSearchParams({q:region+', Indonesia',limit:'1'});
      fetch('https://photon.komoot.io/api/?'+query, {signal:controller.signal,credentials:'omit'})
        .then(response => response.json())
        .then(data => {
          if (moved || controller.signal.aborted) return;
          const coords = data.features?.[0]?.geometry?.coordinates;
          if (coords && indonesia.contains([coords[1],coords[0]])) map.setView([coords[1],coords[0]], 14);
          else setNotice('Wilayah belum ditemukan. Ketuk area tujuan di peta atau gunakan koordinat Google Maps.');
        }).catch(() => {if (!controller.signal.aborted) setNotice('Pilih wilayah tujuan di peta atau gunakan lokasi perangkat.');});
    }
    return () => {controller.abort(); map.remove();};
  }, [region, initial]);
  return <div className="vm-destination-map">
    <p>Geser peta hingga penanda berada tepat di pagar atau lobi penerima. Perbesar untuk memilih titik yang presisi.</p>
    <div className="vm-map-frame"><div ref={container} aria-label="Peta titik antar" /><span aria-hidden="true" /></div>
    {notice && <small role="status">{notice}</small>}
    <button type="button" disabled={!point} onClick={()=>point && onConfirm(point)}>Konfirmasi titik antar</button>
  </div>;
}
