# 🚀 Quick Start - Itinerary Refresh System

## ⚡ 5-Minute Setup Guide

### Step 1: Database Migration (2 minutes)

```bash
# Connect to your Supabase/PostgreSQL database
psql -U your_user -d your_database -f migrations/add_refresh_metadata.sql

# Or via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste contents of migrations/add_refresh_metadata.sql
# 3. Click "Run"
```

**Verify:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'itineraries' 
AND column_name IN ('refresh_metadata', 'traffic_snapshot', 'activity_coordinates');
```

---

### Step 2: Environment Variables (1 minute)

Add to Vercel environment variables:

```bash
CRON_SECRET=<generate-with-command-below>
```

**Generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Add to Vercel:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `CRON_SECRET` with the generated value
3. Select "Production" environment
4. Click "Save"

---

### Step 3: Frontend Update (2 minutes)

Open `/src/app/saved-trips/[id]/page.tsx` and make these changes:

#### A. Add State Variables (after line 39)
```typescript
const [showChangeSummary, setShowChangeSummary] = useState(false)
const [changeSummary, setChangeSummary] = useState<string>('')
const [refreshEvaluation, setRefreshEvaluation] = useState<any>(null)
```

#### B. Replace `handleRefreshItinerary` function (lines 67-171)

**Delete:** Lines 67-223 (old implementation)

**Add:** Copy the new implementation from `REFRESH_ITINERARY_IMPLEMENTATION.md` section "Update `/src/app/saved-trips/[id]/page.tsx`"

Or use this simplified version:

```typescript
const handleRefreshItinerary = async (force: boolean = false) => {
  if (!itinerary) return;
  setIsRefreshing(true);
  
  try {
    const response = await fetch(`/api/saved-itineraries/${id}/refresh`, {
      method: force ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: force ? JSON.stringify({ force: true }) : undefined
    });

    const result = await response.json();
    
    if (result.success && result.updatedItinerary) {
      setItinerary(result.updatedItinerary);
      toast({ title: "Itinerary Updated ✨", description: result.message });
    } else {
      toast({ title: "No Update Needed", description: result.message });
    }
  } catch (error) {
    toast({ title: "Error", description: "Failed to refresh", variant: "destructive" });
  } finally {
    setIsRefreshing(false);
  }
};
```

#### C. Update Button (around line 406)

**Replace:**
```typescript
<Button onClick={handleRefreshItinerary} ...>
```

**With:**
```typescript
<div className="flex gap-2">
  <Button onClick={() => handleRefreshItinerary(false)} ...>
    Smart Refresh
  </Button>
  <Button onClick={() => handleRefreshItinerary(true)} variant="outline" ...>
    Force
  </Button>
</div>
```

---

### Step 4: Deploy (1 minute)

```bash
# Commit changes
git add .
git commit -m "feat: add automatic itinerary refresh system"

# Deploy to Vercel
git push origin main
# Or: vercel deploy --prod
```

---

## ✅ Verification Checklist

### Backend
- [ ] Database migration successful
- [ ] New columns visible in `itineraries` table
- [ ] CRON_SECRET added to Vercel
- [ ] Cron job visible in Vercel dashboard

### Frontend
- [ ] Code changes applied
- [ ] No TypeScript errors
- [ ] Buttons render correctly

### Testing
```bash
# Test evaluation endpoint
curl https://your-domain.vercel.app/api/saved-itineraries/[ID]/refresh

# Test cron job (manual trigger)
curl -X POST https://your-domain.vercel.app/api/cron/evaluate-refreshes \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 🎯 Quick Test

1. **Navigate to a saved itinerary:**
   - Go to `/saved-trips/[id]`

2. **Click "Smart Refresh":**
   - Should evaluate conditions
   - Show toast notification

3. **Click "Force" button:**
   - Should immediately regenerate
   - Update itinerary

4. **Check database:**
   ```sql
   SELECT 
     id, 
     title,
     refresh_metadata->>'status' as status,
     refresh_metadata->>'refreshCount' as count
   FROM itineraries 
   WHERE refresh_metadata IS NOT NULL;
   ```

---

## 📊 Monitor

### Vercel Dashboard
1. Go to your project
2. Click "Deployments" → Latest deployment
3. Click "Functions" → Check `/api/saved-itineraries/[id]/refresh`
4. Click "Cron Jobs" → View execution logs

### Database
```sql
-- View refresh activity
SELECT 
  title,
  refresh_metadata->>'lastRefreshedAt' as last_refresh,
  refresh_metadata->>'refreshCount' as count,
  refresh_metadata->>'status' as status
FROM itineraries
WHERE refresh_metadata IS NOT NULL
ORDER BY refresh_metadata->>'lastRefreshedAt' DESC;
```

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" error
**Fix:** Verify CRON_SECRET is set in Vercel environment variables

### Issue: Database columns not found
**Fix:** Re-run migration script

### Issue: Frontend errors
**Fix:** Check TypeScript compilation: `npm run build`

### Issue: Cron job not running
**Fix:** 
1. Check `vercel.json` is in project root
2. Redeploy: `vercel deploy --prod`
3. Verify in Vercel dashboard → Settings → Cron Jobs

---

## 📚 Full Documentation

For detailed information, see:
- `REFRESH_ITINERARY_IMPLEMENTATION.md` - Complete implementation guide
- `TESTING_GUIDE_REFRESH.md` - Comprehensive testing scenarios
- `IMPLEMENTATION_SUMMARY.md` - Architecture and features

---

## 🎉 You're Done!

The system is now live and will:
- ✅ Automatically evaluate itineraries every 6 hours
- ✅ Detect significant weather/traffic changes
- ✅ Allow users to manually refresh
- ✅ Track all refresh activity in database

**Total Setup Time:** ~5 minutes

**System Status:** 🟢 Production Ready

---

## 💡 Pro Tips

1. **Monitor API Usage:**
   - TomTom: Check dashboard for quota
   - OpenWeather: Monitor API calls

2. **Optimize Thresholds:**
   - Edit `/src/lib/services/itineraryRefreshService.ts`
   - Adjust `DEFAULT_CONFIG` values

3. **Customize Schedule:**
   - Edit `vercel.json`
   - Change cron schedule (currently every 6 hours)

4. **Add Notifications:**
   - Extend `notifyUsersOfRefreshNeeds()` in refreshScheduler.ts
   - Integrate with email service

---

**Need Help?** Check the full documentation or review console logs for detailed debugging information.
