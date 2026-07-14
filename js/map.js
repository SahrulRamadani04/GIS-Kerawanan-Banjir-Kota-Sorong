/**
 * WebGIS Kerawanan Banjir Kota Sorong
 * Map Page JavaScript
 * Handles: Leaflet map, GeoJSON layers, sidebar, filters, search, basemaps
 */

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  // Center of Kota Sorong
  center: [-0.88, 131.25],
  zoom: 12,
  minZoom: 10,
  maxZoom: 18,

  // Bounding box Kota Sorong (approximate)
  bounds: [
    [-0.96, 131.10],  // SW
    [-0.80, 131.40]   // NE
  ],

  // Kerawanan color mapping
  colors: {
    'Sangat Rendah': '#006400',
    'Rendah': '#32CD32',
    'Sedang': '#FFD700',
    'Tinggi': '#FF8C00',
    'Sangat Tinggi': '#FF0000'
  },

  // Style
  polygonOpacity: 0.85,
  borderColor: '#000000',
  borderWeight: 0,

  // Data paths (try web-optimized first, fallback to full)
  dataPathFull: '../public/data/kerawanan_banjir_clipped.geojson',
  dataPathWeb: '../public/data/kerawanan_banjir_clipped.geojson',
  dataPathDistricts: '../public/data/distrik_sorong.geojson',
};

// ============================================================
// Basemap Layers
// ============================================================

const BASEMAPS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 18
    }
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17
    }
  }
};

// ============================================================
// Global State
// ============================================================

let map = null;
let currentBasemap = null;
let geojsonLayer = null;
let allFeatures = [];
let filteredFeatures = [];
let isLayerVisible = true;

// ============================================================
// Initialize Map
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initSidebar();
  initNavbar();
  loadGeoJSON();
});

function initMap() {
  map = L.map('map', {
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    zoomControl: false,
    attributionControl: true
  });

  // Set max bounds
  map.setMaxBounds(L.latLngBounds(
    L.latLng(CONFIG.bounds[0][0] - 0.2, CONFIG.bounds[0][1] - 0.2),
    L.latLng(CONFIG.bounds[1][0] + 0.2, CONFIG.bounds[1][1] + 0.2)
  ));

  // Add default basemap
  setBasemap('osm');

  // Add controls
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

  // Fullscreen control
  if (L.control.fullscreen) {
    L.control.fullscreen({ position: 'topright' }).addTo(map);
  }

  // Mouse coordinate tracking
  map.on('mousemove', (e) => {
    const coordDisplay = document.getElementById('coordDisplay');
    if (coordDisplay) {
      coordDisplay.textContent = `Lat: ${e.latlng.lat.toFixed(4)} | Lng: ${e.latlng.lng.toFixed(4)}`;
    }
  });

  // Basemap buttons
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setBasemap(btn.dataset.basemap);
    });
  });

  // Info panel close
  const infoPanelClose = document.getElementById('infoPanelClose');
  if (infoPanelClose) {
    infoPanelClose.addEventListener('click', () => {
      document.getElementById('infoPanel').classList.remove('visible');
    });
  }
}

function setBasemap(name) {
  if (currentBasemap) {
    map.removeLayer(currentBasemap);
  }
  const { url, options } = BASEMAPS[name];
  currentBasemap = L.tileLayer(url, options).addTo(map);
}

// ============================================================
// Load Data Functions
// ============================================================

function loadDistricts() {
  fetch(CONFIG.dataPathDistricts)
    .then(res => res.json())
    .then(data => {
      districtFeatures = data.features;
      const select = document.getElementById('filterLokasi');
      if (select) {
        select.innerHTML = '<option value="">-- Semua Wilayah --</option>';
        districtFeatures.forEach((f, idx) => {
          const name = f.properties.KECAMATAN;
          const option = document.createElement('option');
          option.value = idx;
          option.textContent = name;
          select.appendChild(option);
        });
      }
    })
    .catch(err => console.error('Error loading districts:', err));
}

function loadGeoJSON() {
  const loading = document.getElementById('loadingOverlay');

  loadDistricts();

  const cacheBuster = '?v=' + new Date().getTime();
  const webPath = CONFIG.dataPathWeb + cacheBuster;
  const fullPath = CONFIG.dataPathFull + cacheBuster;

  fetch(webPath)
    .then(res => {
      if (!res.ok) throw new Error('Web version not found');
      return res.json();
    })
    .catch(() => {
      // Fallback to full version
      return fetch(fullPath).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    })
    .then(data => {
      allFeatures = data.features || [];
      filteredFeatures = [...allFeatures];
      renderGeoJSON(filteredFeatures);
      updateSidebarStats(allFeatures);
      if (loading) loading.classList.add('hidden');
    })
    .catch(err => {
      console.warn('GeoJSON not found. Showing demo message:', err.message);
      if (loading) {
        loading.innerHTML = `
          <div style="text-align: center; max-width: 500px; padding: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Data GeoJSON Belum Tersedia</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6; margin-bottom: 1.5rem;">
              File <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">public/data/kerawanan_banjir.geojson</code>
              belum ditemukan.<br><br>
              Untuk memproses data GeoJSON, jalankan script preprocessing:
            </p>
            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; text-align: left; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-accent);">
              <div style="color: var(--text-muted); margin-bottom: 0.5rem;"># Install dependency</div>
              pip install pyproj<br><br>
              <div style="color: var(--text-muted); margin-bottom: 0.5rem;"># Jalankan preprocessing</div>
              python scripts/preprocess_geojson.py
            </div>
            <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 1rem;">
              Script akan mengkonversi data dari EPSG:32752 ke EPSG:4326 dan menyimpannya di folder public/data/
            </p>
          </div>
        `;
      }
      // Still show the map underneath
      addDemoData();
    });
}

function addDemoData() {
  // Add a marker at Kota Sorong center for reference
  L.marker(CONFIG.center)
    .addTo(map)
    .bindPopup('<b>Kota Sorong</b><br>Pusat koordinat peta')
    .openPopup();
}

// ============================================================
// Render GeoJSON on Map
// ============================================================

function renderGeoJSON(features, autoFit = true) {
  // Remove existing layer
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  const geojsonData = {
    type: 'FeatureCollection',
    features: features
  };

  geojsonLayer = L.geoJSON(geojsonData, {
    style: styleFeature,
    onEachFeature: onEachFeature
  });

  if (isLayerVisible) {
    geojsonLayer.addTo(map);
  }

  // Fit bounds to data
  if (autoFit && features.length > 0) {
    try {
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (e) {
      console.warn('Could not fit bounds:', e);
    }
  }
}

function styleFeature(feature) {
  const kerawanan = feature.properties.Tingkat_Kerawanan ||
                    feature.properties['Tingkat Ke'] ||
                    'Tidak diketahui';

  return {
    fillColor: CONFIG.colors[kerawanan] || '#888888',
    weight: CONFIG.borderWeight,
    opacity: 1,
    color: CONFIG.borderColor,
    fillOpacity: CONFIG.polygonOpacity
  };
}

function onEachFeature(feature, layer) {
  const props = feature.properties;
  const kerawanan = props.Tingkat_Kerawanan || props['Tingkat Ke'] || '-';
  const skor = props.Total_Skor || '-';
  const remark = props.REMARK || props.REMARK_2 || '-';
  const distance = props.distance || '-';

  // Popup
  const badgeClass = kerawanan.toLowerCase().replace(/\s+/g, '-');
  const popupContent = `
    <div class="custom-popup">
      <h4>${remark}</h4>
      <div class="popup-row">
        <span class="popup-label">Tingkat Kerawanan</span>
        <span class="popup-value"><span class="kerawanan-badge ${badgeClass}">${kerawanan}</span></span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Total Skor</span>
        <span class="popup-value">${skor}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Jarak Sungai</span>
        <span class="popup-value">${distance !== '-' ? distance + ' m' : '-'}</span>
      </div>
      ${props.DEM ? `<div class="popup-row"><span class="popup-label">DEM</span><span class="popup-value">${props.DEM}</span></div>` : ''}
      ${props.SLP ? `<div class="popup-row"><span class="popup-label">Kemiringan</span><span class="popup-value">${props.SLP}</span></div>` : ''}
    </div>
  `;

  layer.bindPopup(popupContent, {
    maxWidth: 280,
    className: 'custom-popup-wrapper'
  });

  // Hover effects
  layer.on({
    mouseover: (e) => {
      const l = e.target;
      l.setStyle({
        weight: 3,
        color: '#38bdf8',
        fillOpacity: 0.8
      });
      l.bringToFront();
    },
    mouseout: (e) => {
      geojsonLayer.resetStyle(e.target);
    },
    click: (e) => {
      showInfoPanel(props);
    }
  });
}

// ============================================================
// Info Panel
// ============================================================

function showInfoPanel(props) {
  const panel = document.getElementById('infoPanel');
  const title = document.getElementById('infoPanelTitle');
  const content = document.getElementById('infoPanelContent');

  if (!panel || !content) return;

  const kerawanan = props.Tingkat_Kerawanan || props['Tingkat Ke'] || '-';
  const badgeClass = kerawanan.toLowerCase().replace(/\s+/g, '-');

  title.textContent = props.REMARK || props.REMARK_2 || 'Area';

  content.innerHTML = `
    <div class="info-row">
      <span class="info-label">Kerawanan</span>
      <span class="info-value"><span class="kerawanan-badge ${badgeClass}">${kerawanan}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">Total Skor</span>
      <span class="info-value">${props.Total_Skor || '-'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Skor Lahan</span>
      <span class="info-value">${props.Skor_Lhn || '-'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Jarak Sungai</span>
      <span class="info-value">${props.distance ? props.distance + ' m' : '-'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Ring ID</span>
      <span class="info-value">${props.ringId || '-'}</span>
    </div>
    ${props.DEM ? `<div class="info-row"><span class="info-label">DEM</span><span class="info-value">${props.DEM}</span></div>` : ''}
    ${props.SLP ? `<div class="info-row"><span class="info-label">Kemiringan</span><span class="info-value">${props.SLP}</span></div>` : ''}
    ${props.layer ? `<div class="info-row"><span class="info-label">Layer</span><span class="info-value" style="font-size:0.7rem; word-break:break-all;">${props.layer.split('—').pop().trim()}</span></div>` : ''}
  `;

  panel.classList.add('visible');
}

// ============================================================
// Sidebar Controls
// ============================================================

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const closeSidebar = document.getElementById('closeSidebar');

  // Toggle sidebar
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
      // Invalidate map size after transition
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  if (closeSidebar) {
    closeSidebar.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      sidebarToggle.textContent = '▶';
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  // Layer toggle
  const layerCheckbox = document.getElementById('layer-kerawanan');
  if (layerCheckbox) {
    layerCheckbox.addEventListener('change', (e) => {
      isLayerVisible = e.target.checked;
      if (geojsonLayer) {
        if (isLayerVisible) {
          geojsonLayer.addTo(map);
        } else {
          map.removeLayer(geojsonLayer);
        }
      }
    });
  }

  // Filter - Kerawanan
  const filterKerawanan = document.getElementById('filterKerawanan');
  if (filterKerawanan) {
    filterKerawanan.addEventListener('change', applyFilters);
  }

  // Filter - Lokasi
  const filterLokasi = document.getElementById('filterLokasi');
  if (filterLokasi) {
    filterLokasi.addEventListener('change', applyFilters);
  }
}

// Helper function to get approximate center of a feature
function getFeatureCenter(feature) {
  try {
    let coords = feature.geometry.coordinates;
    while (coords && Array.isArray(coords[0])) {
      coords = coords[0];
    }
    if (coords && coords.length >= 2) {
      return [coords[1], coords[0]]; // [lat, lng]
    }
  } catch (e) {}
  return null;
}

let districtBoundaryLayer = null;

function applyFilters() {
  const kerawananFilter = document.getElementById('filterKerawanan')?.value || '';
  const lokasiFilter = document.getElementById('filterLokasi')?.value || '';

  // clear district boundary if any
  if (districtBoundaryLayer) {
    map.removeLayer(districtBoundaryLayer);
    districtBoundaryLayer = null;
  }

  let selectedDistrictPolygon = null;
  if (lokasiFilter !== '' && districtFeatures[lokasiFilter]) {
    selectedDistrictPolygon = districtFeatures[lokasiFilter];
  }

  // Filter polygons
  filteredFeatures = allFeatures.filter(f => {
    const props = f.properties;
    const kerawanan = props.Tingkat_Kerawanan || props['Tingkat Ke'] || '';

    // Kerawanan filter
    if (kerawananFilter && kerawanan !== kerawananFilter) return false;

    // Exact District Boundary check using pre-processed KECAMATAN attribute
    if (selectedDistrictPolygon) {
      const selectedName = selectedDistrictPolygon.properties.KECAMATAN;
      const featureDistrict = props.KECAMATAN;
      if (featureDistrict !== selectedName) {
        return false;
      }
    }

    return true;
  });

  renderGeoJSON(filteredFeatures, false);

  // Navigate to district if selected
  if (selectedDistrictPolygon && map) {
    if (selectedDistrictPolygon.geometry) {
      try {
        // Draw the exact district boundary on map to show accuracy
        districtBoundaryLayer = L.geoJSON(selectedDistrictPolygon, {
          style: {
            color: '#FF0000',
            weight: 3,
            dashArray: '5, 10',
            fillOpacity: 0
          }
        }).addTo(map);

        map.fitBounds(districtBoundaryLayer.getBounds(), {
          padding: [20, 20],
          animate: true,
          duration: 1.5
        });
      } catch(e) {}
    }
  } else if (map && filteredFeatures.length > 0) {
    // Reset zoom if no location selected
    const bounds = geojsonLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  updateSidebarStats(filteredFeatures);
}

function updateSidebarStats(features) {
  const statsEl = document.getElementById('sidebarStats');
  if (!statsEl) return;

  const stats = {};
  features.forEach(f => {
    const cat = f.properties.Tingkat_Kerawanan || f.properties['Tingkat Ke'] || 'Lainnya';
    stats[cat] = (stats[cat] || 0) + 1;
  });

  const total = features.length;
  const order = ['Rendah', 'Sedang', 'Tinggi'];

  let html = `<div style="margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Total: ${total.toLocaleString('id-ID')} area</div>`;

  order.forEach(cat => {
    const count = stats[cat] || 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    const color = CONFIG.colors[cat] || '#888';

    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; font-size: 0.78rem;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 10px; height: 10px; background: ${color}; border-radius: 2px; flex-shrink: 0;"></span>
          <span>${cat}</span>
        </div>
        <span style="font-family: var(--font-mono); color: var(--text-primary);">${count} <span style="color: var(--text-muted);">(${pct}%)</span></span>
      </div>
    `;
  });

  // Progress bars
  html += '<div style="margin-top: 12px;">';
  order.forEach(cat => {
    const count = stats[cat] || 0;
    const pct = total > 0 ? ((count / total) * 100) : 0;
    const color = CONFIG.colors[cat] || '#888';

    html += `
      <div style="margin-bottom: 4px;">
        <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 2px; transition: width 0.5s ease;"></div>
        </div>
      </div>
    `;
  });
  html += '</div>';

  statsEl.innerHTML = html;
}

// ============================================================
// Navbar (shared with map page)
// ============================================================

function initNavbar() {
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      mobileToggle.textContent = navMenu.classList.contains('open') ? '✕' : '☰';
    });

    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.textContent = '☰';
      });
    });
  }
}
