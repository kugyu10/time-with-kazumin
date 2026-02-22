# Technology Stack

**Analysis Date:** 2026-02-22

## Languages

**Primary:**
- TypeScript 5.x - All application code (frontend, API routes, utilities)

**Secondary:**
- JavaScript - Configuration files, build scripts
- SQL - Database migrations and PostgreSQL functions
- Deno (TypeScript) - Supabase Edge Functions

## Runtime

**Environment:**
- Node.js 20.x (LTS) - Server runtime
- Browser runtime - Client-side code

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` (expected to be present)

## Frameworks

**Core:**
- Next.js (App Router) - Full-stack framework, API routes, server components
- React 19.x - UI component framework

**Styling & UI:**
- Tailwind CSS - Utility-first CSS framework
- shadcn/ui - Accessible React component library (copy-paste based)

**Testing:**
- Not yet implemented (planned for Phase 5+)

**Build/Dev:**
- TypeScript 5.x - Language compilation
- Vercel deployment platform - Automatic builds via Next.js

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` - Database client, auth, real-time subscriptions
- `@supabase/ssr` - Server-side session management for auth
- Supabase Edge Functions (Deno) - Serverless functions for automated tasks

**Infrastructure:**
- `resend` - Transactional email service SDK
- `react-email` - React components for email template building
- Google Calendar API (REST) - Calendar integration
- Zoom API (REST) - Video meeting platform integration

## Configuration

**Environment:**
- `.env.local` file for local development
- Environment variables required for different services (Supabase, Google, Zoom, Resend)
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.ts` - Tailwind CSS theme customization (orange brand color)

**Build:**
- `next.config.ts` - Next.js build configuration
- `tsconfig.json` - TypeScript compilation settings

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js 20.x
- Supabase CLI for local development and migrations
- Git for version control

**Production:**
- Vercel platform for hosting
- Supabase cloud project for database/auth/edge functions
- External services: Google Calendar API, Zoom API, Resend email

---

*Stack analysis: 2026-02-22*
*Update after major dependency changes or framework upgrades*
