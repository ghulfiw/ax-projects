# AX Project Tracker

A small web app for tracking Cheil Indonesia's AX projects. It has four views:

- **Portfolio:** where each project stands, what is blocked, and what needs a decision from the CEO.
- **Tasks:** a board for the team.
- **Weekly update:** a digest ready to copy into email or WhatsApp.
- **Members:** who can sign in, and with which role. Only owners see it.

The CEO can comment on any project or reply to a decision item.

The app is plain HTML and JavaScript with no build step. Supabase holds the data and handles sign-in by email link. Vercel hosts the files.

| File | What it is |
|---|---|
| `index.html` | Page layout and styles |
| `app.js` | App logic |
| `config.js` | Your Supabase URL and public key (you fill this in) |
| `supabase/schema.sql` | Tables, roles and access rules. Run once. |
| `supabase/seed.sql` | Optional starting data: 7 projects, 13 tasks |

## Roles

| Role | Can do |
|---|---|
| Owner | Everything, including adding and removing members |
| Editor | Edit projects, tasks and updates; comment |
| Viewer | Read everything; comment (for the CEO) |

Anyone who is not on the members list sees nothing, even after signing in. The database enforces this, not just the page.

## Setup (about 20 minutes)

### 1. Supabase

1. Create a project at supabase.com. Region: Southeast Asia (Singapore).
2. Open `supabase/schema.sql`. In the last line, replace `replace-with-your-email@example.com` with the email you will sign in with.
3. In Supabase, go to **SQL Editor → New query**, paste the whole file and click **Run**.
4. Optional: run `supabase/seed.sql` the same way to load the starting projects and tasks.
5. Go to **Project Settings → API**. Copy the **Project URL** and the **anon** key (newer projects call it the **publishable** key). Put both in `config.js`.
   - Never use the `service_role` or secret key. The anon key is meant to be public, and the access rules protect the data.

### 2. GitHub

1. Create a private repo, for example `ax-tracker`.
2. Upload every file in this folder and keep the `supabase/` folder. You can do this in the browser with **Add file → Upload files**.

### 3. Vercel

1. Go to **Add New → Project**, import the `ax-tracker` repo, set **Framework Preset** to **Other**, and deploy. No build settings are needed.
2. Copy the site address, for example `https://ax-tracker.vercel.app`.

### 4. Connect sign-in to the site

1. In Supabase, go to **Authentication → URL Configuration**.
   - Set **Site URL** to your Vercel address.
   - Under **Redirect URLs**, add the address followed by `/**`, for example `https://ax-tracker.vercel.app/**`.
2. Open the site, enter your email, and click the link that arrives. You're in as owner.
3. In **Members**, add your CEO as a **Viewer** and your team as **Editors**. They sign in with the same email-link flow.

## Before inviting other people

- **Email sending:** Supabase's built-in email is rate-limited and meant for testing. Before you invite the team, add your own SMTP under **Authentication → Emails → SMTP Settings**. A free Resend account or the company mail server both work. Otherwise sign-in links may stop arriving.
- **Free tier:** Supabase may pause a free project after about a week with no activity. Opening the dashboard restores it. Regular weekly use keeps it awake.
- **Who can request a link:** anyone can ask for a sign-in link, but non-members only see "No access yet". To block sign-ups entirely, turn off **Allow new users to sign up** under **Authentication → Sign In / Providers**, then invite people from **Authentication → Users → Invite user**, as well as adding them in Members.

## Changing things later

- Edit the files on GitHub. Vercel redeploys on every commit.
- Phases (Idea → Live) and statuses are defined at the top of `app.js` and as checks in `schema.sql`. Change both together.
