# Pupford Illustration Style Vote

Round 1 of the team vote on illustration style. One link, mostly opened from Slack on a phone. Each person enters their name, walks through 11 designs, and picks the take that feels closest to Pupford. They can skip a design, leave a short comment, come back on the same device, and change a pick. Changing a pick updates their existing answer.

Voters never see the tally. The brand owner reads `/results`.

## Local

Node 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Set `ADMIN_KEY` in `.env.local` to any private string. Leave the Upstash variables blank.

```bash
npm run dev
```

Open http://localhost:3000.

Votes are written to `data/votes.json`. That file is gitignored, needs no account, and survives a dev-server restart. Nothing is seeded. A fresh checkout starts with zero votes.

| Page | URL |
| --- | --- |
| Voting | http://localhost:3000 |
| Results | http://localhost:3000/results?key=YOUR_ADMIN_KEY |
| JSON | http://localhost:3000/api/results?key=YOUR_ADMIN_KEY |
| CSV | http://localhost:3000/api/results?key=YOUR_ADMIN_KEY&format=csv |

`npm test` checks the tally, the file store, and that the illustration files are the original 1024×1024 JPEGs.

## Deploy on Vercel

The live site stores votes in [Upstash Redis](https://vercel.com/marketplace/upstash), added from the Vercel Marketplace. Vercel injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The app also accepts the older Vercel KV names (`KV_REST_API_URL` and `KV_REST_API_TOKEN`) if that is the integration you already use.

Do these steps in order.

1. Open [vercel.com/new](https://vercel.com/new) and import the GitHub repo `pupford/style-vote`. If the Pupford org is not listed, grant Vercel access to it.
2. Framework preset: **Next.js**. Root directory: repository root. Build command: `next build`. Leave the output directory on the default. Do not set a static export.
3. Add an environment variable for Production: `ADMIN_KEY`, a long random string (for example the output of `openssl rand -base64 32`). This is the password for the results page. Do not commit it.
4. Deploy.
5. In the Vercel project, open **Storage** (or **Integrations** → **Browse Marketplace**). Choose **Upstash Redis** (listed as Upstash for Redis). Create a database, pick the region closest to the team, and connect it to **this project** and the **Production** environment. Leave Preview disconnected, or give Preview its own database. A shared database would mix preview test votes into the real tally.
6. Confirm the project’s environment variables now include `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The integration adds them. You do not paste the token yourself.
7. Redeploy Production so both `ADMIN_KEY` and the Redis variables are present at runtime. Deployments → the latest Production deployment → Redeploy.
8. Open `https://YOUR-DOMAIN/results?key=YOUR_ADMIN_KEY` and confirm it says **0 voters** before you share the link.
9. Share only `https://YOUR-DOMAIN/` in Slack. Do not share the results link. The key in that URL is a password.

Replace `YOUR-DOMAIN` with the Vercel domain (or the custom domain you attach) and `YOUR_ADMIN_KEY` with the value you set.

| What | URL |
| --- | --- |
| Voting link for the team | `https://YOUR-DOMAIN/` |
| Results | `https://YOUR-DOMAIN/results?key=YOUR_ADMIN_KEY` |
| JSON for a script | `https://YOUR-DOMAIN/api/results?key=YOUR_ADMIN_KEY` |
| CSV download | `https://YOUR-DOMAIN/api/results?key=YOUR_ADMIN_KEY&format=csv` |

The JSON body has `votes` (every ballot: name, team, timestamps, picks, comments) and `aggregates` (voter count, finished count, per-design counts with names, comments, and a ranking of all 33 takes). The CSV is one row per voter. Choice cells are the take id (`00A`), `none`, or blank when they skipped. `finished_at` is blank until they press Finish.

On Vercel, if Redis is not connected, saving a vote returns an error instead of writing to the serverless disk. Votes would not survive the next request.

## What you do yourself

Nobody else can do these. The repo does not contain a Vercel token or an Upstash database.

1. Import this repo into Vercel (step 1 above).
2. Choose `ADMIN_KEY` and add it to Production.
3. Add Upstash Redis from the Vercel Marketplace and connect it to Production only.
4. Redeploy.
5. Open the results URL and confirm the tally is empty.
6. Post the voting URL in Slack. Keep the results URL.

To wipe a round after an accidental production test vote, delete the Redis key `pupford:style-vote:round-1:voters` in the Upstash console, then refresh `/results`. Do that before the team votes. Deleting the key deletes the round.

## Round 2

Designs live in `config/designs.json`. Images live in `public/illustrations/` and are named by take id (`00A.jpg`). They are served as the original files in the full-size view. The voting grid asks Next.js for a sized image so phones are not downloading more pixels than they show.

For a new round:

1. Change `id` (for example `round-2`). Votes are stored under that id, so Round 1 stays intact.
2. Update `title`, `intro`, and the `designs` list. Keep the order you want voters to see. Each design needs an `id`, a `title`, and a `takes` array.
3. Add one square JPEG per take under `public/illustrations/`, named exactly as the take id plus `.jpg`.
4. Deploy again.

## Storage

| Where | Store |
| --- | --- |
| Your laptop, Redis env vars unset | `data/votes.json` |
| Vercel with Upstash connected | Redis hash `pupford:style-vote:round-1:voters` |
| Vercel without Upstash | Refuses to save. No silent fallback. |

A ballot is one record per device id. Picks are a map keyed by design id, so changing a take replaces the old choice and cannot insert a second row for the same person. The id lives in `localStorage` on that device. "Not you?" starts a new ballot and leaves the previous person's votes in place.
