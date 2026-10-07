import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const displayMap = locations => {
  const points = locations.filter(location => Array.isArray(location.coordinates) &&
    location.coordinates.length === 2 && location.coordinates.every(Number.isFinite));
  const element = document.getElementById('map');
  if (!points.length) {
    element.closest('.section-map').hidden = true;
    return;
  }
  const map = L.map(element, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    // OSM requires a Referer; override the page's no-referrer policy only for tiles.
    // Send the app origin without exposing the tour path or query parameters.
    referrerPolicy: 'strict-origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const icon = L.divIcon({ className: 'marker', iconSize: [32, 40], iconAnchor: [16, 40] });
  const bounds = [];
  points.forEach(point => {
    const latlng = [point.coordinates[1], point.coordinates[0]];
    const label = document.createElement('p');
    label.textContent = `Day ${point.day}: ${point.description}`;
    L.marker(latlng, { icon }).addTo(map).bindPopup(label);
    bounds.push(latlng);
  });
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
};
