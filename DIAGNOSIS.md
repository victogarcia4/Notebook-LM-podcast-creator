# 🏥 Podcast Creator - System Diagnosis & Recovery Plan

**Created:** 2026-07-02  
**Goal:** Make the app reliable and production-ready

---

## 🔍 IDENTIFIED FAILURES

### 1️⃣ **Worker State Management** - CRITICAL ❌
**Symptom:** Jobs stuck at 60-68% "Generating audio" forever  
**Root Cause:** Worker crashes or stops → job left in RUNNING state → new worker ignores it  
**Fix:** Auto-cleanup stuck jobs on worker startup  

### 2️⃣ **Database Migration Complexity** - MODERATE ⚠️
**Symptom:** Confusing schema with `@@map`, connection pooling issues  
**Root Cause:** SQLite → Postgres migration with table prefixes to avoid conflicts  
**Fix:** Working but documented; no immediate action needed  

### 3️⃣ **Environment Configuration** - CRITICAL ❌
**Symptom:** `prisma generate` fails, paths corrupted, STORAGE_DRIVER confusion  
**Root Cause:** 15+ env vars, TLS proxy, Windows path issues  
**Fix:** Create validation script to check all required variables  

### 4️⃣ **NotebookLM Session Expiration** - MODERATE ⚠️
**Symptom:** Worker fails mid-job with "Authentication expired"  
**Root Cause:** Google sessions expire unpredictably  
**Fix:** Check auth before EVERY job, auto-alert when expired  

### 5️⃣ **Storage Configuration** - CRITICAL ❌
**Symptom:** Podcasts generate but can't play on production  
**Root Cause:** R2 configured locally but NOT in Vercel Production  
**Fix:** Configure R2 env vars in Vercel  
**Status:** ⚠️ **BLOCKING PRODUCTION USE**

### 6️⃣ **Worker Not Running 24/7** - CRITICAL ❌
**Symptom:** Remote podcast requests don't process  
**Root Cause:** Worker must be started manually, no service installed  
**Fix:** Install PM2 service so worker runs permanently  
**Status:** ⚠️ **BLOCKING PRODUCTION USE**

### 7️⃣ **No Health Monitoring** - MODERATE ⚠️
**Symptom:** Silent failures, can't tell if system is working  
**Root Cause:** Worker doesn't report status to database  
**Fix:** Implement WorkerStatus reporting  

---

## 🎯 RECOVERY CHECKLIST

### Phase 1: Local Reliability (Fix Core Issues)
- [ ] **1.1** Add auto-cleanup of stuck jobs on worker startup
- [ ] **1.2** Create environment validation script
- [ ] **1.3** Add NotebookLM auth check before every job
- [ ] **1.4** Implement WorkerStatus reporting in worker
- [ ] **1.5** Test local generation end-to-end

### Phase 2: Production Deployment (Make Public Work)
- [ ] **2.1** Configure R2 env vars in Vercel Production
- [ ] **2.2** Install worker as PM2 Windows service
- [ ] **2.3** Verify worker reports status to Supabase
- [ ] **2.4** Test remote generation from Vercel production
- [ ] **2.5** Test from phone/tablet

### Phase 3: Documentation & Hardening
- [ ] **3.1** Create simplified setup guide
- [ ] **3.2** Document troubleshooting steps
- [ ] **3.3** Add health check endpoint
- [ ] **3.4** Update HANDOFF.md with current reliable state

---

## 🚨 CURRENT STATE

**Database:** ✅ Supabase Postgres connected  
**Storage:** ⚠️ R2 configured locally, NOT in Vercel  
**Worker:** ❌ Not running  
**Service:** ❌ Not installed  
**Production:** ❌ Non-functional (can't generate podcasts)  
**Local:** ⚠️ Can generate if worker manually started  

---

## 🎯 SUCCESS CRITERIA

The app will be considered **reliable** when:

1. ✅ Worker runs 24/7 as Windows service
2. ✅ Stuck jobs auto-recover on worker restart
3. ✅ Environment validates on startup (all vars present)
4. ✅ Auth checked before every job (fails fast if expired)
5. ✅ Podcasts playable from Vercel production
6. ✅ Can create podcast from phone → processes automatically
7. ✅ Worker status visible in UI (online/offline)
8. ✅ Clear error messages when things fail

---

## 📖 NEXT STEPS

Starting with **Phase 1** to fix core reliability issues locally, then **Phase 2** to make production work, then **Phase 3** to document and harden.

**Estimated time:** 2-3 hours total
