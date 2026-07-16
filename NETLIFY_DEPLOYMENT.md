# 🌐 NETLIFY DEPLOYMENT GUIDE - Fun N' Fit Tracker

## ⚡ STEP-BY-STEP: Deploy to Netlify

### **Step 1: Prepare Your Code**

First, let's make sure everything is ready for deployment.

#### **1.1 Create `.env.example` file:**
```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_API_KEY=your_google_ai_key_here
```

#### **1.2 Create `netlify.toml` configuration:**
This file tells Netlify how to build and serve your app.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### **1.3 Verify build works:**
```bash
npm run build
npm run preview
```

---

### **Step 2: Push to GitHub**

#### **2.1 Initialize Git (if not already):**
```bash
cd /Users/lawrenceberment/Downloads/fun-n\'-fit-tracker
git init
git add .
git commit -m "Initial commit - Ready for Netlify"
```

#### **2.2 Create GitHub Repository:**
1. Go to https://github.com/new
2. Repository name: `fun-n-fit-tracker`
3. Make it **Private** (recommended)
4. Click "Create repository"

#### **2.3 Push to GitHub:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/fun-n-fit-tracker.git
git branch -M main
git push -u origin main
```

---

### **Step 3: Deploy to Netlify**

#### **3.1 Sign Up for Netlify:**
1. Go to https://app.netlify.com/signup
2. Click **"Sign up with GitHub"**
3. Authorize Netlify to access your GitHub repositories

#### **3.2 Create New Site:**
1. Click **"Add new site"** → **"Import an existing project"**
2. Click **"Deploy with GitHub"**
3. Authorize Netlify (if prompted)
4. Search for and select your repository: `fun-n-fit-tracker`

#### **3.3 Configure Build Settings:**

Netlify should auto-detect most settings, verify these:

| Setting | Value |
|---------|-------|
| **Base directory** | (leave blank) |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Functions directory** | (leave blank) |

#### **3.4 Add Environment Variables:**

**CRITICAL:** Click "Show advanced" → "New variable"

Add these environment variables:

| Key | Value | Where to Find |
|-----|-------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase Dashboard → Settings → API → Project API keys → anon/public |
| `VITE_API_KEY` | Your Google AI key | Google AI Studio (optional) |

**Example:**
```
VITE_SUPABASE_URL = https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **3.5 Deploy!**
1. Click **"Deploy site"**
2. Netlify will:
   - ✅ Clone your repository
   - ✅ Run `npm install`
   - ✅ Run `npm run build`
   - ✅ Deploy to CDN
3. Wait 2-3 minutes for deployment to complete

#### **3.6 Get Your Live URL:**
Netlify will give you a URL like:
```
https://random-name-12345.netlify.app
```

---

### **Step 4: Configure Custom Domain (Optional)**

#### **4.1 Change Site Name:**
1. Go to **Site settings** → **General** → **Site details**
2. Click **"Change site name"**
3. Enter a custom subdomain like: `fun-n-fit-tracker`
4. Your URL becomes: `https://fun-n-fit-tracker.netlify.app`

#### **4.2 Add Custom Domain (if you own one):**
1. Go to **Domain settings** → **Add custom domain**
2. Enter your domain: `funnfit.com`
3. Follow Netlify's DNS instructions
4. Wait for DNS to propagate (~24 hours)

---

### **Step 5: Configure Supabase**

Now that your app is live, update Supabase to allow requests from your Netlify URL:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to: `https://YOUR-SITE.netlify.app`
5. Add to **Redirect URLs**: `https://YOUR-SITE.netlify.app/**`
6. Click **Save**

---

### **Step 6: Test Everything**

Visit your Netlify URL and test:

- [ ] ✅ App loads correctly
- [ ] ✅ Can login as coach
- [ ] ✅ Can create/edit students
- [ ] ✅ Can award points
- [ ] ✅ QR codes generate and display
- [ ] ✅ QR scanner works (camera access)
- [ ] ✅ Leaderboard updates
- [ ] ✅ Projector mode works
- [ ] ✅ Mobile responsive

---

## 🔄 AUTOMATIC DEPLOYMENTS

**Every time you push to GitHub, Netlify auto-deploys!**

```bash
# Make changes locally
git add .
git commit -m "Add new feature"
git push

# Netlify automatically:
# 1. Detects the push
# 2. Builds your app
# 3. Deploys to production
# 4. Sends you a notification
```

---

## 📊 NETLIFY FEATURES YOU GET (FREE)

✅ **Unlimited personal projects**
✅ **100 GB bandwidth/month**
✅ **Automatic SSL (HTTPS)**
✅ **Global CDN** - Fast everywhere
✅ **Deploy previews** for pull requests
✅ **Instant rollbacks** to previous versions
✅ **Form handling** (if you add forms)
✅ **Custom domains** with free SSL
✅ **Split testing** (A/B testing)

---

## 🐛 TROUBLESHOOTING

### **Build Failed: "Cannot find module"**

**Fix:** Install missing dependencies
```bash
npm install
git add package.json package-lock.json
git commit -m "Fix dependencies"
git push
```

### **Blank Page After Deployment**

**Cause:** Environment variables not set

**Fix:**
1. Go to **Site settings** → **Environment variables**
2. Add all `VITE_*` variables
3. Go to **Deploys** → Click **"Trigger deploy"** → **"Clear cache and deploy site"**

### **404 Error on Page Refresh**

**Cause:** React Router needs redirect configuration

**Fix:** Already handled by `netlify.toml` file we created!
If you didn't create it, add this file to your project root:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### **Supabase Connection Fails**

**Check:**
1. Environment variables are correct (no typos)
2. `VITE_SUPABASE_URL` has no trailing slash
3. Using **anon key**, not secret key
4. Supabase project isn't paused (free tier pauses after 1 week inactivity)

### **Images/Avatars Not Loading**

**Fix:**
1. Check Supabase Storage bucket "Assets" is **public**
2. Verify RLS policies allow public reads
3. Check browser console for CORS errors

---

## 🔒 SECURITY CHECKLIST

Before sharing your app:

- [ ] ✅ `.env` file is in `.gitignore` (never commit secrets!)
- [ ] ✅ Environment variables set in Netlify dashboard
- [ ] ✅ Supabase RLS policies are enabled
- [ ] ✅ Using `anon` key, NOT `service_role` key
- [ ] ✅ Test in incognito mode to verify it works
- [ ] ✅ Check browser console for errors/warnings

---

## 📱 NETLIFY MOBILE APP

Download the Netlify mobile app to monitor deployments on the go:

- **iOS:** https://apps.apple.com/app/netlify/id1518570638
- **Android:** https://play.google.com/store/apps/details?id=com.netlify.app

---

## 🎯 NETLIFY DASHBOARD OVERVIEW

### **Main Tabs:**

1. **Overview**
   - Deployment status
   - Production URL
   - Recent deploys

2. **Deploys**
   - Deploy history
   - Build logs
   - Rollback to previous versions

3. **Site settings**
   - Change site name
   - Environment variables
   - Build & deploy settings

4. **Domain settings**
   - Add custom domains
   - Configure DNS
   - SSL certificates

5. **Functions** (not needed for this app)

6. **Analytics** (upgrade required)

---

## 💰 COST: $0/MONTH

**Netlify Free Tier:**
- ✅ 100 GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ Unlimited sites
- ✅ Automatic HTTPS

**When to upgrade to Pro ($19/mo):**
- Need more than 100 GB bandwidth
- Team collaboration features
- Password-protected sites

**Combined with Supabase Free:**
- **Total Cost: $0/month** 🎉

---

## 🔔 DEPLOYMENT NOTIFICATIONS

Get notified when deployments succeed/fail:

1. Go to **Site settings** → **Build & deploy** → **Deploy notifications**
2. Add notifications:
   - **Email** - Get emails on deploy
   - **Slack** - Post to Slack channel
   - **Webhook** - Send to custom endpoint

---

## 🌟 BONUS FEATURES

### **Deploy Previews for Pull Requests**

When you create a PR on GitHub, Netlify automatically creates a preview URL!

```bash
git checkout -b feature/new-scoring
# Make changes
git push origin feature/new-scoring
# Create PR on GitHub
# Netlify creates preview URL automatically! 🎉
```

### **Instant Rollback**

Made a mistake? Rollback instantly:
1. Go to **Deploys**
2. Find previous working deploy
3. Click **"Publish deploy"**
4. Live in seconds!

### **Split Testing (A/B Testing)**

Test different versions:
1. Create branch: `variant-a`
2. Netlify deploys both `main` and `variant-a`
3. Split traffic 50/50
4. See which performs better

---

## 📋 QUICK REFERENCE

### **Deploy New Changes:**
```bash
git add .
git commit -m "Update feature"
git push
# Netlify auto-deploys!
```

### **View Build Logs:**
1. Go to Netlify dashboard
2. Click **Deploys**
3. Click latest deploy
4. View logs in real-time

### **Environment Variables:**
1. **Site settings** → **Environment variables**
2. Click **Add a variable**
3. Enter key/value
4. Click **Save**
5. **Trigger deploy** to apply

### **Custom Domain:**
1. **Domain settings** → **Add custom domain**
2. Enter domain name
3. Configure DNS with your registrar
4. Wait for DNS propagation
5. Netlify provisions SSL automatically

---

## ✅ POST-DEPLOYMENT CHECKLIST

After your first deploy:

- [ ] Visit your Netlify URL
- [ ] Test on desktop browser
- [ ] Test on mobile phone
- [ ] Test on tablet (if available)
- [ ] Login as coach
- [ ] Create a test student
- [ ] Award points
- [ ] Test QR code generation
- [ ] Test QR scanner
- [ ] Enable projector mode
- [ ] Share URL with coaches
- [ ] Monitor first day of usage

---

## 🎓 SHARE WITH STUDENTS/COACHES

**How to access:**
```
URL: https://your-site.netlify.app
```

**Mobile Installation:**
1. Open URL in phone browser
2. **iOS:** Safari → Share → "Add to Home Screen"
3. **Android:** Chrome → Menu → "Add to Home Screen"
4. App appears like a native app!

**Coach Login:**
- No signup needed
- Just enter their name
- Login persists for the day

**Student QR Codes:**
- Each student has unique QR code in their profile
- Print QR cards for easy check-in
- Scan with phone camera or QR scanner

---

## 🚀 YOU'RE LIVE!

Your Fun N' Fit Tracker is now deployed on Netlify!

**What happens next:**
1. Every push to GitHub auto-deploys
2. Students can access from any device
3. Works offline (with PWA)
4. Scales automatically (Netlify CDN)
5. Free forever (on free tier)

**Need help?** Check Netlify docs: https://docs.netlify.com
