# 🎯 Podcast Creator - Reliability Action Plan

**Status:** System is 83% ready (15/18 checks passing)  
**Goal:** Fix 3 critical issues → 100% reliable production system

---

## ✅ WHAT'S ALREADY WORKING

- ✅ Database: Connected to Supabase Postgres
- ✅ Storage: R2 configured locally with all credentials
- ✅ Environment: All 9 required variables present
- ✅ CLI: NotebookLM installed and accessible
- ✅ No stuck jobs in database
- ✅ Code: All fixes deployed (auto-cleanup, health monitoring)

---

## ❌ 3 CRITICAL ISSUES TO FIX

### 1. NotebookLM Session Expired ❌
**Impact:** Worker can't generate podcasts  
**Fix:** Re-login to NotebookLM (2 minutes)  
**Command:**
```powershell
notebooklm login
```
Or use the in-app login button.

### 2. Worker Not Installed as Service ❌
**Impact:** Must start worker manually; won't run 24/7  
**Fix:** Install PM2 service (5 minutes)  
**Command:**
```powershell
.\setup-worker-service.ps1
```

### 3. R2 Not Configured in Vercel ❌
**Impact:** Production podcasts can't be played  
**Fix:** Add 7 env vars to Vercel (10 minutes)  
**Variables to add:**
- STORAGE_DRIVER=s3
- S3_ENDPOINT
- S3_BUCKET
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_PUBLIC_BASE_URL
- S3_KEY_PREFIX

---

## 📋 STEP-BY-STEP RECOVERY

### Phase 1: Fix Local System (30 min)

1. **Re-authenticate NotebookLM** (2 min)
   ```powershell
   notebooklm login
   ```
   Or visit http://localhost:3000 → click "Login to NotebookLM" button

2. **Install Worker Service** (5 min)
   ```powershell
   .\setup-worker-service.ps1
   ```
   
3. **Verify Local System** (2 min)
   ```powershell
   npx tsx diagnose-system.ts
   ```
   Should show: ✅ 18 OK | ⚠️ 0 WARNINGS | ❌ 0 FAILURES

4. **Test Local Generation** (15 min)
   - Visit http://localhost:3000
   - Create a test podcast
   - Verify it completes and plays

### Phase 2: Make Production Work (15 min)

5. **Configure R2 in Vercel** (10 min)
   ```powershell
   vercel env add STORAGE_DRIVER production
   # Enter: s3
   
   vercel env add S3_ENDPOINT production
   # Copy from .env
   
   # Repeat for all S3_* variables
   ```

6. **Test Production** (5 min)
   - Visit https://notebook-lm-podcast-creator.vercel.app
   - Create test podcast
   - Worker (running locally) picks it up
   - Uploads to R2
   - Playable from Vercel

---

## 🎉 SUCCESS CRITERIA

System is **production-ready** when:

- [ ] `npx tsx diagnose-system.ts` shows all green ✅
- [ ] Worker runs as PM2 service (`pm2 status` shows online)
- [ ] Can create podcast from phone at Vercel URL
- [ ] Podcast auto-processes within 15 minutes
- [ ] Audio plays from R2 public URL
- [ ] Worker status shows "online" in app

---

## ⚡ QUICK START (If you want to do it now)

```powershell
# 1. Re-login
notebooklm login

# 2. Install service
.\setup-worker-service.ps1

# 3. Verify
npx tsx diagnose-system.ts

# 4. Configure Vercel R2 (via web UI or CLI)
vercel env add STORAGE_DRIVER production
# ... add other S3_* vars

# 5. Test end-to-end
# Create podcast from https://notebook-lm-podcast-creator.vercel.app
```

**Estimated time:** 45 minutes total  
**Result:** Fully functional, production-ready podcast creator

---

## 📞 NEED HELP?

Run diagnostics anytime:
```powershell
npx tsx diagnose-system.ts
```

This will show exactly what's broken and how to fix it.
