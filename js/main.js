// ============================================================
// MAIN.JS — Public page rendering + APK list fetch
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderHero();
  renderAbout();
  renderTeam();
  renderFooter();
  setupNavbarToggle();
  setupNavbarScroll();
  fetchApkList();
});

// ---- Content rendering from SITE_CONFIG ----

function renderNavbar() {
  document.getElementById('navLogo').textContent = SITE_CONFIG.communityName;
  document.title = SITE_CONFIG.communityName;
}

function renderHero() {
  document.getElementById('heroTitle').textContent = SITE_CONFIG.communityName;
  document.getElementById('heroTagline').textContent = SITE_CONFIG.tagline;

  const discordBtn = document.getElementById('heroDiscord');
  if (SITE_CONFIG.social.discord) {
    discordBtn.href = SITE_CONFIG.social.discord;
  } else {
    discordBtn.style.display = 'none';
  }
}

function renderAbout() {
  document.getElementById('aboutText').textContent = SITE_CONFIG.about.description;

  // Stats
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = SITE_CONFIG.about.stats.map(s => `
    <div class="stat-card">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // Platform + game tags
  const platformsRow = document.getElementById('platformsRow');
  const tags = [...SITE_CONFIG.about.platforms, ...SITE_CONFIG.about.games];
  platformsRow.innerHTML = tags.map(t => `<span class="platform-tag">${t}</span>`).join('');
}

function renderTeam() {
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = SITE_CONFIG.members.map(m => {
    const color = SITE_CONFIG.roleColors[m.role] || '#5a5a60';
    const avatarHtml = m.avatar
      ? `<img src="${m.avatar}" alt="${m.name}" loading="lazy">`
      : `<i class="fa-solid fa-user placeholder"></i>`;
    return `
      <div class="member-card" style="--role-color:${color}">
        <div class="member-avatar">${avatarHtml}</div>
        <div class="member-name">${m.name}</div>
        <span class="member-role">${m.role}</span>
      </div>
    `;
  }).join('');
}

function renderFooter() {
  document.getElementById('footerName').textContent = SITE_CONFIG.communityName;
  document.getElementById('footerCopy').textContent =
    `© ${new Date().getFullYear()} ${SITE_CONFIG.communityName}`;

  const icons = {
    youtube:  'fa-brands fa-youtube',
    whatsapp: 'fa-brands fa-whatsapp',
    discord:  'fa-brands fa-discord'
  };

  const socialHtml = Object.entries(SITE_CONFIG.social)
    .filter(([, url]) => url)
    .map(([key, url]) => `
      <a href="${url}" class="social-link" target="_blank" rel="noopener" aria-label="${key}">
        <i class="${icons[key]}"></i>
      </a>
    `).join('');

  document.getElementById('footerSocial').innerHTML = socialHtml;
}

// ---- Navbar interactions ----

function setupNavbarToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');

  toggle.addEventListener('click', () => {
    links.classList.toggle('active');
  });

  // Close when a link is clicked
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => links.classList.remove('active'));
  });
}

function setupNavbarScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.style.borderBottomColor = window.scrollY > 20
      ? 'rgba(58, 61, 67, 0.8)'
      : 'var(--border)';
  }, { passive: true });
}

// ---- APK list fetch ----

async function fetchApkList() {
  const container = document.getElementById('apkList');

  try {
    const res = await fetch(`${SITE_CONFIG.apiBaseUrl}/api/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const files = await res.json();

    if (!Array.isArray(files) || files.length === 0) {
      container.innerHTML = '<p class="loading-text">Belum ada APK tersedia.</p>';
      return;
    }

    container.innerHTML = files.map(f => `
      <div class="apk-card">
        <div class="apk-info">
          <div class="apk-icon"><i class="fa-brands fa-android"></i></div>
          <div>
            <div class="apk-name">${escapeHtml(f.name)}</div>
            <div class="apk-meta">${formatSize(f.size)} &bull; ${formatDate(f.uploaded)}</div>
          </div>
        </div>
        <a href="${SITE_CONFIG.apiBaseUrl}/api/download/${encodeURIComponent(f.name)}"
           class="btn-download" download>
          <i class="fa-solid fa-download"></i> Download
        </a>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `<p class="error-text">
      <i class="fa-solid fa-circle-exclamation"></i>
      Gagal memuat daftar APK. Coba lagi nanti.
    </p>`;
    console.error('[APK fetch]', err);
  }
}

// ---- Utility helpers ----

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1_048_576)  return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
