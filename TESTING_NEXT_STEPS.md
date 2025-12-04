# Testing Next Steps

## Step 1: Restart Your Dev Server

**Important:** Environment variables are loaded when the server starts. After adding `STUDENT_PORTAL_URL` to `.env`, you must restart your dev server.

1. Stop your current dev server (Ctrl+C in the terminal)
2. Restart it:
   ```bash
   npm run dev
   ```

## Step 2: Verify Environment Variables

Visit: `http://localhost:3002/api/health`

You should see:
```json
{
  "status": "ok",
  "checks": {
    "database": "connected",
    "databaseUrl": "set",
    "apiKey": "set"
  }
}
```

## Step 3: Test Student Portal Connection

Visit: `http://localhost:3002/api/test-connection`

This will test:
- ✅ DNS resolution for the API hostname
- ✅ API connectivity
- ✅ API key authentication

**Expected Result:** You should see connection status and any errors.

## Step 4: Test the Full Flow

1. **Open the app:** `http://localhost:3002/`

2. **Click "Speak Chinese"**
   - This will start a session
   - Request microphone permission (if not already granted)
   - Start recording

3. **Speak in Chinese** (or any audio - the API will transcribe it)

4. **Click "Stop Recording"**
   - The app will:
     - Upload audio to your backend
     - Your backend calls Student Portal API for transcription
     - Your backend calls Student Portal API for translation
     - Play the English translation
     - Auto-transition to partner recording mode

5. **Wait 10 seconds** (or click to start partner recording)
   - Record partner's English response
   - Stop recording
   - Get Chinese translation

## Troubleshooting

### If `/api/test-connection` shows DNS errors:
- Check your internet connection
- Verify the `STUDENT_PORTAL_URL` is correct
- Contact your instructor for the correct API URL

### If `/api/test-connection` shows authentication errors:
- Verify `SUPER_MIND_API_KEY` is set in `.env`
- Check that the API key is valid

### If recording doesn't work:
- Check browser console for errors
- Ensure microphone permission is granted
- Try a different browser (Chrome/Edge work best)

### If you see "fetch failed" errors:
- Check server logs for detailed error messages
- Verify the Student Portal API is accessible
- Check network/firewall settings

## What to Expect

✅ **Success looks like:**
- Session starts successfully
- Audio records (you see visual feedback)
- Processing happens (spinner shows)
- English translation plays automatically
- Partner recording mode activates
- Chinese translation plays after partner speaks
- "Session Saved" message appears

❌ **If something fails:**
- Check browser console (F12) for client-side errors
- Check server terminal for backend errors
- Use `/api/test-connection` to diagnose API issues

