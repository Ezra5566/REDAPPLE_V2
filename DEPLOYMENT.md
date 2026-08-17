# DEPLOYMENT.md — Vercel (storefront) + Render (backend)

Deployment checklist for this project: a **Next.js 16 storefront** (`apps/storefront/`)
on Vercel talking to a **Rails/Spree API** (`backend/`) on Render.

> This project uses the Solid stack (Solid Queue / Solid Cache / Solid Cable) — all
> background jobs, caching, and Action Cable live in Postgres. **No Redis is required.**

---

## 1. Deploy order (do not skip)

1. **Push the repo to GitHub.** Render and Vercel auto-deploy from a Git repo. Before
   pushing, confirm `.env`, `.env.local`, and `.spree/credentials.json` are **not**
   committed (they contain real secrets and are gitignored).
2. **Deploy the backend to Render first.** The storefront *prerenders pages against the
   Spree API at build time* — if the API isn't reachable during the Vercel build, the
   build fails.
3. **Complete the backend post-deploy steps** (§4) — seed, API key, gateways.
4. **Deploy the storefront to Vercel** with the env vars in §6.
5. **Wire webhooks** (§7) and run the smoke test (§8).

---

## 2. Render — project setup (blueprint)

`render.yaml` at the repo root already defines the web service (Docker, `backend/Dockerfile`,
health check `/up`) and the Postgres database. Two changes are required before this is
production-viable:

### 2.1 Upgrade off the free plan

- **Postgres:** free Render Postgres **expires 30 days after creation** and then gets
  deleted. Upgrade to a paid plan (automatic backups included).
- **Web service:** free instances have 512 MB RAM (Spree + the in-process Solid Queue
  supervisor need ~1 GB) and **sleep after 15 minutes idle**, which breaks checkouts and
  ISR revalidation. Use at least a paid Starter/Standard plan.

### 2.2 Add a release-phase command

Migrations currently run from the Docker entrypoint (`db:prepare` on every boot), which
races once you scale past one instance and never runs `spree:upgrade`. Replace it with a
`preDeployCommand`:

```yaml
# render.yaml — add under the web service
preDeployCommand: bundle exec rake spree:install:migrations db:migrate && bundle exec rake spree:upgrade
```

> `preDeployCommand` runs migrations/upgrades once per deploy, before the new version
> receives traffic. The entrypoint's `db:prepare` remains as a first-boot fallback.

### 2.3 (Optional) Dedicated worker

On a paid plan you can split job processing out of Puma: uncomment the `spree-worker`
service in `render.yaml` and set `SOLID_QUEUE_IN_PUMA=false` on the web service.

---

## 3. Render — environment variables

Set these in the Render dashboard (Service → Environment) or the blueprint. Values marked
“already in blueprint” are generated/configured by the shipped `render.yaml`.

### Required

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | *(auto from Render Postgres addon)* | Already wired in `render.yaml`. |
| `SECRET_KEY_BASE` | *(auto-generated, then PIN it)* | `render.yaml` generates it once — **but re-importing the blueprint or recreating the service regenerates it**, which silently breaks every signed URL (image URLs, cart/session tokens). After first deploy, copy the generated value and set it as a literal so it can never rotate. |
| `RAILS_ENV` | `production` | Already set by the Dockerfile. |

### Required for production functionality (not yet in the blueprint)

| Variable | Value | Notes |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `…` | **File storage.** Unset → local disk → **product images vanish on every deploy**. Use S3 *or* R2. |
| `AWS_SECRET_ACCESS_KEY` | `…` | |
| `AWS_REGION` | e.g. `us-east-1` | |
| `AWS_BUCKET` | e.g. `redapple-production` | |
| *(or R2 instead)* `CLOUDFLARE_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` | |
| *(or R2)* `CLOUDFLARE_ACCESS_KEY_ID` / `CLOUDFLARE_SECRET_ACCESS_KEY` / `CLOUDFLARE_BUCKET` | `…` | |
| `SMTP_HOST` | e.g. `smtp.resend.com` | **Transactional email from the backend.** Unset → no mail in production. |
| `SMTP_PORT` | `587` | STARTTLS. |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | `…` | Provider credentials. |
| `SMTP_FROM_ADDRESS` | `store@example.com` | |

### Recommended

| Variable | Value | Notes |
|---|---|---|
| `RAILS_HOST` | `store.example.com` | Public host for generated URLs (image URLs in API responses, email links). Falls back to `RENDER_EXTERNAL_HOSTNAME` when unset — set it once you add a custom domain. |
| `RAILS_LOG_LEVEL` | `info` | Already in `render.yaml`. |
| `MISSION_CONTROL_USER` / `MISSION_CONTROL_PASSWORD` | *(auto-generated)* | HTTP Basic auth for the `/jobs` dashboard. Already in `render.yaml`. |
| `JWT_SECRET_KEY` | *(generate, e.g. `bin/rails secret`)* | Dedicated key for signing customer auth tokens. Unset, Spree falls back to `SECRET_KEY_BASE` (works, but a separate key is best practice — see the boot log warning). |

### Optional

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Enables backend error tracking (initializer is gated on this). |
| `MEILISEARCH_URL` / `MEILISEARCH_API_KEY` | Only if the catalog exceeds ~10K products; otherwise DB search is used. Requires `spree:search:reindex` after enabling. |
| `RAILS_MAX_THREADS` / `WEB_CONCURRENCY` / `JOB_THREADS` | Tuning. Defaults: threads 3, workers 1, job threads 3. DB pool auto-sizes as `threads + job_threads + 3`. |
| `CDN_HOST` | Host-only CDN for assets/images. |
| `SOLID_QUEUE_IN_PUMA` | `false` only when running a dedicated worker service (§2.3). |
| `RAILS_FORCE_SSL` / `RAILS_ASSUME_SSL` | Leave unset — both default to **on**, which is correct behind Render's TLS. |

---

## 4. Render — post-deploy admin steps

Run these once the web service reports healthy (`GET /up` → 200).

1. **Verify the store was seeded.** The entrypoint's `db:prepare` seeds on first boot
   (creates `Spree::Store` + admin user). If every API request 404s with
   `ActiveRecord::RecordNotFound`, create the store via Render Shell:
   ```ruby
   Spree::Store.create!(name: 'REDAPPLE', url: ENV['RAILS_HOST'], code: 'redapple',
                        mail_from_address: 'no-reply@example.com', default_currency: 'USD', default: true)
   ```
2. **Change the seeded admin password.** The seed creates `spree@example.com` /
   `spree123` — change it in the Admin UI immediately.
3. **Create a publishable API key for the storefront.** In `/admin → Settings →
   Developers → API Keys → New Key` with type **Publishable** (or via CLI:
   `pnpm spree auth login --profile render --base-url https://<your-render-host>`, then
   `pnpm spree api-key create --name Storefront --type publishable`). Paste the
   `pk_…` value into Vercel as `SPREE_PUBLISHABLE_KEY`.
4. **Configure the store.** Set the store's URL to your domain, default currency, and
   Markets/countries to match the storefront (`NEXT_PUBLIC_DEFAULT_COUNTRY` /
   `NEXT_PUBLIC_DEFAULT_LOCALE` must resolve to a real Market).
5. **Configure payment gateways** (`/admin → Settings → Payments`):
   - Stripe: add `SpreeStripe::Gateway` with your publishable/secret keys; set the
     return/cancel URLs to the **Vercel domain**; configure the Stripe webhook in the
     Stripe dashboard pointing at the backend's Stripe webhook endpoint.
   - PayPal / Adyen: same pattern — gateway credentials + return URLs.
6. **Set the storefront URL as an allowed origin** only if you ever call the Admin API
   from a browser on another domain (`Spree::AllowedOrigin`); the storefront talks to
   the Store API **server-side**, so no CORS config is needed for it.

---

## 5. Vercel — project settings

1. **Import the repo** → project. Set **Root Directory** to `apps/storefront`.
2. **Framework preset:** Next.js (auto-detected). Install command `pnpm install
   --frozen-lockfile`; build command `pnpm build` (defaults are fine).
3. **Node version:** 20+ (Vercel default is fine; CI uses 20).
4. **Function region:** set close to your Render region (e.g. `iad1` for Virginia) to
   minimize API latency.
5. **Custom domain:** add it and set `NEXT_PUBLIC_SITE_URL` to match.

---

## 6. Vercel — environment variables

> `NEXT_PUBLIC_*` vars are **inlined at build time** — changing them requires a redeploy.
> `SPREE_API_URL` / `SPREE_PUBLISHABLE_KEY` are server-side only (never shipped to the
> browser).

### Required

| Variable | Value | Notes |
|---|---|---|
| `SPREE_API_URL` | `https://<your-render-host>.onrender.com` (or custom domain) | The Spree Store API base URL. |
| `SPREE_PUBLISHABLE_KEY` | `pk_…` | From §4 step 3. |
| `NEXT_PUBLIC_DEFAULT_COUNTRY` | `us` | Must match a Market on the backend. |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en` | One of `en`, `de`, `es`, `fr`, `pl` (the shipped message bundles). |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-store>.vercel.app` or custom domain | Falls back to the auto-injected `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`; set explicitly to be safe. |

### Recommended

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_STORE_NAME` | `REDAPPLE` | Shown in headers/emails. |
| `NEXT_PUBLIC_STORE_DESCRIPTION` | `…` | Used in meta description / JSON-LD. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | Required for Stripe checkout to render. |
| `SPREE_WEBHOOK_SECRET` | *(from the Spree webhook you create in §7)* | Powers transactional emails + password reset. |
| `RESEND_API_KEY` | `re_…` | Required for the storefront to send emails via webhooks. |
| `EMAIL_FROM` | `REDAPPLE <orders@your-domain.com>` | Must be a verified sender in Resend. |

### Optional

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Only if PayPal is enabled on the backend. |
| `NEXT_PUBLIC_ADYEN_CLIENT_KEY` / `NEXT_PUBLIC_ADYEN_ENVIRONMENT` | Only if Adyen is enabled. |
| `NEXT_PUBLIC_DEFAULT_COUNTRY`/`LOCALE` beyond defaults | Only if your default market differs. |
| `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Enables error tracking + source-map uploads. Build works without them. |
| `SPREE_WHOLESALE_CHANNEL` / `SPREE_WHOLESALE_PUBLISHABLE_KEY` | Only for the B2B/wholesale portal. |
| `SPREE_IMAGES_URL` | Only if images are served from a different host than the API. |
| `GTM_ID`, `STORE_SEO_TITLE`, `STORE_META_DESCRIPTION`, social/org links | SEO / analytics. |

---

## 7. Wiring the two together

1. **Webhooks (backend → storefront):** in Spree admin (`/admin → Settings →
   Developers → Webhooks`) create an endpoint:
   - URL: `https://<your-store>.vercel.app/api/webhooks/spree`
   - Events: `order.completed`, `order.canceled`, `order.shipped`,
     `customer.password_reset_requested`
   - Copy the endpoint's **secret key** into Vercel as `SPREE_WEBHOOK_SECRET`.
2. **Product images:** the storefront allows images from the `SPREE_API_URL` host via
   Active Storage paths. If you later move images to a CDN, set `SPREE_IMAGES_URL` and
   `CDN_HOST` on the backend.
3. **Search:** you're on DB search (fine under ~10K products). If you enable Meilisearch
   later, run `bin/rails spree:search:reindex` after deploy.

---

## 8. Final smoke test

- [ ] `GET https://<render-host>/up` → 200
- [ ] Storefront homepage loads (products, images) and redirects to `/{country}/{locale}/`
- [ ] Product detail page renders with prices in the right currency
- [ ] Add to cart → cart persists across reloads (cookie)
- [ ] Guest checkout completes in **test mode** with a real payment provider; order shows
      in `/admin`; confirmation email arrives
- [ ] Password reset email arrives and the link works
- [ ] `/admin` (login works, default password changed) and `/jobs` (basic auth) on Render
- [ ] Redeploy the Render backend once and confirm product images still display
      (proves S3/R2 is active)
- [ ] Edit a product price in `/admin` → confirm it shows up on the storefront within
      ~1 h (10-min revalidation, 1-h cache expiry — instant updates need a product
      webhook → `revalidateTag`)

---

## 9. Troubleshooting quick reference

| Symptom | Cause / fix |
|---|---|
| Every API request 404s (`ActiveRecord::RecordNotFound`) | No `Spree::Store` record — run the create snippet in §4 step 1. |
| Images upload but don't display | ActiveStorage on local disk (ephemeral) — set S3/R2; or bucket policy blocks public/signed URLs. |
| Product/category data shows but **every image 500s/422s** on `…/rails/active_storage/representations/proxy/…` | Stale signed URLs — `SECRET_KEY_BASE` changed after the frontend pages were built/cached. Pin `SECRET_KEY_BASE` (see §1), redeploy Vercel to regenerate URLs, hard-refresh. Verify: `rails runner` round-trip of `cdn_image_url` (see the image-troubleshooting notes). **Also check: is Vercel's `SPREE_API_URL` pointing at the same Render service you're actually working in?** Recreating the service (e.g. a "v2") changes both its host and its `SECRET_KEY_BASE` — the storefront must be repointed at the new host and redeployed, and the old service deleted. |
| Webhooks never arrive / emails missing | `SPREE_WEBHOOK_SECRET` mismatch, endpoint not created in Spree admin, or Vercel env missing. |
| Storefront build fails on Vercel | Backend not deployed/reachable yet — deploy Render first, then set `SPREE_API_URL` + `SPREE_PUBLISHABLE_KEY`. |
| Checkout is slow / fails at night | Backend on the free plan is asleep or OOM — upgrade. |
