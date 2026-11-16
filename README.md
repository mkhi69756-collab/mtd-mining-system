# MTD Mining System

A small static website using Supabase Auth + Postgres. Each successful mining action awards **10 virtual points**. The database enforces a 12-hour cooldown using server time and a row lock.

## 1. Create Supabase project

1. Open https://supabase.com and sign in.
2. Create a new project and keep its database password private.
3. Open **SQL Editor** -> **New query**.
4. Copy all text from `supabase.sql`, paste it, and click **Run**.
5. Open **Project Settings -> API** (or API Keys).
6. Copy the Project URL and the publishable key (or legacy anon/public key). Never use a `service_role` or secret key in website code.

## 2. Configure the website

1. Open `index.html` in an editor.
2. Find `PASTE_YOUR_SUPABASE_PROJECT_URL` and replace it with your Project URL.
3. Find `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` and replace it with the publishable/anon public key.
4. Save the file.

The publishable/anon key is intended for browser use when Row Level Security is configured. Do not paste a secret/service_role key into `index.html`.

## 3. Set Supabase email URLs

Before production:
1. In Supabase, open **Authentication -> URL Configuration**.
2. Set **Site URL** to your eventual GitHub Pages URL, for example `https://YOUR-USERNAME.github.io/mtd-mining-system/`.
3. Add that same URL to **Redirect URLs**.
4. Email/password sign-up is enabled by default on many projects. If email confirmation is enabled, users must click the confirmation link before logging in. Configure SMTP if you need reliable production email delivery.

## 4. Publish free with GitHub Pages

1. Sign in at https://github.com.
2. Create a **public** repository named `mtd-mining-system`.
3. Upload the files and folders from this project. Make sure `index.html`, `supabase.sql`, and `.github/workflows/deploy.yml` are at the repository root / correct folder locations.
4. Open repository **Settings -> Pages**.
5. Under **Build and deployment -> Source**, choose **GitHub Actions**.
6. Open the **Actions** tab and wait for the workflow named **Deploy static site to GitHub Pages** to finish successfully.
7. Your site URL will be `https://YOUR-USERNAME.github.io/mtd-mining-system/`.
8. Put that exact URL in Supabase **Authentication -> URL Configuration** as Site URL and Redirect URL.

## 5. Test

1. Open the live URL in a private/incognito browser tab.
2. Register with an email you can access and a password of at least 8 characters.
3. If asked, verify the email.
4. Log in. The dashboard should show 0 points.
5. Press **Start Mining**. Points should become 10 and a 12-hour timer should start.
6. Log out and log in again; points and timer should remain.
7. Pressing Start Mining again before 12 hours should be rejected by the database.

## Important

- These are virtual points only. This code does not mine a cryptocurrency, create a token, or provide withdrawals or cash value.
- Do not add a Supabase service-role/secret key to frontend code.
- The database function is the authority for rewards and cooldown; the browser timer is only a display.
- For a public launch, add abuse protection/CAPTCHA, custom SMTP, privacy/terms pages, backups, and monitoring.
