# Vercel Deployment - Fixing Course Creation Error

## Problem
The error "Failed to create course and generate outline" occurs when creating a course on Vercel because the `GEMINI_API_KEY` environment variable is missing.

## Root Cause
The application uses Google's Gemini API to generate course outlines. The `gemini-flash-latest` model is called in `server/ai-service.ts`, which requires the `GEMINI_API_KEY` to be configured. When this environment variable is missing on Vercel, the API call fails.

## Solution: Add Missing Environment Variables to Vercel

### Step 1: Get Your Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Click **"Create API Key"** (or create a new project if needed)
3. Copy your API key

### Step 2: Add Environment Variables to Vercel Project

#### Option A: Using Vercel Dashboard (Recommended)
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project (OpusAuthoring)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables for **Production**, **Preview**, and **Development**:

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` | Your Google Gemini API key from Step 1 |
   | `DATABASE_URL` | Your Neon database connection string |
   | `BLOB_READ_WRITE_TOKEN` | Your Vercel Blob token (if using file uploads) |

5. Click **Save**

#### Option B: Using Vercel CLI
```bash
vercel env add GEMINI_API_KEY
# Paste your Google Gemini API key
# Select which environments: Production, Preview, Development (select all)

vercel env add DATABASE_URL
# Paste your database connection string

vercel env add BLOB_READ_WRITE_TOKEN
# Paste your Vercel Blob token (if using uploads)
```

### Step 3: Redeploy
After adding the environment variables, trigger a new deployment:
```bash
vercel deploy --prod
```

Or just push to your connected GitHub repo - Vercel will automatically redeploy.

## Verification

After deployment, test by:
1. Creating a new course with a topic, target audience, and learning objectives
2. Clicking **Generate Course**
3. The course outline should now generate successfully

## Fallback Logic
Note: The application has fallback logic built in. If the Gemini API fails for any reason (rate limiting, temporary outage), it will automatically use a generated fallback outline. This ensures the course still gets created, just with a generic structure rather than AI-optimized.

## Troubleshooting

### Still Getting the Error?
1. **Verify variables are set**: Go to Vercel Dashboard → Project Settings → Environment Variables and confirm all three variables are there
2. **Check variable names**: Ensure exact spelling - `GEMINI_API_KEY` (case-sensitive)
3. **Verify production values**: Make sure variables are set for the Production environment
4. **Wait for new deployment**: Vercel caches deployments; wait a few minutes after adding variables
5. **Check API key validity**: Test your Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikeys)

### Check Server Logs
In Vercel Dashboard:
1. Go to your project
2. Click **Deployments** → select the latest deployment
3. Click **Logs** tab
4. Look for "Failed to generate course outline" errors - these will show the actual API error

## Additional Notes
- The `GEMINI_API_KEY` is used only for server-side course outline generation
- No API keys should be exposed to the client/frontend
- The application will work with or without an API key (it has fallback logic), but course outlines won't be AI-generated
