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

    listEl.innerHTML = files.map(f => {
      const displayName = truncateFileName(f.name, 35);
      const safeId = escapeId(f.name);
      return `
      <div class="file-row" id="row-${safeId}">
        <div class="file-info">
          <div class="file-icon"><i class="fa-brands fa-android"></i></div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(displayName)}</div>
            <div class="file-meta">${formatSize(f.size)} &bull; ${formatDate(f.uploaded)}</div>
          </div>
        </div>
        <button class="btn-delete" data-name="${escapeHtml(f.name)}" data-id="${safeId}">
          <i class="fa-solid fa-trash"></i> Hapus
        </button>
      </div>
    `}).join('');

    // Wire delete buttons
    listEl.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(btn.dataset.name, btn.dataset.id, btn));
    });

  } catch (err) {
    listEl.innerHTML = '<p class="loading-text">Gagal memuat daftar file.</p>';
    console.error('[FileList]', err);
  }
}

// ---- Delete ----

async function handleDelete(name, rowId, btn) {
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

    // Remove row smoothly using rowId
    const row = document.getElementById(`row-${rowId}`);
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

  const fileSizeMB = (file.size / 1048576).toFixed(1);
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
  const FILE_SIZE_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold for multipart

  // Decide upload strategy based on file size
  if (file.size > FILE_SIZE_THRESHOLD) {
    // Use multipart upload for large files
    return handleMultipartUpload(file, progressEl, fillEl, labelEl, cancelBtn);
  } else {
    // Use regular upload for small files
    return handleRegularUpload(file, progressEl, fillEl, labelEl, cancelBtn);
  }
}

// Regular upload for files <100MB
async function handleRegularUpload(file, progressEl, fillEl, labelEl, cancelBtn) {
  const fileSizeMB = (file.size / 1048576).toFixed(1);
  
  try {
    // 1. Minta presigned POST data dari Worker
    const presignRes = await authFetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name })
    });

    if (!presignRes.ok) {
      const errData = await presignRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal mempersiapkan upload');
    }

    const { url, fields } = await presignRes.json();

    // 2. Buat FormData dengan policy fields + file
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    formData.append('file', file);

    // 3. Upload langsung ke R2 pakai POST
    labelEl.textContent = `Mengupload ${file.name} (${fileSizeMB} MB)...`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      currentXhr = xhr;
      xhr.timeout = 1800000;
      xhr.open('POST', url);

      let startTime = Date.now();

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = e.loaded / elapsed;
          const remaining = (e.total - e.loaded) / speed;

          fillEl.style.width = `${pct}%`;

          let etaText = '';
          if (remaining > 60) {
            etaText = ` (${Math.ceil(remaining / 60)} menit lagi)`;
          } else if (remaining > 0) {
            etaText = ` (${Math.ceil(remaining)} detik lagi)`;
          }

          labelEl.textContent = `Mengupload ${pct}%${etaText}`;
        }
      };

      xhr.onload = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';

        if (xhr.status >= 200 && xhr.status < 300) {
          showUploadResult('success', `✓ ${file.name} berhasil diupload (${fileSizeMB} MB)`);
          loadFileList();
          loadStorageInfo();
        } else {
          fallbackUploadViaWorker(file, progressEl, fillEl, labelEl, cancelBtn, resolve);
        }
      };

      xhr.onerror = () => {
        currentXhr = null;
        fallbackUploadViaWorker(file, progressEl, fillEl, labelEl, cancelBtn, resolve);
      };

      xhr.ontimeout = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Upload timeout. Coba lagi atau gunakan dashboard R2.');
        resolve();
      };

      xhr.onabort = () => {
        currentXhr = null;
        progressEl.hidden = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Upload dibatalkan.');
        resolve();
      };

      xhr.send(formData);
    });

  } catch (err) {
    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';
    showUploadResult('error', `✗ ${err.message}`);
  }
}

// Multipart upload for files >100MB
let currentMultipartSession = null;

async function handleMultipartUpload(file, progressEl, fillEl, labelEl, cancelBtn) {
  const fileSizeMB = (file.size / 1048576).toFixed(1);
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  
  labelEl.textContent = `Mempersiapkan upload multipart (${fileSizeMB} MB)...`;

  try {
    // 1. Initialize multipart upload
    const initRes = await authFetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name })
    });

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal memulai upload');
    }

    const { uploadId, key } = await initRes.json();
    currentMultipartSession = { uploadId, key };

    // 2. Upload chunks
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const parts = [];
    let uploadedBytes = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;

      labelEl.textContent = `Mengupload part ${partNumber}/${totalParts} (${fileSizeMB} MB)...`;

      const partRes = await authFetch(
        `/api/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        {
          method: 'PUT',
          body: chunk
        }
      );

      if (!partRes.ok) {
        throw new Error(`Gagal upload part ${partNumber}`);
      }

      const partData = await partRes.json();
      parts.push({ partNumber: partData.partNumber, etag: partData.etag });

      // Update progress
      uploadedBytes += chunk.size;
      const pct = Math.round((uploadedBytes / file.size) * 100);
      fillEl.style.width = `${pct}%`;

      // Calculate ETA
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = uploadedBytes / elapsed;
      const remaining = (file.size - uploadedBytes) / speed;

      let etaText = '';
      if (remaining > 60) {
        etaText = ` (${Math.ceil(remaining / 60)} menit lagi)`;
      } else if (remaining > 0) {
        etaText = ` (${Math.ceil(remaining)} detik lagi)`;
      }

      labelEl.textContent = `Mengupload ${pct}% (part ${partNumber}/${totalParts})${etaText}`;
    }

    // 3. Complete upload
    labelEl.textContent = 'Menyelesaikan upload...';

    const completeRes = await authFetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, uploadId, parts })
    });

    if (!completeRes.ok) {
      const errData = await completeRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyelesaikan upload');
    }

    currentMultipartSession = null;
    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';

    showUploadResult('success', `✓ ${file.name} berhasil diupload (${fileSizeMB} MB)`);
    loadFileList();
    loadStorageInfo();

  } catch (err) {
    // Abort multipart upload on error
    if (currentMultipartSession) {
      try {
        await authFetch('/api/upload/abort', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: currentMultipartSession.key,
            uploadId: currentMultipartSession.uploadId
          })
        });
      } catch (abortErr) {
        console.error('[Abort error]', abortErr);
      }
      currentMultipartSession = null;
    }

    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';
    showUploadResult('error', `✗ ${err.message}`);
  }

  // Setup cancel button for multipart
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (currentMultipartSession) {
        try {
          await authFetch('/api/upload/abort', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: currentMultipartSession.key,
              uploadId: currentMultipartSession.uploadId
            })
          });
          currentMultipartSession = null;
        } catch (err) {
          console.error('[Cancel error]', err);
        }
        progressEl.hidden = true;
        cancelBtn.style.display = 'none';
        showUploadResult('error', '✗ Upload dibatalkan.');
      }
    };
  }
}

function showUploadResult(type, message) {
  const el = document.getElementById('uploadResult');
  el.className    = `upload-result ${type}`;
  el.textContent  = message;
  // Auto-clear after 8 seconds
  setTimeout(() => { el.textContent = ''; }, 8000);
}

// Fallback: upload via Worker (for small files or if presigned URL fails)
async function fallbackUploadViaWorker(file, progressEl, fillEl, labelEl, cancelBtn, resolve) {
  labelEl.textContent = `Mencoba upload alternatif ${file.name}...`;

  try {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const res = await authFetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';

    if (res.ok) {
      showUploadResult('success', `✓ ${file.name} berhasil diupload (mode alternatif)`);
      loadFileList();
      loadStorageInfo();
    } else {
      const data = await res.json().catch(() => ({}));
      showUploadResult('error', `✗ ${data.error || 'Upload gagal'}. Coba upload dari dashboard R2.`);
    }
  } catch (err) {
    progressEl.hidden = true;
    if (cancelBtn) cancelBtn.style.display = 'none';
    showUploadResult('error', `✗ Upload gagal. Coba upload dari dashboard R2: https://dash.cloudflare.com/r2`);
  }
  resolve();
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

function truncateFileName(name, maxLen) {
  if (name.length <= maxLen) return name;
  const ext = name.split('.').pop();
  const baseName = name.substring(0, name.length - ext.length - 1);
  const truncated = baseName.substring(0, maxLen - ext.length - 4) + '...';
  return truncated + '.' + ext;
}
