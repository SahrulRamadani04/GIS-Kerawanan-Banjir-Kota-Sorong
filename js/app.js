/**
 * WebGIS Kerawanan Banjir Kota Sorong
 * Main Application JavaScript
 * Handles: navbar, animations, scroll effects, charts
 */

// ============================================================
// Navbar functionality
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollAnimations();
  initCharts();
  loadStatistics();
});

function initNavbar() {
  const navbar = document.getElementById('navbar');
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  // Scroll effect
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Mobile toggle
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      mobileToggle.textContent = navMenu.classList.contains('open') ? '✕' : '☰';
    });

    // Close menu on link click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.textContent = '☰';
      });
    });
  }
}

// ============================================================
// Scroll Animations (Intersection Observer)
// ============================================================

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger animation
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.fade-in, .slide-in-left').forEach(el => {
    observer.observe(el);
  });
}

// ============================================================
// Statistics Data
// ============================================================

// Fallback demo data based on actual preprocessing results.
const DEMO_STATS = {
  'Sangat Rendah': { count: 0, percentage: 0 },
  'Rendah': { count: 6615, percentage: 22.8 },
  'Sedang': { count: 15704, percentage: 54.1 },
  'Tinggi': { count: 6708, percentage: 23.1 },
  'Sangat Tinggi': { count: 0, percentage: 0 }
};

function loadStatistics() {
  // Try web-optimized version first, then full, then demo
  const webPath = getDataPath('kerawanan_banjir_web.geojson');
  const fullPath = getDataPath('kerawanan_banjir.geojson');

  fetch(webPath)
    .then(res => {
      if (!res.ok) throw new Error('Web version not found');
      return res.json();
    })
    .catch(() => {
      return fetch(fullPath).then(res => {
        if (!res.ok) throw new Error('Full version not found');
        return res.json();
      });
    })
    .then(data => {
      const stats = calculateStats(data.features);
      updateStatsUI(stats);
    })
    .catch(() => {
      // Use demo data
      updateStatsUI(DEMO_STATS);
    });
}

function getDataPath(filename) {
  // Determine correct path based on current page location
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    return `../public/data/${filename}`;
  }
  return `public/data/${filename}`;
}

function calculateStats(features) {
  const stats = {};
  const total = features.length;

  features.forEach(f => {
    const cat = f.properties.Tingkat_Kerawanan || f.properties['Tingkat Ke'] || 'Tidak diketahui';
    if (!stats[cat]) {
      stats[cat] = { count: 0, percentage: 0 };
    }
    stats[cat].count++;
  });

  // Calculate percentages
  Object.keys(stats).forEach(key => {
    stats[key].percentage = ((stats[key].count / total) * 100).toFixed(1);
  });

  return stats;
}

function updateStatsUI(stats) {
  const mappings = {
    'Rendah': { el: 'stat-r', pctEl: 'stat-r-pct' },
    'Sedang': { el: 'stat-s', pctEl: 'stat-s-pct' },
    'Tinggi': { el: 'stat-t', pctEl: 'stat-t-pct' }
  };

  Object.entries(mappings).forEach(([key, { el, pctEl }]) => {
    const valueEl = document.getElementById(el);
    const pctElement = document.getElementById(pctEl);
    if (valueEl && stats[key]) {
      animateCounter(valueEl, stats[key].count);
      if (pctElement) {
        pctElement.textContent = `${stats[key].percentage}% dari total area`;
      }
    } else if (valueEl) {
      valueEl.textContent = '0';
      if (pctElement) pctElement.textContent = '0%';
    }
  });
}

function animateCounter(element, target) {
  const duration = 1500;
  const start = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + (target - startValue) * eased);

    element.textContent = current.toLocaleString('id-ID');

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// ============================================================
// Charts (Chart.js)
// ============================================================

function initCharts() {
  const barCanvas = document.getElementById('barChart');
  const doughnutCanvas = document.getElementById('doughnutChart');

  if (!barCanvas || !doughnutCanvas) return;

  // Wait for Chart.js to load
  if (typeof Chart === 'undefined') {
    setTimeout(initCharts, 100);
    return;
  }

  const labels = ['Rendah', 'Sedang', 'Tinggi'];
  const colors = ['#32CD32', '#FFD700', '#FF8C00'];
  const bgColors = [
    'rgba(50, 205, 50, 0.7)',
    'rgba(255, 215, 0, 0.7)',
    'rgba(255, 140, 0, 0.7)'
  ];

  // Try to load real data (web-optimized first)
  const webPath = getDataPath('kerawanan_banjir_web.geojson');
  const fullPath = getDataPath('kerawanan_banjir.geojson');

  fetch(webPath)
    .then(res => {
      if (!res.ok) throw new Error('Web version not found');
      return res.json();
    })
    .catch(() => {
      return fetch(fullPath).then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      });
    })
    .then(data => {
      const stats = calculateStats(data.features);
      const values = labels.map(l => (stats[l] ? stats[l].count : 0));
      createCharts(barCanvas, doughnutCanvas, labels, values, colors, bgColors);
    })
    .catch(() => {
      // Use demo data
      const values = [
        DEMO_STATS['Rendah'].count,
        DEMO_STATS['Sedang'].count,
        DEMO_STATS['Tinggi'].count
      ];
      createCharts(barCanvas, doughnutCanvas, labels, values, colors, bgColors);
    });
}

function createCharts(barCanvas, doughnutCanvas, labels, values, colors, bgColors) {
  // Configure Chart.js defaults
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;

  // Bar Chart
  new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Jumlah Area',
        data: values,
        backgroundColor: bgColors,
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          borderColor: 'rgba(148, 163, 184, 0.1)',
          borderWidth: 1,
          titleFont: { weight: 600 },
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(148, 163, 184, 0.05)' },
          ticks: { font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.05)' },
          ticks: { font: { size: 10 } }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });

  // Doughnut Chart
  new Chart(doughnutCanvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyleWidth: 12,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          borderColor: 'rgba(148, 163, 184, 0.1)',
          borderWidth: 1,
          titleFont: { weight: 600 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((context.raw / total) * 100).toFixed(1);
              return ` ${context.label}: ${context.raw.toLocaleString('id-ID')} area (${pct}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}
