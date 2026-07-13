# Deploying this portfolio

This is a fully static site (HTML/CSS/JS, no build step). Any static host works.
Everything below is self-contained — no server, database, or environment variables.

## Option A — Netlify drag-and-drop (fastest, no Git needed)

1. Go to https://app.netlify.com/drop
2. Drag the entire `Portfolio` folder onto the page.
3. Netlify gives you a live URL immediately (e.g. `random-name-123.netlify.app`).
4. (Optional) In **Site settings → Change site name**, rename to something like
   `david-facio-robotics.netlify.app`.
5. Copy the final URL — it goes into the CV and LinkedIn (see "After publishing" below).

To update later: drag the folder onto the same site's **Deploys** tab.

## Option B — GitHub Pages (best if you want it version-controlled)

> Note: pushing to GitHub is your call — these are the steps when you're ready.

1. Create a new repo, e.g. `portfolio` or `david-facio.github.io`.
2. Put the **contents** of this `Portfolio` folder at the repo root
   (so `index.html` is at the top level). The included `.nojekyll` file tells
   Pages to serve the files as-is.
3. Push, then in **Settings → Pages**, set Source = `main` branch, `/ (root)`.
4. Your URL will be `https://<username>.github.io/<repo>/`
   (or `https://<username>.github.io/` if the repo is named `<username>.github.io`).

## Option C — Vercel

1. `vercel` CLI or import the repo at https://vercel.com/new.
2. Framework preset: **Other** (no build command, output dir = project root).

## After publishing — wire the URL everywhere

Once you have the live URL, it needs to replace the placeholder in these spots:

- `CV/02-working-drafts/david-facio-lead-robotics-cv-v3.md` — `[add hosted portfolio URL]`
- `CV/03-final-exports/` — regenerate the PDF/DOCX so the exported copies carry the URL
- LinkedIn — Contact info → Website, and the "Featured" section
- Portfolio `index.html` — add `<meta property="og:url">` and an `og:image` if you want
  rich link previews when sharing on LinkedIn (optional polish)
