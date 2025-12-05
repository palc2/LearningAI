# Security Guide

## Important: Removing Sensitive Data from Git History

If you've accidentally committed `deploy-config.json` (which contains database credentials) to GitHub, you need to remove it from Git history.

### Step 1: Remove from Current Commit (Already Done)
✅ `deploy-config.json` has been removed from Git tracking using `git rm --cached`

### Step 2: Remove from Git History (If Already Pushed to GitHub)

**⚠️ WARNING: This rewrites Git history. Only do this if the file was already pushed to GitHub.**

If `deploy-config.json` was already pushed to GitHub, you need to remove it from all Git history:

```bash
# Remove the file from all Git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch deploy-config.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to GitHub (this will overwrite history)
git push origin --force --all
git push origin --force --tags
```

**Alternative (using git-filter-repo - recommended):**
```bash
# Install git-filter-repo first: pip install git-filter-repo
git filter-repo --path deploy-config.json --invert-paths
git push origin --force --all
```

### Step 3: Rotate Your Database Credentials

**⚠️ CRITICAL: Since your database password was exposed, you should:**

1. **Change your Neon database password immediately:**
   - Log into your Neon dashboard
   - Generate a new password
   - Update `deploy-config.json` locally with the new password

2. **Update the password in your deployment:**
   - Update `deploy-config.json` with the new password
   - Redeploy your application

### Step 4: Verify .gitignore

Make sure `deploy-config.json` is in `.gitignore` (it already is):
```
deploy-config.json
```

### Going Forward

- ✅ `deploy-config.json` is now in `.gitignore` - it won't be committed
- ✅ Use `deploy-config.json.example` as a template (this file is safe to commit)
- ✅ Never commit files with passwords, API keys, or sensitive data
- ✅ Always check `git status` before committing to ensure sensitive files aren't included

