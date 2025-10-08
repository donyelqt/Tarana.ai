# ✅ Production Deployment Checklist - Refresh Feature

## **Pre-Deployment** 🔍

### **Code Verification**
- [ ] All files committed to Git
- [ ] Latest changes pushed to main branch
- [ ] No TypeScript errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)

### **Environment Variables** (Vercel Dashboard)
Navigate to: Settings → Environment Variables

- [ ] `NEXTAUTH_URL` = `https://your-production-domain.vercel.app`
- [ ] `NEXTAUTH_SECRET` = (your secret - must be set)
- [ ] `GEMINI_API_KEY` = (Google AI API key)
- [ ] `TOMTOM_API_KEY` = (Traffic API key)
- [ ] `OPENWEATHER_API_KEY` = (Weather API key)
- [ ] `DATABASE_URL` = (Supabase PostgreSQL connection string)
- [ ] `VERCEL_URL` = (Auto-set by Vercel - verify present)

### **Vercel Plan Check**
- [ ] **Hobby Plan**: Aware of 10s timeout limit (may need upgrade)
- [ ] **Pro Plan**: Configured for 60s timeout in `vercel.json` ✅ Recommended
- [ ] **Enterprise Plan**: Custom timeout if needed

---

## **Deployment** 🚀

### **Option 1: Auto-Deploy from GitHub**
- [ ] Push latest commit to main branch
- [ ] Verify Vercel auto-deploy started
- [ ] Monitor deployment progress in Vercel Dashboard
- [ ] Wait for deployment to complete (~2-5 min)

### **Option 2: Manual Deploy**
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy to production
vercel --prod

# Confirm deployment
# Visit: https://vercel.com/[your-team]/[project]/deployments
```

---

## **Post-Deployment Verification** ✅

### **1. Basic Health Check**
- [ ] Production site loads successfully
- [ ] Can log in with NextAuth
- [ ] Can view saved itineraries
- [ ] No console errors on page load

### **2. Refresh Button - Evaluation Flow**
Navigate to: `https://your-domain.vercel.app/saved-trips/[itinerary-id]`

- [ ] "Smart Refresh" button is visible
- [ ] Click button - no immediate errors
- [ ] Toast notification appears ("Analyzing Changes" or "Already Optimized")
- [ ] Check browser console for logs:
  ```
  ✅ Should see: "🔄 Changes detected..." or "⏭️ No changes needed"
  ❌ Should NOT see: "404 Not Found" or "Connection Error"
  ```

### **3. Refresh Button - Full Refresh Flow**
- [ ] Click "Smart Refresh" on outdated itinerary
- [ ] Toast shows "Analyzing Changes" → "Updating with live data..."
- [ ] Wait 10-20 seconds
- [ ] Toast shows "✅ Refresh Complete" → "Optimized with live data"
- [ ] Itinerary UI updates with new activities
- [ ] No error toast appears

### **4. Vercel Logs Verification**
Go to: Vercel Dashboard → Your Project → Logs

Filter by: `/api/saved-itineraries`

- [ ] See logs: `🔄 ITINERARY REFRESH REQUEST - ID: ...`
- [ ] See logs: `📡 Calling generation API: https://...`
- [ ] See logs: `✅ Itinerary generated successfully`
- [ ] See logs: `✅ REFRESH COMPLETED SUCCESSFULLY - Duration: ...ms`
- [ ] **No** timeout errors (FUNCTION_INVOCATION_TIMEOUT)
- [ ] **No** 404 errors
- [ ] Response time: <60s

### **5. Database Verification**
Open Supabase SQL Editor:

```sql
-- Check refresh metadata was updated
SELECT 
  id,
  title,
  "refreshMetadata"->>'lastRefreshedAt' as last_refresh,
  "refreshMetadata"->>'refreshCount' as count,
  "refreshMetadata"->>'status' as status
FROM saved_itineraries
WHERE id = 'your-test-itinerary-id'
ORDER BY "refreshMetadata"->>'lastRefreshedAt' DESC
LIMIT 1;
```

Expected results:
- [ ] `last_refresh` shows recent timestamp
- [ ] `count` incremented by 1
- [ ] `status` = 'REFRESH_COMPLETED'

---

## **Error Scenarios Testing** 🧪

### **Test 1: Network Timeout**
**Expected**: Graceful timeout handling after 60s

- [ ] Trigger refresh on complex itinerary
- [ ] If takes >60s, should see: "Request Timeout - Taking too long"
- [ ] Button re-enables after timeout
- [ ] Can retry refresh

### **Test 2: Invalid API Key**
**Expected**: Proper error message

- [ ] Temporarily set wrong API key in Vercel
- [ ] Trigger refresh
- [ ] Should see: "Update Failed" with error details
- [ ] Check logs for specific error (e.g., "Invalid API key")

### **Test 3: No Changes Needed**
**Expected**: Skip regeneration

- [ ] Refresh recently updated itinerary
- [ ] Should see: "⚡ Already Optimized - No changes needed"
- [ ] No API call to generation endpoint
- [ ] Response <2s

---

## **Performance Benchmarks** 📊

Run multiple refresh operations and verify:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Evaluation time | <2s | ___s | [ ] |
| Generation time | 8-15s | ___s | [ ] |
| Total refresh time | <20s | ___s | [ ] |
| Success rate | >95% | __% | [ ] |
| Timeout rate | <2% | __% | [ ] |
| Error rate | <5% | __% | [ ] |

---

## **Browser Compatibility** 🌐

Test on different browsers:

- [ ] **Chrome/Edge** (Latest): Refresh works ✅
- [ ] **Firefox** (Latest): Refresh works ✅
- [ ] **Safari** (Latest): Refresh works ✅
- [ ] **Mobile Safari** (iOS): Refresh works ✅
- [ ] **Mobile Chrome** (Android): Refresh works ✅

---

## **Load Testing** 💪

### **Concurrent Requests** (Optional - Pro/Enterprise plans)
```bash
# Test 5 concurrent refresh requests
for i in {1..5}; do
  curl -X POST https://your-domain.vercel.app/api/saved-itineraries/test-id/refresh \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
    -d '{"force": true}' &
done
wait
```

- [ ] All requests complete successfully
- [ ] No rate limiting errors
- [ ] Response times stable (<30s)

---

## **Monitoring Setup** 📈

### **Vercel Alerts** (Recommended)
Go to: Vercel Dashboard → Settings → Alerts

- [ ] Enable alert for function errors
- [ ] Enable alert for function timeouts
- [ ] Set email/Slack notification

### **Application Monitoring**
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor API response times
- [ ] Track refresh success/failure rates

---

## **Rollback Plan** 🔙

**If critical issues found**:

### **Immediate Actions**:
1. [ ] Note the issue and gather logs
2. [ ] Go to Vercel → Deployments
3. [ ] Find previous working deployment
4. [ ] Click "..." → "Promote to Production"
5. [ ] Verify rollback successful

### **Investigation**:
1. [ ] Review Vercel logs for error details
2. [ ] Check browser console for client errors
3. [ ] Verify environment variables
4. [ ] Test locally to reproduce issue
5. [ ] Document findings

---

## **Success Criteria** 🎯

**Deployment is successful when ALL of these are true**:

- ✅ Refresh button triggers without errors
- ✅ Evaluation completes in <2s
- ✅ Generation completes in <20s
- ✅ UI updates with new itinerary data
- ✅ Toast notifications show correct messages
- ✅ Vercel logs show successful flow
- ✅ Database reflects updated metadata
- ✅ No timeout errors (<60s limit)
- ✅ Success rate >95% over 24 hours
- ✅ Users report positive experience

---

## **Post-Launch Monitoring** 👀

### **First 24 Hours**:
- [ ] Monitor Vercel logs hourly
- [ ] Check success rate every 4 hours
- [ ] Review user feedback/reports
- [ ] Track timeout occurrences
- [ ] Note any error patterns

### **First Week**:
- [ ] Daily log review
- [ ] Success rate trending upward
- [ ] Response times stable
- [ ] No major user complaints
- [ ] Document any optimizations needed

---

## **Optimization Opportunities** 🚀

**If performance needs improvement**:

- [ ] Enable streaming responses (already implemented)
- [ ] Implement instant suggestions (already implemented)
- [ ] Add Redis caching for vector search
- [ ] Queue long-running operations
- [ ] Optimize AI prompt for faster generation
- [ ] Reduce activity count per itinerary
- [ ] Implement background refresh jobs

---

## **Documentation Updates** 📚

After successful deployment:

- [ ] Update README with refresh feature details
- [ ] Document any environment-specific issues
- [ ] Create troubleshooting guide for support team
- [ ] Update user-facing documentation
- [ ] Share performance metrics with team

---

## **Sign-Off** ✍️

### **Pre-Deployment Approval**:
- [ ] Code reviewed
- [ ] Testing completed
- [ ] Environment variables verified
- [ ] Backup/rollback plan ready

### **Post-Deployment Verification**:
- [ ] All health checks passed
- [ ] Performance benchmarks met
- [ ] Error scenarios handled gracefully
- [ ] Monitoring in place

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Verified By**: _______________  

---

**Status**: ⬜ READY FOR DEPLOYMENT → ✅ DEPLOYED → ✅ VERIFIED

**Notes**:
_Use this space for deployment-specific notes, issues encountered, or follow-up items._
