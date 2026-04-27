# Environment and Vercel Setup

## Local `.env.local`

Use this shape for the new app. Do not commit real values.

```env
# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_DEFAULT_ORGANISATION_ID=00000000-0000-0000-0000-000000000000

# Supabase service role: server-only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini: server-only
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WEBHOOK_PUBLIC_URL=https://your-app.vercel.app/api/webhooks/twilio/whatsapp
TWILIO_WHATSAPP_ALLOWLIST=

# Local-only testing. Never enable in production.
# TWILIO_SKIP_SIGNATURE_VERIFY=true

# Instagram / Meta
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_GRAPH_VERSION=v22.0
INSTAGRAM_REDIRECT_URI=https://your-app.vercel.app/api/auth/instagram/callback
```

## Vercel Environment Variables

Add the same variables in Vercel under:

`Project -> Settings -> Environment Variables`

Set them for **Production**. Also set Preview and Development if you use Vercel preview deployments for testing.

Critical server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `META_APP_SECRET`

Public browser-safe variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_ORGANISATION_ID`

After changing Vercel env vars, redeploy. Running code will not see new env values until a new deployment starts.

## Deployment Checklist

1. Create Supabase project.
2. Run `02-supabase-schema.sql` in the Supabase SQL editor.
3. Create the first organisation row and copy its UUID to `NEXT_PUBLIC_DEFAULT_ORGANISATION_ID`.
4. Configure Supabase Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-app.vercel.app/auth/callback`
5. Add env vars locally.
6. Run the app locally with `npm run dev`.
7. Deploy to Vercel.
8. Add env vars in Vercel.
9. Disable Vercel Deployment Protection for the webhook, or Twilio will receive an auth wall instead of your route.
10. Configure Twilio WhatsApp webhook:
    - Method: `POST`
    - URL: `https://your-app.vercel.app/api/webhooks/twilio/whatsapp`
11. Set `TWILIO_WEBHOOK_PUBLIC_URL` to that exact URL.
12. Redeploy.
13. Send a WhatsApp test with one photo and brief text.
14. Check the portal for a new pending submission.

## Vercel Gotchas Learned From This Project

- If Twilio returns 403 from your webhook, first check signature validation and exact URL matching.
- `TWILIO_WEBHOOK_PUBLIC_URL` should not have a trailing slash unless Twilio is configured with one.
- If Vercel Deployment Protection is enabled, Twilio cannot reach the webhook.
- Server-side route handlers can use the service role key, but never expose it in client components.
- If production behaves differently from local, confirm Vercel has all env vars and that the deployment happened after adding them.

