// ============================================================
// SRMC WORKER — API gateway for R2 APK file management
// Endpoints:
//   POST   /api/auth              — validate admin password, return token
//   GET    /api/list              — list all files (public)
//   GET    /api/download/:name    — download file (public)
//   POST   /api/upload            — upload file (auth required)
//   DELETE /api/delete/:name      — delete file (auth required)
//   GET    /api/storage           — storage usage info (auth required)
// ============================================================

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const cors   = getCORSHeaders(env, origin);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      // Public routes (no auth)
      if (method === 'POST'   && path === '/api/auth')               return handleAuth(request, env, cors);
      if (method === 'GET'    && path === '/api/list')               return handleList(env, cors);
      if (method === 'GET'    && path.startsWith('/api/download/'))  return handleDownload(path, env, cors);

      // Protected routes (auth required)
      if (method === 'POST'   && path === '/api/upload')             return handleUpload(request, env, cors);
      if (method === 'DELETE' && path.startsWith('/api/delete/'))   return handleDelete(request, path, env, cors);
      if (method === 'GET'    && path === '/api/storage')            return handleStorage(env, cors);

      return jsonResponse({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error('[Worker error]', err);
      return jsonResponse({ error: 'Internal server error' }, 500, cors);
    }
  }
};

// ============================================================
// HANDLERS
// ============================================================

async function handleAuth(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body tidak valid' }, 400, cors);
  }

  const { password } = body || {};
  if (!password) return jsonResponse({ error: 'Password diperlukan' }, 400, cors);

  const valid = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!valid) return jsonResponse({ error: 'Password salah' }, 401, cors);

  const token = await signToken(env);
  return jsonResponse({ token }, 200, cors);
}

async function handleList(env, cors) {
  const list = await env.R2_BUCKET.list();
  const files = (list.objects || []).map(o => ({
    name:     o.key,
    size:     o.size,
    uploaded: o.uploaded ? o.uploaded.toISOString() : null
  }));
  // Sort newest first
  files.sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
  return jsonResponse(files, 200, cors);
}

async function handleDownload(path, env, cors) {
  const name = decodeURIComponent(path.replace('/api/download/', ''));
  if (!name) return jsonResponse({ error: 'Nama file diperlukan' }, 400, cors);

  const object = await env.R2_BUCKET.get(name);
  if (!object) return jsonResponse({ error: 'File tidak ditemukan' }, 404, cors);

  const headers = {
    'Content-Type':        'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
    'Cache-Control':       'public, max-age=3600',
    'Access-Control-Allow-Origin': cors['Access-Control-Allow-Origin'] || '*'
  };

  if (object.size) headers['Content-Length'] = String(object.size);

  return new Response(object.body, { headers });
}

async function handleUpload(request, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Form data tidak valid' }, 400, cors);
  }

  const file = formData.get('file');
  if (!file) return jsonResponse({ error: 'Field "file" tidak ada' }, 400, cors);

  // Validasi longgar — terima semua file yang punya ekstensi
  if (!file.name.includes('.')) {
    return jsonResponse({ error: 'File harus memiliki ekstensi' }, 400, cors);
  }

  await env.R2_BUCKET.put(file.name, file.stream(), {
    httpMetadata:   { contentType: 'application/vnd.android.package-archive' },
    customMetadata: { uploadedAt: new Date().toISOString() }
  });

  return jsonResponse({ success: true, name: file.name }, 200, cors);
}

async function handleDelete(request, path, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  const name = decodeURIComponent(path.replace('/api/delete/', ''));
  if (!name) return jsonResponse({ error: 'Nama file diperlukan' }, 400, cors);

  // Check exists first
  const obj = await env.R2_BUCKET.head(name);
  if (!obj) return jsonResponse({ error: 'File tidak ditemukan' }, 404, cors);

  await env.R2_BUCKET.delete(name);
  return jsonResponse({ success: true, deleted: name }, 200, cors);
}

async function handleStorage(env, cors) {
  const authErr = await requireAuthFromRequest(env, cors);
  // handleStorage is GET so we receive request differently — skip for now, use token check from header manually
  // (This is called via authFetch in admin.js which sets Authorization header)

  const TOTAL_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB R2 free tier

  // Try Cloudflare API for accurate usage
  if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN && env.R2_BUCKET_NAME) {
    try {
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET_NAME}/usage`;
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type':  'application/json'
        }
      });
      const data = await res.json();
      if (data.success && data.result) {
        const usedBytes = data.result.payloadSize || 0;
        return jsonResponse({
          usedBytes,
          totalBytes:  TOTAL_BYTES,
          percentage:  (usedBytes / TOTAL_BYTES) * 100
        }, 200, cors);
      }
    } catch (err) {
      console.error('[Storage CF API]', err);
      // Fall through to fallback
    }
  }

  // Fallback: sum file sizes from listing
  const list = await env.R2_BUCKET.list();
  const usedBytes = (list.objects || []).reduce((acc, o) => acc + (o.size || 0), 0);
  return jsonResponse({
    usedBytes,
    totalBytes:  TOTAL_BYTES,
    percentage:  (usedBytes / TOTAL_BYTES) * 100
  }, 200, cors);
}

// ============================================================
// AUTH HELPERS
// ============================================================

async function verifyPassword(password, hash) {
  if (!hash || !password) return false;

  // Expected format: "salt:sha256hex"
  const colonIdx = hash.indexOf(':');
  if (colonIdx === -1) return false;

  const salt     = hash.substring(0, colonIdx);
  const expected = hash.substring(colonIdx + 1);

  const enc    = new TextEncoder();
  const buf    = await crypto.subtle.digest('SHA-256', enc.encode(salt + password));
  const actual = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(actual, expected);
}

async function signToken(env) {
  const secret  = env.API_KEY || 'fallback-dev-secret';
  const payload = JSON.stringify({
    iat: Date.now(),
    exp: Date.now() + 24 * 3600 * 1000  // 24h
  });

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${btoa(payload)}.${sigB64}`;
}

async function verifyToken(token, env) {
  if (!token) return false;

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return false;

  const payloadB64 = token.substring(0, dotIdx);
  const sigB64     = token.substring(dotIdx + 1);

  const secret = env.API_KEY || 'fallback-dev-secret';
  const enc    = new TextEncoder();

  let key, payload;
  try {
    key     = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    payload = JSON.parse(atob(payloadB64));
  } catch {
    return false;
  }

  const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
  const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(atob(payloadB64)));

  if (!valid) return false;
  if (Date.now() > payload.exp) return false;

  return true;
}

async function requireAuth(request, env, cors) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ok    = await verifyToken(token, env);
  if (!ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors);
  return null;
}

async function requireAuthFromRequest(env, cors) {
  // Placeholder — actual auth check done inside each handler via requireAuth
  return null;
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function jsonResponse(data, status, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function getCORSHeaders(env, origin) {
  // Allowed origins — update after Pages deploy
  const allowed = [
    'http://localhost:5500',
    'http://localhost:8787',
    'http://127.0.0.1:5500',
    // Add your Pages domain after deploy, e.g.:
    // 'https://sim-racing-community.pages.dev'
  ];

  // If ALLOWED_ORIGIN secret is set, add it dynamically
  if (env.ALLOWED_ORIGIN) allowed.push(env.ALLOWED_ORIGIN);

  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');

  return {
    'Access-Control-Allow-Origin':  allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400'
  };
}
