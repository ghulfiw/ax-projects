# AX Project Tracker

A small web app for tracking Cheil Indonesia's AX projects. It's live at https://cheil-id-ax.vercel.app and has four views:

- **Portfolio:** where each project stands, with its related department, what's blocked, and what changed recently. You can filter it by department.
- **Tasks:** a board for the team.
- **Weekly update:** a digest ready to copy into email or WhatsApp.
- **Members:** who can sign in, and with which role. Only owners see it.

Everyone who signs in can comment on any project or task.

The app is plain HTML and JavaScript with no build step. Supabase holds the data and handles sign-in, by email and password or by an emailed link. Vercel hosts the files and redeploys on every commit to `main`.

| File | What it is |
|---|---|
| `index.html` | Page layout and styles |
| `app.js` | App logic |
| `config.js` | Supabase URL and public key |
| `supabase/schema.sql` | Tables, roles and access rules. Run once on a new database. |
| `supabase/migration-002.sql` | Adds departments and task comments, removes the CEO-decision field, and loads the starting projects, tasks and updates. Run once, after schema.sql. |

## Roles

| Role | Can do |
|---|---|
| Owner | Everything, including adding and removing members |
| Editor | Edit projects, tasks and updates; comment |
| Viewer | Read everything; comment (for the CEO) |

Anyone who is not on the members list sees nothing, even after signing in. The database enforces this, not just the page.

## Giving someone access (for example, the CEO with a password)

1. **In the app:** open **Members** and add their email with a role. For the CEO, choose **Viewer**.
2. **In Supabase:** go to **Authentication → Users → Add user → Create new user**. Enter the same email and a password, tick **Auto Confirm User**, and click **Create user**.
3. **Send them the details:** the address `https://cheil-id-ax.vercel.app`, their email, and the password, through a separate channel from the link.

They can change the password themselves in the app with **Set password**. Anyone without a password can use **Email me a sign-in link** instead.

## Setting up from scratch

1. **Supabase:** create a project. Put your email in the last line of `schema.sql`, run it in **SQL Editor**, then run `migration-002.sql`. Copy the Project URL and the publishable/anon key into `config.js`. Never use the secret or service_role key.
2. **Sign-in URLs:** go to **Authentication → URL Configuration**.
   - Set **Site URL** to the app's address.
   - Under **Redirect URLs**, add the address followed by `/**`.
3. **Vercel:** import the GitHub repo with **Framework Preset** set to **Other**. No build settings are needed.

## Before inviting more people

- **Email links:** Supabase's built-in email is rate-limited. If people will rely on sign-in links, set your own SMTP under **Authentication → Emails → SMTP Settings**. Password sign-in doesn't send email, so it isn't affected.
- **Free tier:** Supabase may pause a free project after about a week with no activity. Opening the dashboard restores it.
