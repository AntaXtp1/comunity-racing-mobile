// ============================================================
// MAIN.JS — Public page rendering + APK list fetch
// ============================================================

let currentLang = localStorage.getItem('lang') || 'id';

document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLang);
  renderNavbar();
  renderHero();
  renderAbout();
  renderTeam();
  renderFooter();
  setupNavbarToggle();
  setupNavbarScroll();
  setupDiscordModal();
  setupNavSocial();
  setupPartnerApk();
  setupLanguageToggle();
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
  const t = SITE_CONFIG.i18n[currentLang];
  document.getElementById('aboutText').textContent = t.aboutDesc;

  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = SITE_CONFIG.about.stats.map(s => `
    <div class="stat-card">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${t['stat' + s.label.replace(/\s/g, '')] || s.label}</div>
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
    let avatarHtml;
    if (m.avatar) {
      avatarHtml = `<img src="${m.avatar}" alt="${m.name}" loading="lazy">`;
    } else if (m.initial) {
      avatarHtml = `<div class="placeholder initial">${m.initial}</div>`;
    } else {
      avatarHtml = `<i class="fa-solid fa-user placeholder"></i>`;
    }
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
    discordMain:    'fa-brands fa-discord',
    discordPartner: 'fa-brands fa-discord',
    whatsapp:       'fa-brands fa-whatsapp',
    youtube:        'fa-brands fa-youtube'
  };

  const labels = {
    discordMain:    'Discord Gran Velocita',
    discordPartner: 'Discord Gran Emozion',
    whatsapp:       'WhatsApp',
    youtube:        'YouTube'
  };

  const socialHtml = Object.entries(SITE_CONFIG.social)
    .filter(([, url]) => url)
    .map(([key, url]) => `
      <a href="${url}" class="social-link" target="_blank" rel="noopener" aria-label="${labels[key]}">
        <i class="${icons[key]}"></i>
      </a>
    `).join('');

  document.getElementById('footerSocial').innerHTML = socialHtml;
}

// ---- Discord Modal ----

function setupDiscordModal() {
  const modal      = document.getElementById('discordModal');
  const btn        = document.getElementById('discordBtn');
  const closeBtn   = document.getElementById('discordModalClose');
  const mainLink   = document.getElementById('discordMainLink');
  const partnerLink = document.getElementById('discordPartnerLink');

  // Set URLs
  mainLink.href   = SITE_CONFIG.social.discordMain;
  partnerLink.href = SITE_CONFIG.social.discordPartner;

  // Open modal
  btn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });
}

// ---- Nav Social Icons ----

function setupNavSocial() {
  const whatsappIcon = document.getElementById('whatsappIcon');
  const youtubeIcon  = document.getElementById('youtubeIcon');

  if (SITE_CONFIG.social.whatsapp) {
    whatsappIcon.href = SITE_CONFIG.social.whatsapp;
  } else {
    whatsappIcon.style.display = 'none';
  }

  if (SITE_CONFIG.social.youtube) {
    youtubeIcon.href = SITE_CONFIG.social.youtube;
    youtubeIcon.style.display = 'flex';
  }
}

// ---- Partner APK ----

function setupPartnerApk() {
  const btn = document.getElementById('partnerDiscordBtn');
  btn.href = SITE_CONFIG.partnerApk.discord;
}

// ---- Language Toggle ----

function setupLanguageToggle() {
  const btn   = document.getElementById('langToggle');
  const label = document.getElementById('langLabel');

  // Set initial label
  label.textContent = currentLang === 'id' ? 'EN' : 'ID';

  btn.addEventListener('click', () => {
    currentLang = currentLang === 'id' ? 'en' : 'id';
    localStorage.setItem('lang', currentLang);
    label.textContent = currentLang === 'id' ? 'EN' : 'ID';
    applyLanguage(currentLang);
  });
}

function applyLanguage(lang) {
  const t = SITE_CONFIG.i18n[lang];
  
  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  
  // Re-render dynamic content
  renderAbout();
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
  const t = SITE_CONFIG.i18n[currentLang];

  try {
    const res = await fetch(`${SITE_CONFIG.apiBaseUrl}/api/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const files = await res.json();

    if (!Array.isArray(files) || files.length === 0) {
      container.innerHTML = `<p class="loading-text">${t.emptyApk}</p>`;
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
          <i class="fa-solid fa-download"></i> ${t.downloadBtn}
        </a>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `<p class="error-text">
      <i class="fa-solid fa-circle-exclamation"></i>
      ${t.errorApk}
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
