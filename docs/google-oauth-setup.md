# Google OAuth

1. Create a Google Cloud project and configure the OAuth consent screen for your organization. Add test users if the consent screen remains in testing.
2. Create a Web application OAuth client. Use the Supabase callback URL shown under Authentication > Providers > Google as the authorized redirect URI, typically `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Enable Google in Supabase Auth and enter the Google client ID and secret there, never in Vite configuration.
4. Set Supabase Site URL to the frontend origin. Allow `http://localhost:5173/auth/callback` locally and your exact HTTPS production `/auth/callback` URL. Avoid wildcard redirects in production.
5. The frontend uses `signInWithOAuth` with Google and a callback derived from the current origin. Supabase's PKCE session handler exchanges the code and cleans up the URL. Arbitrary `next` or return URLs are not accepted.
6. A database trigger creates the profile as pending/developer. A Super Admin explicitly approves it and assigns membership. Google user metadata never determines role.
7. Optionally configure email domains under Settings. Enforcement runs at profile creation on the server. It does not retroactively approve or deactivate existing accounts.

Test denied consent, expired/missing verifier, a rejected account, a pending account, sign out, and an approved login. OAuth errors render a retry path. The pending screen checks approval through profile updates and a 30-second refresh.

References: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google) and [PKCE sessions](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Production URL configuration

For the deployed SyncOra site, open Supabase **Authentication → URL Configuration**:

- **Site URL:** `https://syncora-bliss.netlify.app`
- **Redirect URLs:** add `https://syncora-bliss.netlify.app/auth/callback`.
- Retain `http://localhost:5173/auth/callback` for local development.

Save both settings, then start a fresh Google sign-in from the production login page. Do not reuse a previous callback code. If Supabase rejects the requested redirect URL, authentication falls back to the Site URL; leaving that at `http://localhost:3000` causes production sign-in to return to localhost. See [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Google Cloud's authorized redirect URI remains the Supabase `/auth/v1/callback` URL from step 2, rather than the Netlify frontend callback. Hosted Supabase settings are separate from the repository's local `supabase/config.toml`.
