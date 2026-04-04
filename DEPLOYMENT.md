# Deployment Guide

This document covers deployment procedures for the Social DM Copilot application, including Vercel deployment, environment variable configuration, SPA routing, CI/CD with GitHub Actions, and troubleshooting.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Configuration](#build-configuration)
- [Environment Variables](#environment-variables)
- [Vercel Deployment](#vercel-deployment)
  - [Automatic Deployment via Git](#automatic-deployment-via-git)
  - [Manual Deployment via CLI](#manual-deployment-via-cli)
- [SPA Rewrite Setup](#spa-rewrite-setup)
- [CI/CD with GitHub Actions](#cicd-with-github-actions)
- [Alternative Static Hosting](#alternative-static-hosting)
- [Build Commands Reference](#build-commands-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** 18+ and **npm** 9+
- A [Vercel](https://vercel.com) account (for Vercel deployment)
- Git repository connected to Vercel (for automatic deployments)
- Environment variables configured (see below)

## Build Configuration

The application is configured as a **static export** via Next.js 14 App Router. The relevant settings in `next.config.mjs`:

```js
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};
```

- `output: 'export'` produces a fully static site in the `out/` directory.
- `images.unoptimized: true` is required because the Next.js Image Optimization API is not available in static exports.

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure the following variables:

```bash
cp .env.local.example .env.local
```

| Variable | Description | Default | Required |
|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | Application name displayed in the UI header and page title | `Social DM Copilot` | No |
| `NEXT_PUBLIC_CONFIDENCE_THRESHOLD` | Minimum confidence score (0–1) for AI-generated reply suggestions. Drafts below this threshold require mandatory human review before approval. | `0.7` | No |
| `NEXT_PUBLIC_SLA_MINUTES` | SLA response time target in minutes. DMs exceeding this threshold trigger SLA breach notifications. | `30` | No |
| `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` | Seed string used for client-side AES-GCM encryption of sensitive data in IndexedDB. Must be set to a unique, non-empty value in production. | _(empty)_ | **Yes** |

### Environment Variables in Vercel

When deploying to Vercel, configure environment variables in the Vercel dashboard:

1. Navigate to your project in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings** → **Environment Variables**.
3. Add each variable listed above.
4. Set the appropriate scope:
   - **Production**: Variables used in production builds.
   - **Preview**: Variables used in preview/branch deployments.
   - **Development**: Variables used when running `vercel dev` locally.

> **Important:** All environment variables in this project use the `NEXT_PUBLIC_` prefix, which means they are embedded into the client-side JavaScript bundle at build time. Do not store secrets (API keys, database credentials) in these variables. The `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` is used for client-side encryption only and does not protect against a determined attacker with access to the built JavaScript — it provides defense-in-depth for data at rest in IndexedDB.

### Generating an Encryption Key Seed

For production deployments, generate a strong random seed:

```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set the output as the value of `NEXT_PUBLIC_ENCRYPTION_KEY_SEED`.

## Vercel Deployment

### Automatic Deployment via Git

This is the recommended approach for production deployments.

1. **Connect your repository** to Vercel:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Import your Git repository (GitHub, GitLab, or Bitbucket).
   - Vercel will auto-detect the Next.js framework.

2. **Configure build settings** (Vercel auto-detects these, but verify):
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `out`
   - **Install Command:** `npm install`
   - **Node.js Version:** 18.x

3. **Add environment variables** in the Vercel dashboard (see [Environment Variables in Vercel](#environment-variables-in-vercel)).

4. **Deploy:**
   - Push to your default branch (e.g., `main`) to trigger a production deployment.
   - Push to any other branch to trigger a preview deployment.

Vercel will automatically:
- Install dependencies (`npm install`)
- Run the build (`npm run build` → `next build` with `output: 'export'`)
- Deploy the static `out/` directory
- Apply the SPA rewrites from `vercel.json`

### Manual Deployment via CLI

For one-off deployments or testing:

1. **Install the Vercel CLI:**

   ```bash
   npm install -g vercel
   ```

2. **Log in to Vercel:**

   ```bash
   vercel login
   ```

3. **Build the project locally:**

   ```bash
   npm run build
   ```

4. **Deploy:**

   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

5. **Set environment variables via CLI** (alternative to dashboard):

   ```bash
   vercel env add NEXT_PUBLIC_ENCRYPTION_KEY_SEED production
   ```

## SPA Rewrite Setup

The application uses client-side routing via Next.js App Router. For static exports, a rewrite rule is required to serve `index.html` for all non-asset routes. This is configured in `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/((?!_next|favicon.ico|.*\\..*).*)",
      "destination": "/index.html"
    }
  ]
}
```

This rule:
- Matches all routes **except** `_next/` (static assets), `favicon.ico`, and any path containing a file extension (e.g., `.js`, `.css`, `.png`).
- Rewrites matched routes to `/index.html`, allowing the client-side router to handle navigation.

### SPA Rewrites for Other Hosting Providers

If deploying to a provider other than Vercel, configure equivalent rewrite rules:

**Netlify** (`_redirects` file in `out/`):

```
/*    /index.html   200
```

**Nginx:**

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Apache** (`.htaccess` in `out/`):

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

**AWS S3 + CloudFront:**

Configure a custom error response in CloudFront:
- Error Code: `403` → Response Page Path: `/index.html` → Response Code: `200`
- Error Code: `404` → Response Page Path: `/index.html` → Response Code: `200`

## CI/CD with GitHub Actions

Below is a recommended GitHub Actions workflow for automated linting, building, and deploying to Vercel.

### Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

env:
  NEXT_PUBLIC_APP_NAME: Social DM Copilot
  NEXT_PUBLIC_CONFIDENCE_THRESHOLD: "0.7"
  NEXT_PUBLIC_SLA_MINUTES: "30"
  NEXT_PUBLIC_ENCRYPTION_KEY_SEED: ${{ secrets.ENCRYPTION_KEY_SEED }}

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build static export
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: static-export
          path: out/
          retention-days: 7

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: static-export
          path: out/

      - name: Deploy to Vercel (Preview)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: static-export
          path: out/

      - name: Deploy to Vercel (Production)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: --prod
          working-directory: ./
```

### Required GitHub Secrets

Configure the following secrets in your GitHub repository under **Settings** → **Secrets and variables** → **Actions**:

| Secret | Description | How to Obtain |
|---|---|---|
| `VERCEL_TOKEN` | Vercel API token for deployments | [Vercel Tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Vercel organization/team ID | Run `vercel link` locally → check `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Vercel project ID | Run `vercel link` locally → check `.vercel/project.json` → `projectId` |
| `ENCRYPTION_KEY_SEED` | Encryption key seed for builds | Generate with `openssl rand -base64 32` |

### Linking Vercel Project Locally

To obtain `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`:

```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Link the project
vercel link

# The IDs are stored in .vercel/project.json
cat .vercel/project.json
```

Output:

```json
{
  "orgId": "your-org-id-here",
  "projectId": "your-project-id-here"
}
```

> **Note:** The `.vercel/` directory is not committed to Git (it is excluded by `.gitignore`).

## Alternative Static Hosting

Since the application produces a static export, it can be deployed to any static hosting provider.

### Netlify

1. Connect your Git repository to Netlify.
2. Set build settings:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `out`
3. Add environment variables in the Netlify dashboard.
4. Add a `_redirects` file to the `public/` directory:
   ```
   /*    /index.html   200
   ```

### GitHub Pages

1. Build the project: `npm run build`
2. Deploy the `out/` directory to the `gh-pages` branch.
3. Note: GitHub Pages does not support SPA rewrites natively. Add a `404.html` that redirects to `index.html`, or use a hash-based routing workaround.

### AWS S3 + CloudFront

1. Build the project: `npm run build`
2. Upload the `out/` directory to an S3 bucket configured for static website hosting.
3. Create a CloudFront distribution pointing to the S3 bucket.
4. Configure custom error responses for SPA routing (see [SPA Rewrites for Other Hosting Providers](#spa-rewrites-for-other-hosting-providers)).

## Build Commands Reference

| Command | Description |
|---|---|
| `npm install` | Install all dependencies |
| `npm run dev` | Start the development server on `http://localhost:3000` |
| `npm run build` | Build the static export to the `out/` directory |
| `npm start` | Start the Next.js production server (not used for static export) |
| `npm run lint` | Run ESLint with Next.js core web vitals rules |

### Build Output

After running `npm run build`, the `out/` directory contains:

```
out/
├── _next/
│   └── static/          # Hashed JS/CSS bundles and assets
├── index.html           # Main entry point (home page)
├── inbox.html           # Inbox page
├── leads.html           # Leads page
├── notifications.html   # Notifications page
├── audit.html           # Audit log page
├── login.html           # Login page
├── 404.html             # Not found page
└── favicon.ico          # Favicon (if present in public/)
```

## Troubleshooting

### Build Fails with "Export encountered errors"

**Symptom:** `npm run build` fails with errors about dynamic server usage.

**Cause:** Next.js static export does not support server-side features like `getServerSideProps`, `cookies()`, `headers()`, or dynamic route segments without `generateStaticParams`.

**Solution:** This application is designed for static export. All pages use `'use client'` directives and client-side data fetching. If you see this error, ensure no server-only APIs have been introduced.

### Blank Page After Deployment

**Symptom:** The deployed site shows a blank white page with no content.

**Possible causes and solutions:**

1. **Missing SPA rewrite rule:** Ensure `vercel.json` is present in the project root with the correct rewrite configuration. For non-Vercel hosts, configure equivalent rewrite rules.

2. **Missing environment variables:** Check that `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` is set. Without it, the encryption utility falls back to a default seed, but authentication state restoration may fail silently.

3. **JavaScript errors:** Open the browser developer console (F12) and check for errors. Common issues include:
   - IndexedDB access blocked in private/incognito mode
   - Web Crypto API unavailable (requires HTTPS in production)

### IndexedDB Errors in Production

**Symptom:** Console errors related to IndexedDB operations or "Database upgrade blocked" warnings.

**Possible causes and solutions:**

1. **Multiple tabs:** If a user has multiple tabs open during a database schema upgrade, the upgrade may be blocked. Close other tabs and refresh.

2. **Private browsing:** Some browsers restrict IndexedDB in private/incognito mode. The application requires IndexedDB for data persistence.

3. **Storage quota exceeded:** Clear browser storage for the site if the IndexedDB quota is exceeded.

### Encryption Errors

**Symptom:** Console warnings about failed encryption/decryption operations.

**Possible causes and solutions:**

1. **Changed encryption key seed:** If `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` is changed between deployments, previously encrypted data in IndexedDB cannot be decrypted. Users will need to clear their browser storage.

2. **HTTP instead of HTTPS:** The Web Crypto API requires a secure context (HTTPS) in production. Ensure the deployment uses HTTPS.

3. **Missing localStorage access:** The encryption key salt is stored in localStorage. If localStorage is unavailable (e.g., storage disabled by browser settings), encryption will fail.

### SLA Breach Notifications Not Appearing

**Symptom:** DMs exceed the SLA threshold but no breach notifications are created.

**Possible causes and solutions:**

1. **SLA monitoring not started:** The SLA monitor must be explicitly started via the EventContext. Verify that the application initializes monitoring on load.

2. **Mock data timestamps:** The mock DM timestamps in `mock-dms.json` are fixed dates. If the current time is far from these dates, all DMs will immediately be in breach (or none will be, depending on the direction). This is expected behavior for the pilot.

3. **`NEXT_PUBLIC_SLA_MINUTES` misconfigured:** Verify the environment variable is set to a reasonable value (default: 30).

### Vercel Deployment Fails

**Symptom:** Vercel build fails during deployment.

**Possible causes and solutions:**

1. **Node.js version mismatch:** Ensure the Vercel project is configured to use Node.js 18+. Check **Settings** → **General** → **Node.js Version** in the Vercel dashboard.

2. **Missing dependencies:** Run `npm install` locally and verify `package-lock.json` is committed. Vercel uses `npm ci` which requires a lockfile.

3. **Build command override:** Verify the build command in Vercel is set to `npm run build` (or left as auto-detected).

4. **Output directory:** Ensure the output directory is set to `out` in Vercel project settings.

### Fonts Not Loading

**Symptom:** The Inter font does not load and the UI falls back to system fonts.

**Cause:** The application loads Inter from Google Fonts via a `<link>` tag in the root layout. If the deployment blocks external font requests (e.g., CSP headers), fonts will not load.

**Solution:** Verify that `fonts.googleapis.com` and `fonts.gstatic.com` are allowed in any Content Security Policy headers configured on the hosting provider.

---

## Security Considerations

- **Client-side encryption** provides defense-in-depth for data at rest in IndexedDB. It does not replace server-side security for production systems handling real customer data.
- **PII stripping** is applied to all audit log entries before storage. Exported CSV files contain PII-stripped data.
- **Consent verification** is enforced before outbound messages can be approved. The compliance banner and consent checkbox components enforce this workflow.
- **HTTPS is required** in production for the Web Crypto API and to protect data in transit.
- All `NEXT_PUBLIC_` environment variables are embedded in the client-side bundle and visible to end users. Do not store sensitive secrets in these variables.

---

## Support

For issues related to the Social DM Copilot pilot deployment, refer to:

- **README.md** — Project overview, setup, and feature documentation
- **CHANGELOG.md** — Version history and release notes
- **Vercel Documentation** — [vercel.com/docs](https://vercel.com/docs)
- **Next.js Static Export** — [nextjs.org/docs/app/building-your-application/deploying/static-exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)