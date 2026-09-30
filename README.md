# Redwan's Method 2027 Discussion Hub

A notes-only website: anyone can upload image or PDF notes, an admin verifies
them, and verified notes appear in a public gallery with inline preview and
download. **Telegram is the cloud storage** — every note is stored as a
document in a private Telegram channel via the Telegram Bot API (free,
unlimited count, up to 20 MB per file).

## How the storage works

```
Browser ── file ≤ 4 MB ──────────────▶ /api/upload ── sendDocument ──▶ Telegram channel
Browser ── file > 4 MB ── direct to Vercel Blob (transient staging)
                                        └─▶ /api/upload/token callback moves the
                                            file to Telegram, then deletes the blob
```

- Vercel caps request bodies at 4.5 MB, so larger files are staged on Vercel
  Blob only for the few seconds it takes to transfer them into Telegram.
  Telegram is the sole permanent storage.
- Note metadata (title, Telegram `file_id`, status, timestamps) is indexed in
  Upstash Redis (free tier) — Vercel's serverless filesystem is ephemeral.
- Viewing/downloading streams the file out of Telegram via `getFile`.
- Uploads are capped at 20 MB because that is Telegram's Bot API download limit.

## One-time setup

### 1. Telegram

1. Create a **private channel**, e.g. "RM2027 Notes Storage".
2. Add your bot as an **administrator** of that channel (needs only
   "Post messages" permission).
3. Get the channel's chat ID:
   - If the channel has a public link, you can use `@yourchannelname`.
   - Otherwise, post any message in the channel, then open
     `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and
     find `chat.id` (a `-100…` number).

### 2. Metadata index (Upstash Redis)

Create a free database at [upstash.com](https://upstash.com) → Redis → copy
the **REST URL** and **REST token**.

### 3. Environment variables

Set these in Vercel (Project → Settings → Environment Variables), or in `.env.local`
for local development (copy `.env.example`):

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHANNEL_ID` | Private storage channel chat ID |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `BLOB_READ_WRITE_TOKEN` | Set by Vercel when you connect a Blob store (only needed for files > 4 MB) |

### 4. Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. In Vercel → Storage → create/connect a **Blob** store so that
   `BLOB_READ_WRITE_TOKEN` is injected (needed only for > 4 MB uploads).
3. Add the environment variables from step 3 and deploy.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

Note: uploads larger than 4 MB require the Vercel Blob callback to reach your
machine, which does not work on `localhost` — test large uploads on the
deployed site (or use a tunnel such as ngrok). Small uploads work fully locally.

## Routes

- `/` — upload a note + public gallery of verified notes
- `/admin` — admin sign-in, verification queue, published notes management
- `POST /api/upload` — direct upload path (≤ 4 MB)
- `POST /api/upload/token` — client-upload handler for large files
- `GET /api/notes?status=approved|pending` — list notes (pending requires admin)
- `PUT /api/notes/[id]` — approve a note (admin)
- `DELETE /api/notes/[id]` — reject/delete a note (admin)
- `GET /api/file/[id]` — stream a note's file (append `?download=1` to download)
