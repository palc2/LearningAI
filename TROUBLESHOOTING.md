# Troubleshooting Guide

## "fetch failed" Error When Clicking "Speak Chinese"

### Problem
When clicking the "Speak Chinese" button, you get a "fetch failed" error.

### Most Likely Cause
The test data (household and user) hasn't been set up in your database.

### Solution

1. **Set up test data in your PostgreSQL database:**

   ```bash
   # Using psql command line
   psql -U your_username -d your_database_name -f scripts/setup-test-data.sql
   
   # Or if using a connection string
   psql $DATABASE_URL -f scripts/setup-test-data.sql
   ```

2. **Verify the data was created:**

   ```sql
   -- Check households
   SELECT id, name, timezone FROM households WHERE id = '00000000-0000-0000-0000-000000000000';
   
   -- Check users
   SELECT id, display_name, family_role, primary_lang FROM users WHERE household_id = '00000000-0000-0000-0000-000000000000';
   ```

3. **Check the browser console** for the actual error message. The improved error handling should now show:
   - "Household with id ... not found" - if household is missing
   - "User with id ... not found" - if user is missing
   - Other database errors with details

### Other Possible Issues

1. **Database Connection**
   - Verify `DATABASE_URL` is set correctly in your `.env` file
   - Test connection: The `/api/health` endpoint should show `"database": "connected"`

2. **API Key**
   - Verify `SUPER_MIND_API_KEY` or `AI_BUILDER_TOKEN` is set in `.env`
   - The health endpoint should show `"apiKey": "set"`

3. **Port Mismatch**
   - If you're running on port 3002, make sure your `.env` or dev server is configured correctly
   - The frontend uses relative URLs (`/api/...`) which should work regardless of port

4. **Browser Console Errors**
   - Open browser DevTools (F12)
   - Check the Console tab for detailed error messages
   - Check the Network tab to see the actual HTTP request/response

### Quick Test

Test the API directly:

```bash
# PowerShell
$body = @{
    householdId = "00000000-0000-0000-0000-000000000000"
    initiatedByUserId = "00000000-0000-0000-0000-000000000001"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3002/api/sessions/start" -Method POST -ContentType "application/json" -Body $body
```

If you get a 404 error, the household/user don't exist. Run the setup script.

