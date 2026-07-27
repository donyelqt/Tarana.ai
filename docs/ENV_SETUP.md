# 🔧 Environment Variables Setup - CRITICAL FIX

## **Issue Fixed** ✅

The error `getaddrinfo ENOTFOUND undefined` occurs when `NEXTAUTH_URL` is not properly set in your `.env` file.

---

## **Required Fix** 🚨

**Open your `.env` file and add/update this line:**

```bash
# For LOCAL DEVELOPMENT (Required!)
NEXTAUTH_URL=http://localhost:3000

# For PRODUCTION (Set in Vercel Dashboard)
# NEXTAUTH_URL=https://your-domain.vercel.app
```

---

## **Complete `.env` File Example**

Your `.env` file should contain:

```bash
# ============================================================================
# NEXTAUTH CONFIGURATION (CRITICAL!)
# ============================================================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-generate-with-openssl-rand-base64-32

# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# ============================================================================
# AI & APIS
# ============================================================================
GEMINI_API_KEY=your-gemini-api-key
TOMTOM_API_KEY=your-tomtom-api-key
OPENWEATHER_API_KEY=your-openweather-api-key

# ============================================================================
# OAUTH (Google)
# ============================================================================
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ============================================================================
# SUPABASE (if using)
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## **Verification Steps** ✅

### **1. Check Your .env File**
```bash
# Open your .env file
# Verify NEXTAUTH_URL is set to: http://localhost:3000
# No quotes, no trailing slashes
```

### **2. Restart Development Server**
```bash
# Stop the server (Ctrl+C)
# Restart it
npm run dev
```

### **3. Test Refresh Button**
- Open browser to http://localhost:3000
- Navigate to a saved itinerary
- Click "Smart Refresh" button
- Check console for: `📡 Calling generation API: http://localhost:3000/api/gemini/itinerary-generator`

---

## **Common Mistakes** ❌

### **Wrong - Missing NEXTAUTH_URL**
```bash
# Missing the variable entirely
NEXTAUTH_SECRET=abc123
```

### **Wrong - Has quotes**
```bash
NEXTAUTH_URL="http://localhost:3000"  # ❌ Remove quotes
```

### **Wrong - Has trailing slash**
```bash
NEXTAUTH_URL=http://localhost:3000/  # ❌ Remove trailing /
```

### **Wrong - HTTPS for localhost**
```bash
NEXTAUTH_URL=https://localhost:3000  # ❌ Use http for local
```

### **✅ Correct**
```bash
NEXTAUTH_URL=http://localhost:3000
```

---

## **Environment Variable Priority** 📋

The system checks in this order:
1. `NEXTAUTH_URL` (from .env file) - **RECOMMENDED FOR LOCAL**
2. `VERCEL_URL` (auto-set by Vercel in production)
3. Fallback: `http://localhost:3000`

---

## **Production Setup** (Vercel Dashboard)

For production, set in Vercel Dashboard → Settings → Environment Variables:

```
NEXTAUTH_URL = https://your-actual-domain.vercel.app
```

**Important**: 
- Use your actual Vercel domain
- Must be HTTPS (not HTTP)
- No trailing slash

---

## **Debugging** 🔍

After fixing, the console should show:

```
✅ Good:
📡 Calling generation API: http://localhost:3000/api/gemini/itinerary-generator
🔍 Environment - NEXTAUTH_URL: SET, VERCEL_URL: NOT SET

❌ Bad:
📡 Calling generation API: undefined/api/gemini/itinerary-generator
🔍 Environment - NEXTAUTH_URL: NOT SET, VERCEL_URL: NOT SET
```

---

## **Quick Fix Command** 🚀

If your `.env` file doesn't exist or is missing NEXTAUTH_URL:

### **Option 1: Add to existing .env**
Open `.env` and add this line at the top:
```bash
NEXTAUTH_URL=http://localhost:3000
```

### **Option 2: Create new .env**
If you don't have a `.env` file, create one in the root directory with:
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
# ... other variables
```

---

## **Testing After Fix** ✅

1. **Restart server**: Stop (Ctrl+C) and restart (`npm run dev`)
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
3. **Test refresh**: Click "Smart Refresh" button
4. **Check logs**: Should see successful API call

Expected success logs:
```
🔄 Calling itinerary generation API...
📡 Calling generation API: http://localhost:3000/api/gemini/itinerary-generator
🔍 Environment - NEXTAUTH_URL: SET, VERCEL_URL: NOT SET
✅ Itinerary generated successfully
```

---

## **Still Having Issues?** 🆘

If you still get errors after adding NEXTAUTH_URL:

1. **Verify file location**: `.env` must be in project root (same level as `package.json`)
2. **Check file name**: Must be exactly `.env` (not `.env.local` or `.env.example`)
3. **Restart VS Code**: Sometimes environment variables need IDE restart
4. **Check for typos**: `NEXTAUTH_URL` not `NEXT_AUTH_URL` or `NEXTAUTH_URI`

---

**Status**: 🔧 **REQUIRES .ENV UPDATE**

Add `NEXTAUTH_URL=http://localhost:3000` to your `.env` file and restart the development server.
