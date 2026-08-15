import L from 'leaflet';

if (typeof window !== 'undefined') {
  (window as any).L = L;
}

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

export default L;
