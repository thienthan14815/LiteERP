# Google Drive integration setup

This project uses Google Drive as object storage for binary files (images,
receipts, invoices, PDFs, Excel, backups). Metadata lives in Postgres. See
`ARCHITECTURE_forSQL.md` for the layering rules.

## 1. Create a Google Cloud project and enable Drive API

1. Go to https://console.cloud.google.com/.
2. Create a new project (or reuse an existing one).
3. Navigate to **APIs & Services -> Library**.
4. Search for **Google Drive API** and click **Enable**.

## 2. Create an OAuth 2.0 Desktop credential

1. Go to **APIs & Services -> OAuth consent screen**.
   - User type: **External** (any Google account can consent) — or **Internal**
     if your organisation uses Google Workspace.
   - Publishing status: leave in **Testing**. Add your own Google account as a
     **Test user** so the consent screen accepts you.
   - Scopes: add `.../auth/drive.file`. That scope lets the app manage only the
     files it creates — it will not touch the user's other Drive content.
2. Go to **APIs & Services -> Credentials -> Create Credentials -> OAuth client
   ID**.
   - Application type: **Desktop app**.
   - Name: whatever, e.g. `LiteERP dev`.
3. Download the JSON. Note the `client_id` and `client_secret`.

## 3. Create the Drive root folder

1. Open https://drive.google.com/ signed in as the account that will own the
   files.
2. Create a folder called e.g. `app-storage`.
3. Open it — the URL contains the folder id after `/folders/`. Copy that id.
   That is `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

The API will create the following subfolders lazily on first use (see
`apps/api/src/modules/drive/drive-folder.enum.ts`):

```
app-storage/
  backup/
  uploads/
    orders/
    products/
    suppliers/
    customers/
    invoices/
    receipts/
```

## 4. Get a refresh token (one-time script)

1. Put the client id and client secret you have so far into the root `.env`:

   ```env
   GOOGLE_DRIVE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_DRIVE_CLIENT_SECRET=xxxxxxxx
   GOOGLE_DRIVE_ROOT_FOLDER_ID=xxxxxxxxxxxxxxxxxxxx
   ```

2. Run the helper script from `apps/api`:

   ```bash
   cd apps/api
   pnpm exec ts-node scripts/drive-oauth-init.ts
   ```

3. Open the printed URL in a browser that is signed in as the Drive owner.
   Click **Allow**. Google will redirect to
   `http://localhost:53682/?code=4/0A...&scope=...`. That connection will fail
   (no local server) — that is expected. Copy the value of the `code=` query
   parameter (up to but not including the `&`).
4. Paste the code back into the terminal. The script exchanges it for a
   refresh token and prints one line ready to paste into `.env`:

   ```env
   GOOGLE_DRIVE_REFRESH_TOKEN=1//0e...
   ```

5. If Google does not return a `refresh_token`, revoke the app at
   https://myaccount.google.com/permissions and re-run the script — the
   `prompt=consent` flag forces Google to hand out a new one.

## 5. Restart the API

```bash
pnpm dev:api
```

If the four env vars are set the API logs `DriveService initialised`. If any
is missing you will see `DriveService running in DEGRADED mode` — no crash,
but calls to `/attachments/upload-drive` will return HTTP 503 with code
`DRIVE_NOT_CONFIGURED`.

## 6. Test upload via curl

Get an access token by logging in through `/auth/login`, then:

```bash
curl -X POST http://localhost:3000/attachments/upload-drive \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "entityType=MACHINE" \
  -F "entityId=cknabc123" \
  -F "folder=PRODUCTS" \
  -F "file=@/absolute/path/to/photo.jpg"
```

The response contains `thumbnailUrl` and `previewUrl` — never `driveFileId`.

## Notes

- The refresh token belongs to the Google account that granted consent. Rotate
  it by revoking the app at https://myaccount.google.com/permissions and
  re-running `scripts/drive-oauth-init.ts`.
- Backup uses `pg_dump`. The API host (or its container) must have the
  PostgreSQL client tools installed. Backup route is `POST /backup/run`,
  requires ADMIN role.
