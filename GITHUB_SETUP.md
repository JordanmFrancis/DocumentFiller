# GitHub Authentication Setup

GitHub no longer accepts passwords. You need a **Personal Access Token** (PAT).

## Quick Setup

### Option 1: Personal Access Token (Easiest)

1. **Create a Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name it: "DocumentFiller"
   - Select scopes: ✅ `repo` (full control of private repositories)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again!)

2. **Use the Token:**
   ```bash
   git push -u origin main
   ```
   - Username: `SuperJKid08`
   - Password: **Paste your token** (not your GitHub password)

### Option 2: SSH Keys (More Secure, One-Time Setup)

1. **Generate SSH Key:**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Press Enter to accept default location
   # Press Enter twice for no passphrase (or set one)
   ```

2. **Copy Public Key:**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # Copy the entire output
   ```

3. **Add to GitHub:**
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Title: "MacBook Pro"
   - Paste your public key
   - Click "Add SSH key"

4. **Change Remote to SSH:**
   ```bash
   git remote set-url origin git@github.com:SuperJKid08/DocumentFiller.git
   git push -u origin main
   ```

## Recommended: Use Personal Access Token for Now

It's faster and easier. You can switch to SSH later if you want.
