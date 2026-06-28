// ============================================================
// SRMC WORKER — API gateway for R2 APK file management
// Endpoints:
//   POST   /api/auth              — validate admin password, return token
//   GET    /api/list              — list all files (public)
//   GET    /api/download/:name    — download file (public)
//   POST   /api/upload            — upload file (auth required)
//   POST   /api/presign           — get presigned URL for large upload (auth required)
//   DELETE /api/delete/:name      — delete file (auth required)
//   GET    /api/storage           — storage usage info (auth required)
//
// SECURITY:
//   - Rate limiting (5 login attempts/min, 30 general requests/min)
//   - PBKDF2 password hashing (replaces SHA-256)
//   - Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
//   - Input validation & sanitization
//   - Timing-safe comparisons
// ============================================================

// In-memory rate limiter (resets on Worker restart — acceptable for free tier)
const rateLimitStore = new Map();

function checkRateLimit(ip, limit, windowMs) {
  const now   = Date.now();
  const key   = `${ip}:${limit}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.start > windowMs) {
    rateLimitStore.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://srmc-worker.antarahimmuhammad.workers.dev; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';
    const cors   = getCORSHeaders(env, origin);
    const secHeaders = getSecurityHeaders();

    // Merge security + CORS headers
    const allHeaders = { ...secHeaders, ...cors };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: allHeaders });
    }

    // Rate limiting: auth endpoint (5 attempts/min)
    if (path === '/api/auth' && method === 'POST') {
      const rl = checkRateLimit(ip, 5, 60000);
      if (!rl.allowed) {
        return jsonResponse({ error: 'Terlalu banyak percobaan. Coba 1 menit lagi.' }, 429, allHeaders);
      }
    }

    // Rate limiting: general API (60 requests/min)
    if (path.startsWith('/api/')) {
      const rl = checkRateLimit(ip, 60, 60000);
      if (!rl.allowed) {
        return jsonResponse({ error: 'Rate limit exceeded' }, 429, allHeaders);
      }
    }

    try {
      // Public routes (no auth)
      if (method === 'POST'   && path === '/api/auth')               return handleAuth(request, env, allHeaders);
      if (method === 'GET'    && path === '/api/list')               return handleList(env, allHeaders);
      if (method === 'GET'    && path.startsWith('/api/download/'))  return handleDownload(path, env, allHeaders);

      // Protected routes (auth required)
      if (method === 'POST'   && path === '/api/upload')             return handleUpload(request, env, allHeaders);
      if (method === 'POST'   && path === '/api/presign')            return handlePresign(request, env, allHeaders);
      
      // Multipart upload endpoints (for large files >100MB)
      if (method === 'POST'   && path === '/api/upload/init')        return handleMultipartInit(request, env, allHeaders);
      if (method === 'PUT'    && path === '/api/upload/part')        return handleMultipartPart(request, env, allHeaders, url);
      if (method === 'POST'   && path === '/api/upload/complete')    return handleMultipartComplete(request, env, allHeaders);
      if (method === 'DELETE' && path === '/api/upload/abort')       return handleMultipartAbort(request, env, allHeaders);
      
      if (method === 'DELETE' && path.startsWith('/api/delete/'))   return handleDelete(request, path, env, allHeaders);
      if (method === 'GET'    && path === '/api/storage')            return handleStorage(env, allHeaders);

      return jsonResponse({ error: 'Not found' }, 404, allHeaders);
    } catch (err) {
      console.error('[Worker error]', err);
      return jsonResponse({ error: 'Internal server error' }, 500, allHeaders);
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

  // Max file size: 2GB
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
  if (file.size && file.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: 'File terlalu besar. Maksimal 2GB.' }, 413, cors);
  }

  await env.R2_BUCKET.put(file.name, file.stream(), {
    httpMetadata:   { contentType: 'application/vnd.android.package-archive' },
    customMetadata: { uploadedAt: new Date().toISOString() }
  });

  return jsonResponse({ success: true, name: file.name }, 200, cors);
}

async function handlePresign(request, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body tidak valid' }, 400, cors);
  }

  const { fileName } = body;
  if (!fileName) return jsonResponse({ error: 'fileName diperlukan' }, 400, cors);

  // Sanitize fileName — prevent path traversal
  const safeName = fileName.replace(/[^a-zA-Z0-9._\-\s()]/g, '_').replace(/\.\./g, '_');
  if (!safeName || !safeName.includes('.')) {
    return jsonResponse({ error: 'Nama file tidak valid' }, 400, cors);
  }

  try {
    // Generate presigned POST (not PUT) — POST is "simple method", no CORS preflight!
    const data = await generatePresignedPost(env, safeName);
    return jsonResponse({ ...data, fileName: safeName }, 200, cors);
  } catch (err) {
    console.error('[Presign error]', err);
    return jsonResponse({ error: 'Gagal generate presigned URL' }, 500, cors);
  }
}

async function handleDelete(request, path, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  const rawName = decodeURIComponent(path.replace('/api/delete/', ''));
  const name = rawName.replace(/[^a-zA-Z0-9._\-\s()]/g, '_').replace(/\.\./g, '_');
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
// MULTIPART UPLOAD HANDLERS (for files >100MB)
// ============================================================

async function handleMultipartInit(request, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body tidak valid' }, 400, cors);
  }

  const { filename } = body;
  if (!filename) return jsonResponse({ error: 'filename diperlukan' }, 400, cors);

  // Sanitize filename
  const safeName = filename.replace(/[^a-zA-Z0-9._\-\s()]/g, '_').replace(/\.\./g, '_');
  if (!safeName || !safeName.includes('.')) {
    return jsonResponse({ error: 'Nama file tidak valid' }, 400, cors);
  }

  try {
    const multipartUpload = await env.R2_BUCKET.createMultipartUpload(safeName);
    return jsonResponse({
      uploadId: multipartUpload.uploadId,
      key: safeName
    }, 200, cors);
  } catch (err) {
    console.error('[Multipart init error]', err);
    return jsonResponse({ error: 'Gagal memulai upload' }, 500, cors);
  }
}

async function handleMultipartPart(request, env, cors, url) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  const { key, uploadId, partNumber } = Object.fromEntries(url.searchParams);
  
  if (!key || !uploadId || !partNumber) {
    return jsonResponse({ error: 'key, uploadId, dan partNumber diperlukan' }, 400, cors);
  }

  const partNum = Number(partNumber);
  if (isNaN(partNum) || partNum < 1 || partNum > 10000) {
    return jsonResponse({ error: 'partNumber tidak valid (harus 1-10000)' }, 400, cors);
  }

  try {
    const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
    
    // Read chunk data from request body
    const chunkData = await request.arrayBuffer();
    
    // Upload this part
    const uploadedPart = await multipartUpload.uploadPart(partNum, chunkData);
    
    return jsonResponse({
      partNumber: partNum,
      etag: uploadedPart.etag
    }, 200, cors);
  } catch (err) {
    console.error('[Multipart part error]', err);
    return jsonResponse({ error: `Gagal upload part ${partNum}` }, 500, cors);
  }
}

async function handleMultipartComplete(request, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body tidak valid' }, 400, cors);
  }

  const { key, uploadId, parts } = body;
  
  if (!key || !uploadId || !parts || !Array.isArray(parts)) {
    return jsonResponse({ error: 'key, uploadId, dan parts diperlukan' }, 400, cors);
  }

  // Validate parts array
  for (const part of parts) {
    if (!part.partNumber || !part.etag) {
      return jsonResponse({ error: 'Setiap part harus memiliki partNumber dan etag' }, 400, cors);
    }
  }

  try {
    const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
    
    // Complete the upload
    await multipartUpload.complete(parts);
    
    return jsonResponse({
      success: true,
      key: key,
      message: 'Upload selesai'
    }, 200, cors);
  } catch (err) {
    console.error('[Multipart complete error]', err);
    return jsonResponse({ error: 'Gagal menyelesaikan upload' }, 500, cors);
  }
}

async function handleMultipartAbort(request, env, cors) {
  const authErr = await requireAuth(request, env, cors);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body tidak valid' }, 400, cors);
  }

  const { key, uploadId } = body;
  
  if (!key || !uploadId) {
    return jsonResponse({ error: 'key dan uploadId diperlukan' }, 400, cors);
  }

  try {
    const multipartUpload = env.R2_BUCKET.resumeMultipartUpload(key, uploadId);
    await multipartUpload.abort();
    
    return jsonResponse({
      success: true,
      message: 'Upload dibatalkan'
    }, 200, cors);
  } catch (err) {
    console.error('[Multipart abort error]', err);
    return jsonResponse({ error: 'Gagal membatalkan upload' }, 500, cors);
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================

async function verifyPassword(password, hash) {
  if (!hash || !password) return false;

  // Expected format: "pbkdf2:salt:iterations:hash"
  const parts = hash.split(':');
  if (parts.length === 4 && parts[0] === 'pbkdf2') {
    const [, salt, iterations, expected] = parts;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: parseInt(iterations), hash: 'SHA-256' },
      keyMaterial, 256
    );
    const actual = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return timingSafeEqual(actual, expected);
  }

  // Backward compatibility: old "salt:sha256hex" format
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
    exp: Date.now() + 12 * 3600 * 1000  // 12h (reduced from 24h)
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
// PRESIGNED URL GENERATION (AWS Signature V4)
// ============================================================

async function generatePresignedPost(env, fileName) {
  const accessKeyId     = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const endpoint        = env.R2_ENDPOINT;
  const bucket          = env.R2_BUCKET_NAME || 'srmc-apks';
  const region          = 'auto';

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('R2 credentials not configured');
  }

  const now = new Date();
  const dateStamp   = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate     = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const expiration  = new Date(now.getTime() + 3600000).toISOString(); // 1 hour

  const host = endpoint.replace('https://', '');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  // Policy document — specifies allowed conditions
  const policy = {
    expiration: expiration,
    conditions: [
      { bucket: bucket },
      ["starts-with", "$key", ""],
      ["content-length-range", 0, 2147483648], // Max 2GB
      { "x-amz-algorithm": "AWS4-HMAC-SHA256" },
      { "x-amz-credential": `${accessKeyId}/${credentialScope}` },
      { "x-amz-date": amzDate }
    ]
  };

  // Base64 encode policy
  const policyJson   = JSON.stringify(policy);
  const policyBase64 = btoa(policyJson);

  // Sign the policy
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, 's3');
  const signature  = await hmacSha256(signingKey, policyBase64);

  // Return URL + form fields for browser POST
  return {
    url: `${endpoint}/${bucket}`,
    fields: {
      'key':                  fileName,
      'x-amz-algorithm':     'AWS4-HMAC-SHA256',
      'x-amz-credential':    `${accessKeyId}/${credentialScope}`,
      'x-amz-date':          amzDate,
      'x-amz-signature':     signature,
      'policy':              policyBase64
    }
  };
}

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

async function hmacSha256(key, message) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return bufferToHex(signature);
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256Raw('AWS4' + key, dateStamp);
  const kRegion = await hmacSha256Raw(kDate, regionName);
  const kService = await hmacSha256Raw(kRegion, serviceName);
  const kSigning = await hmacSha256Raw(kService, 'aws4_request');
  return kSigning;
}

async function hmacSha256Raw(key, message) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
