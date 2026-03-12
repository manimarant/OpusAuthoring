# Vercel Deployment

## What was added

- `vercel.json` for a Vite frontend build with a serverless API function
- `api/[...route].ts` to run the existing Express routes on Vercel
- `server/app.ts` so the same app bootstrapping works locally and on Vercel
- upload path handling that switches to `/tmp` on Vercel

## Required environment variables

Set these in the Vercel project:

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `OPENAI_API_KEY` if OpenAI-backed generation is used
- any other AI provider keys already required by your `.env`

## Vercel project settings

- Framework Preset: `Vite`
- Build Command: `vite build`
- Output Directory: `dist/public`

## Important limitation

Vercel does not provide persistent local disk storage.

This means:

- reference file uploads and media uploads must use Blob storage in production
- this repo now uses Vercel Blob automatically when `BLOB_READ_WRITE_TOKEN` is present

There is still one platform limit from Vercel Functions:

- server-uploaded request bodies are limited to 4.5 MB on Vercel
- larger uploads need a future client-upload flow instead of the current server upload endpoints

## Deploy

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add the required environment variables.
4. Deploy.

If you prefer the CLI:

```bash
npm i -g vercel
vercel
```
