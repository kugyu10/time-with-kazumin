# External Integrations

**Analysis Date:** 2026-02-22

## APIs & External Services

**Google Calendar API:**
- Service account-based integration with Kazumin's personal calendar
  - SDK/Client: Direct REST API calls (Node.js fetch)
  - Auth: Service account JSON key in `GOOGLE_SERVICE_ACCOUNT_KEY` env var
  - Primary use: Free/busy query (`calendar.freebusy.query`), event creation/deletion
  - Holiday detection: Queries `ja.japanese#holiday@group.v.calendar.google.com`

**Zoom API:**
- Server-to-Server OAuth with dual account support
  - SDK/Client: Direct REST API calls (Node.js fetch)
  - Account A (Paid): Credentials in `ZOOM_A_ACCOUNT_ID`, `ZOOM_A_CLIENT_ID`, `ZOOM_A_CLIENT_SECRET`
  - Account B (Free): Credentials in `ZOOM_B_ACCOUNT_ID`, `ZOOM_B_CLIENT_ID`, `ZOOM_B_CLIENT_SECRET`
  - Endpoints used: `POST /users/me/meetings` (create), `DELETE /meetings/{meetingId}` (delete)
  - Account selection: Based on `meeting_menus.zoom_account_key` field

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary data store with row-level security (RLS)
  - Connection: Via `NEXT_PUBLIC_SUPABASE_URL` and keys
  - Client: `@supabase/supabase-js` v2.x
  - Migrations: SQL files in `supabase/migrations/` (001-010 planned)
  - Authentication: Integrated Supabase Auth system

**File Storage:**
- Not implemented yet (public/private may use Supabase Storage in future)

**Caching:**
- In-memory cache for Google Calendar sync timestamps (on-demand approach)
- Sync interval: 15 minutes minimum between full syncs
- Storage location: `app_settings` table key-value pairs

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Email/password and OAuth
  - Implementation: `@supabase/supabase-js` client + `@supabase/ssr` for session management
  - Token storage: httpOnly cookies (secure, HTTP-only via SSR package)
  - Session management: JWT refresh tokens handled automatically by Supabase
  - User trigger: Auto-creation of profile record in `profiles` table on signup

**OAuth Integrations:**
- Google OAuth - Social sign-in via Supabase
  - Credentials: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Scopes: Email, profile (managed by Supabase)

**Role-Based Access:**
- Admin role: Manual assignment in Supabase Auth metadata
- Member/Guest: Distinction via `profiles.role` column
- RLS policies enforce access control at database level

## Monitoring & Observability

**Error Tracking:**
- Not yet implemented (future consideration)

**Analytics:**
- Not yet implemented (future consideration: possibly Mixpanel)

**Logs:**
- Vercel function logs - stdout/stderr captured by Vercel platform
- Supabase logs - Available in Supabase dashboard

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js application hosting
  - Deployment: Automatic on git push to main branch
  - Environment vars: Configured in Vercel project settings
  - Preview deploys: Automatic on PR creation

**CI Pipeline:**
- GitHub Actions - For tests and type checking (planned for Phase 5+)
  - Workflows: `.github/workflows/` (not yet created)
  - Secrets: Can be stored in GitHub repo secrets if needed

## Environment Configuration

**Development:**
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (RLS bypass, server-only)
  - `GOOGLE_SERVICE_ACCOUNT_KEY` - Google service account JSON
  - `GOOGLE_CALENDAR_ID` - Kazumin's Google Calendar ID
  - `ZOOM_A_ACCOUNT_ID`, `ZOOM_A_CLIENT_ID`, `ZOOM_A_CLIENT_SECRET`
  - `ZOOM_B_ACCOUNT_ID`, `ZOOM_B_CLIENT_ID`, `ZOOM_B_CLIENT_SECRET`
  - `RESEND_API_KEY` - Resend email service key
  - `FROM_EMAIL` - Sender email address for notifications
- Secrets location: `.env.local` (gitignored), shared via secure team channel
- Mock/stub services: Supabase offers free tier suitable for local testing

**Staging:**
- Environment-specific setup: Separate Supabase project for staging
- Uses test credentials for Zoom and Resend
- Vercel preview deployments serve as staging environments

**Production:**
- Secrets management: Vercel environment variables (encrypted at rest)
- Database: Supabase production project with automatic daily backups
- External services: Production credentials for Google, Zoom, Resend

## Webhooks & Callbacks

**Incoming:**
- Not yet implemented (future additions):
  - Stripe webhooks for payment events (planned)
  - Zoom webhooks for meeting status changes (optional)

**Outgoing:**
- Resend email webhooks - Status tracking for email delivery (optional)
- Supabase Edge Function triggers - Time-based (cron):
  - `monthly-point-grant` - Monthly automatic point allocation
  - `send-reminder` - Daily booking reminders (9:00 JST)
  - `send-thankyou` - Post-session thank you emails (every 30 minutes)

## Key Integration Flows

**Booking Creation (Critical Path):**
1. Slot availability check via Google Calendar API (`freebusy.query`)
2. Point consumption via Supabase PostgreSQL function (`consume_points`)
3. Zoom meeting creation (account A or B based on menu)
4. Google Calendar event insertion for admin calendar
5. Booking record creation in Supabase
6. Confirmation email via Resend

**Booking Cancellation:**
1. Point refund via `refund_points` function
2. Zoom meeting deletion
3. Google Calendar event deletion
4. Booking status update to 'cancelled'
5. Cancellation email via Resend

**Calendar Sync (On-Demand):**
1. Check last sync timestamp in `app_settings` table
2. If > 15 minutes: Query Google Calendar API for busy times and holidays
3. Filter available slots based on busy times + buffer settings
4. Return slot list to frontend

---

*Integration audit: 2026-02-22*
*Update when adding/removing external services*
