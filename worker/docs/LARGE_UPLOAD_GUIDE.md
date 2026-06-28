# 📤 Large File Upload Guide

## Quick Reference

### File Size Thresholds
- **< 100MB**: Automatic presigned POST upload (fast, single request)
- **≥ 100MB**: Automatic multipart upload (chunked, reliable)

---

## How It Works

### Small Files (<100MB)
```
User selects file → Frontend → Presigned POST → R2
                     ↓
                   Success
```
**Advantages**: Fast, single HTTP request  
**Limitations**: Max 100MB

### Large Files (≥100MB)
```
User selects file
  ↓
Frontend → Worker: POST /api/upload/init
  ↓
Worker creates multipart session
  ↓
Frontend → Worker: PUT /api/upload/part (×N chunks)
  ↓
All chunks uploaded
  ↓
Frontend → Worker: POST /api/upload/complete
  ↓
Success
```
**Advantages**: No size limit (up to 5TB), resumable  
**Chunk Size**: 10MB per chunk  
**Max Chunks**: 10,000 parts

---

## For Users (Admin Panel)

### Normal Upload Process
1. Login ke admin panel
2. Drag & drop atau click "Pilih File"
3. System auto-detects file size
4. Progress bar shows:
   - Small file: "Mengupload 45%"
   - Large file: "Mengupload 45% (part 5/20) (3 menit lagi)"
5. Wait for completion

### Cancel Upload
- Click **Cancel** button during upload
- System will abort the multipart session
- No partial file remains in storage

### Upload Times (Estimates)

| File Size | Connection | Est. Time |
|-----------|------------|-----------|
| 50 MB | 10 Mbps | 1-2 min |
| 100 MB | 10 Mbps | 2-5 min |
| 500 MB | 10 Mbps | 10-15 min |
| 1 GB | 10 Mbps | 20-30 min |
| 2 GB | 10 Mbps | 40-60 min |
| 1 GB | 100 Mbps | 2-5 min |

---

## For Developers

### API Endpoints

#### 1. Initialize Multipart Upload
```bash
POST /api/upload/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "large-file.apk"
}

Response:
{
  "uploadId": "abc123...",
  "key": "large-file.apk"
}
```

#### 2. Upload Part
```bash
PUT /api/upload/part?key=large-file.apk&uploadId=abc123&partNumber=1
Authorization: Bearer <token>
Content-Type: application/octet-stream

<binary chunk data>

Response:
{
  "partNumber": 1,
  "etag": "xyz789..."
}
```

#### 3. Complete Upload
```bash
POST /api/upload/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "large-file.apk",
  "uploadId": "abc123",
  "parts": [
    { "partNumber": 1, "etag": "xyz789..." },
    { "partNumber": 2, "etag": "abc456..." }
  ]
}

Response:
{
  "success": true,
  "key": "large-file.apk",
  "message": "Upload selesai"
}
```

#### 4. Abort Upload (Cancel)
```bash
DELETE /api/upload/abort
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "large-file.apk",
  "uploadId": "abc123"
}

Response:
{
  "success": true,
  "message": "Upload dibatalkan"
}
```

---

## Frontend Implementation

### Auto Strategy Selection
```javascript
async function handleUpload(file) {
  const THRESHOLD = 100 * 1024 * 1024; // 100MB
  
  if (file.size > THRESHOLD) {
    // Use multipart
    await handleMultipartUpload(file);
  } else {
    // Use presigned POST
    await handleRegularUpload(file);
  }
}
```

### Multipart Upload Flow
```javascript
async function handleMultipartUpload(file) {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  
  // 1. Init
  const { uploadId, key } = await fetch('/api/upload/init', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name })
  }).then(r => r.json());
  
  // 2. Upload chunks
  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const parts = [];
  
  for (let i = 0; i < totalParts; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const partNumber = i + 1;
    
    const { etag } = await fetch(
      `/api/upload/part?key=${key}&uploadId=${uploadId}&partNumber=${partNumber}`,
      { method: 'PUT', body: chunk }
    ).then(r => r.json());
    
    parts.push({ partNumber, etag });
    
    // Update progress UI
    const progress = (partNumber / totalParts) * 100;
    updateProgressBar(progress);
  }
  
  // 3. Complete
  await fetch('/api/upload/complete', {
    method: 'POST',
    body: JSON.stringify({ key, uploadId, parts })
  });
}
```

---

## Troubleshooting

### "Gagal upload part X"
**Cause**: Network timeout or interrupt  
**Solution**: 
- Check internet connection
- Retry upload
- Future: Implement automatic retry

### "Upload timeout"
**Cause**: File too large for current connection  
**Solution**: 
- Use faster internet connection
- Upload from Cloudflare R2 dashboard directly
- Split file into smaller parts

### CORS Errors
**Cause**: Pages domain not whitelisted  
**Solution**: 
1. Open `worker/index.js`
2. Find `getCORSHeaders()` function
3. Add your Pages URL to `allowed` array
4. Redeploy worker: `npx wrangler deploy`

### Progress Bar Stuck
**Cause**: JavaScript error or network issue  
**Solution**: 
- Check browser console for errors
- Refresh page and retry
- Clear browser cache

---

## Performance Tips

### For Fast Uploads
- Use wired connection (not WiFi)
- Close unnecessary apps/tabs
- Upload during off-peak hours
- Use browser with best connection (Chrome/Edge)

### For Slow Connections
- System automatically uses 10MB chunks
- Cancel and retry if speed drops significantly
- Consider compressing file first (if applicable)

---

## Future Improvements

### Planned Features
- ✅ Basic multipart upload (DONE)
- ⏳ Retry logic for failed chunks
- ⏳ Parallel chunk upload (3-5 concurrent)
- ⏳ Resume capability (after browser refresh)
- ⏳ Background upload via Service Worker
- ⏳ Upload queue (multiple files)
- ⏳ Pre-upload compression

---

## Technical Limits

### R2 Limits
- **Max file size**: 5TB
- **Max parts**: 10,000
- **Min part size**: 5MB (except last part)
- **Max part size**: 5GB
- **Incomplete upload retention**: 7 days (auto-deleted)

### Worker Limits (Free Tier)
- **CPU time**: 10ms per request
- **Memory**: 128MB
- **Request size**: 100MB
- **Subrequests**: 50 per request

### Recommended Chunk Size
- **Current**: 10MB (good balance)
- **Min**: 5MB (R2 requirement)
- **Max**: 100MB (Worker limit)
- **Optimal for 1GB file**: 10MB = 100 parts

---

## Contact & Support

**Issues**: https://github.com/AntaXtp1/comunity-racing-mobile/issues  
**Worker Logs**: `cd worker && npx wrangler tail`  
**R2 Dashboard**: https://dash.cloudflare.com/r2

---

**Last Updated**: 2026-06-28  
**Version**: 1.0.0
