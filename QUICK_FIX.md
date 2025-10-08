# ⚡ QUICK FIX - Environment Variable Error

## **Error**: `getaddrinfo ENOTFOUND undefined`

## **Solution** (Takes 30 seconds):

### **Step 1: Open your `.env` file**
Located at: `c:\Users\Donielr Arys Antonio\tarana.ai\.env`

### **Step 2: Add this line at the top**
```bash
NEXTAUTH_URL=http://localhost:3000
```

**Important**: 
- No quotes around the URL
- No trailing slash
- Use `http` for localhost (not `https`)

### **Step 3: Restart your development server**
```bash
# Press Ctrl+C to stop the server
# Then restart it:
npm run dev
```

### **Step 4: Test the refresh button**
- Navigate to a saved itinerary
- Click "Smart Refresh"
- Should work now! ✅

---

## **Your .env file should look like this:**

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Your other environment variables...
DATABASE_URL=your-database-url
GEMINI_API_KEY=your-api-key
# etc...
```

---

## **Verification**

After fixing, your console should show:
```
✅ 📡 Calling generation API: http://localhost:3000/api/gemini/itinerary-generator
✅ 🔍 Environment - NEXTAUTH_URL: SET
```

Instead of:
```
❌ Error: getaddrinfo ENOTFOUND undefined
```

---

**That's it! The refresh button should work now.** 🎉

For more details, see `ENV_SETUP.md`
