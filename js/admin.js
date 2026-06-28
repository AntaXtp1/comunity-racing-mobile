// ============================================================
// ADMIN.JS — Login, file management, storage info
// ============================================================

const TOKEN_KEY  = 'srmc_admin_token';
const TOKEN_TS   = 'srmc_admin_token_ts';
const TOKEN_TTL  = 12 * 3600 * 1000; // 12 hours (matches Worker token expiry)
const apiBase    = SITE_CONFIG.apiBaseUrl;

// ---- Bootstrap ----

document.addEventListener('DOMContentLoaded', () => {
  // Set subtitle from config
  const subtitleEl = document.getElementById('adminSubtitle');
  if (subtitleEl) subtitleEl.textContent = SITE_CONFIG.communityName;

  const token = localStorage.getItem(TOKEN_KEY);
  const ts    = parseInt(localStorage.getItem(TOKEN_TS) || '0');

  // Check if token expired
  if (token && Date.now() - ts > TOKEN_TTL) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TS);
    showLogin();
  } else if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // Event listeners
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('refreshBtn').addEventListener('click', () => loadFileList());
  document.getElementById('togglePw').addEventListener('click', togglePasswordVisibility);

  setupUpload();
});

// ---- Auth ----

async function handleLogin(e) {
  e.preventDefault();
  const password  = document.getElementById('passwordInput').value;
  const errorEl   = document.getElementById('loginError');
  const loginBtn  = document.getElementById('loginBtn');

  errorEl.textContent = '';
  loginBtn.disabled   = true;
  loginBtn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const res = await fetch(`${apiBase}/api/auth`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Password salah');
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(TOKEN_TS, String(Date.now()));
    showDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    loginBtn.disabled  = false;
    loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Masuk';
  }
}

function handleLogout() {
  if (!confirm('Yakin mau logout?')) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_TS);
  showLogin();
}

function showLogin() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('dashboardView').hidden    = true;
  document.getElementById('passwordInput').value     = '';
  document.getElementById('loginError').textContent  = '';
}

function showDashboard() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashboardView').hidden    = false;
  loadStorageInfo();
  loadFileList();
}

function togglePasswordVisibility() {
  const input = document.getElementById('passwordInput');
  const icon  = document.querySelector('#togglePw i');
  if (input.type === 'password') {
    input.type      = 'text';
    icon.className  = 'fa-solid fa-eye-slash';
  } else {
    input.type      = 'password';
    icon.className  = 'fa-solid fa-eye';
  }
}

// ---- Storage info ----

async function loadStorageInfo() {
  const pctEl   = document.getElementById('storagePct');
  const fillEl  = document.getElementById('storageFill');
  const labelEl = document.getElementById('storageLabel');

  try {
    const res = await authFetch('/api/storage');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const pct    = Math.min(data.percentage, 100).toFixed(1);
    const used   = formatSize(data.usedBytes);
    const total  = formatSize(data.totalBytes);

    pctEl.textContent   = `${pct}%`;
    fillEl.style.width  = `${pct}%`;
    labelEl.textContent = `${used} digunakan dari ${total}`;

    // Color coding
    fillEl.className = 'progress-fill';
    if (data.percentage >= 90) fillEl.classList.add('danger');
    else if (data.percentage >= 70) fillEl.classList.add('warn');

  } catch (err) {
    pctEl.textContent   = '—';
    labelEl.textContent = 'Gagal memuat info storage.';
    console.error('[Storage]', err);
  }
}

// ---- File list ----

async function loadFileList() {
  const listEl = document.getElementById('fileList');
  listEl.innerHTML = '<p class="loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</p>';

  try {
    const res = await fetch(`${apiBase}/api/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const files = await res.json();

    if (!Array.isArray(files) || files.length === 0) {
      listEl.innerHTML = '<p class="loading-text">Belum ada file di storage.</p>';
      return;
    }

    listEl.innerHTML = files.map(f => `
      <div class="file-row" id="row-${escapeId(f.name)}">
        <div class="file-info">
          <div class="file-icon"><i class="fa-brands fa-android"></i></div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
            <div class="file-meta">${formatSize(f.size)} &bull; ${formatDate(f.uploaded)}</div>
          </div>
        </div>
        <button class="btn-delete" data-name="${escapeHtml(f.name)}">
          <i class="fa-solid fa-trash"></i> Hapus
        </button>
      </div>
    `).join('');

    // Wire delete buttons
    listEl.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.name, btn));
    });

  } catch (err) {
    listEl.innerHTML = '<p class="loading-text">Gagal memuat daftar file.</p>';
    console.error('[FileList]', err);
  }
}

// ---- Delete ----

async function handleDelete(name, btn) {
  if (!confirm(`Hapus "${name}"?\nFile tidak bisa dikembalikan.`)) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const res = await authFetch(`/api/delete/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal menghapus');
    }

    // Remove row smoothly
    const row = document.getElementById(`row-${escapeId(name)}`);
    if (row) row.remove();

    // Reload storage after delete
    loadStorageInfo();

    // Show empty state if no rows left
    const listEl = document.getElementById('fileList');
    if (!listEl.querySelector('.file-row')) {
      listEl.innerHTML = '<p class="loading-text">Belum ada file di storage.</p>';
    }

  } catch (err) {
    alert(`Error: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Hapus';
  }
}

// ---- Upload ----

let currentXhr = null; // Track current upload for cancellation

function setupUpload() {
  const dropzone  = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const cancelBtn = document.getElementById('cancelUploadBtn');

  // File input change
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
    fileInput.value = ''; // reset so same file can be picked again
  });

  // Cancel upload
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (currentXhr) {
        currentXhr.abort();
        currentXhr = null;
      }
    });
  }

  // Drag events
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  });
}

async function handleUpload(file) {
  // Validasi longgar — hanya blok file tanpa ekstensi sama sekali
  const nameLower = file.name.toLowerCase();
  if (!nameLower.includes('.')) {
    showUploadResult('error', 'File harus memiliki ekstensi (contoh: .apk, .zip).');
    return;
  }

  const progressEl  = document.getElementById('uploadProgress');
  const fillEl      = document.getElementById('uploadFill');
  const labelEl     = document.getElementById('uploadLabel');
  const cancelBtn   = document.getElementById('cancelUploadBtn');

  progressEl.hidden = false;
  fillEl.style.width  = '0%';
  labelEl.textContent = `Mempersiapkan upload ${file.name}...`;
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  try {
    // 1. Minta presigned URL dari Worker
    const presignRes = await authFetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name })
    });

    if (!presignRes.ok) {
      const errData = await presignRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal mempersiapkan upload');
    }

    const { url } = await presignRes.json();

    // 2. Upload langsung ke R2 pakai presigned URL (bypass Worker!)
    labelEl.textContent = `Mengupload ${file.name}...`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;

      // Set timeout — 10 menit max
      xhr.timeout = 600000;

      xhr.open('PUT', url);
      // Set Content-Type supaya R2 menerima file dengan benar
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          fillEl.style.width  = `${pct}%`;
          labelEl.textContent = `Mengupload ${pct}% — ${file.name}`;
        }
      };

      xhr.onload = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';

        if (xhr.status >= 200 && xhr.status < 300) {
          showUploadResult('success', `✓ ${file.name} berhasil diupload`);
          loadFileList();
          loadStorageInfo();
        } else {
          showUploadResult('error', `✗ Upload gagal (HTTP ${xhr.status}). Coba upload dari dashboard R2.`);
        }
        resolve();
      };

      xhr.onerror = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Koneksi gagal. Cek internet atau coba upload dari dashboard R2.');
        resolve();
      };

      xhr.ontimeout = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Upload timeout. File terlalu besar atau koneksi lambat.');
        resolve();
      };

      xhr.onabort = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Upload dibatalkan.');
        resolve();
      };

      xhr.send(file);
    });

  } catch (err) {
    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';
    showUploadResult('error', `✗ ${err.message}`);
  }
}

function showUploadResult(type, message) {
  const el = document.getElementById('uploadResult');
  el.className    = `upload-result ${type}`;
  el.textContent  = message;
  // Auto-clear after 5 seconds
  setTimeout(() => { el.textContent = ''; }, 5000);
}

// ---- Helpers ----

function authFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    }
  });
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)      return bytes + ' B';
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

function formatDate(ts) {
  if (!ts) return '—';
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

function escapeId(str) {
  return String(str).replace(/[^a-zA-Z0-9-_]/g, '_');
}
