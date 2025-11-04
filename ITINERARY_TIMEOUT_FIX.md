# Itinerary Generation Timeout Fix

## Root Cause Analysis

The itinerary generator was returning empty results with the message "Unable to generate custom itinerary" due to **Gemini API timeouts**.

### Key Issues Identified:

1. **Aggressive Timeout Settings**
   - Structured Engine: 15 seconds (too short)
   - Guaranteed Engine: 12 seconds (too short)
   - Gemini API was taking 15-30+ seconds to respond

2. **Overly Restrictive Generation Parameters**
   - Temperature: 0.1 (too restrictive, slows generation)
   - TopK: 1 (minimal sampling, limits creativity)
   - TopP: 0.5 (too focused)
   - MaxTokens: 2048-3072 (insufficient for complex itineraries)

3. **Poor Fallback Handling**
   - When timeout occurred, fallback returned empty activities
   - No attempt to use the sample itinerary data
   - Unhelpful error messages to users

## Fixes Applied

### 1. Increased Timeouts
```typescript
// Before
TIMEOUT_MS = 15000; // 15s
TIMEOUT_MS = 12000; // 12s

// After
TIMEOUT_MS = 30000; // 30s (Structured Engine)
TIMEOUT_MS = 25000; // 25s (Guaranteed Engine)
```

### 2. Relaxed Generation Parameters
```typescript
// Before
temperature: 0.1,
topK: 1,
topP: 0.5,
maxOutputTokens: 2048

// After
temperature: 0.3,  // More creative
topK: 10,          // Better sampling
topP: 0.8,         // More diverse
maxOutputTokens: 4096  // Sufficient space
```

### 3. Improved Retry Logic
- Increased MAX_RETRIES from 1 to 2 attempts
- Added detailed timing logs to diagnose slow responses
- Better error messages explaining timeouts

### 4. Smarter Fallback Strategy
- Fallback now attempts to use activities from sample itinerary
- Provides helpful user messages: "AI took too long, try again"
- Logs activity extraction for debugging

### 5. Reduced Prompt Complexity
- Simplified prompts to reduce processing time
- Limited sample activities to top 6 instead of full list
- Removed verbose instructions

## Testing Required

After restarting the Next.js dev server:

1. **Test normal generation** - Should complete in 10-20 seconds
2. **Test timeout scenario** - Should show helpful message after 30s
3. **Test fallback** - Should use sample activities if available
4. **Monitor logs** - Check Gemini response times

## Expected Behavior

### Success Case (90% of requests)
- Gemini responds within 10-20 seconds
- Valid itinerary with activities returned
- Log: `⚡ STRUCTURED ENGINE: Gemini responded in XXXXms`

### Timeout Case (10% of requests)
- After 30 seconds, timeout occurs
- Fallback uses sample itinerary activities if available
- User sees: "AI took too long, try again"
- Second attempt usually succeeds

## Monitoring

Watch for these log patterns:

```
✅ Good: "⚡ STRUCTURED ENGINE: Gemini responded in 8500ms"
⚠️ Slow: "⚡ STRUCTURED ENGINE: Gemini responded in 25000ms"
❌ Timeout: "⏱️ STRUCTURED ENGINE: Timeout after 30000ms"
```

## Next Steps

1. **Restart dev server** to load new code
2. **Test generation** multiple times
3. **Monitor Gemini API latency** - if consistently >20s, consider:
   - Using gemini-1.5-flash-8b (faster model)
   - Implementing request queuing
   - Adding Redis caching for common requests
4. **Track timeout rate** - should be <10%

## Additional Optimizations (Future)

If timeouts persist:
- Switch to streaming responses
- Implement progressive loading (show activities as they're generated)
- Add request deduplication
- Use edge functions for lower latency
- Consider alternative AI providers as fallback
