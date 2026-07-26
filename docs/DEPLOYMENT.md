# Deploy Flashcards Free-First

Muc tieu: chay that voi chi phi 0 USD trong giai do ca nhan/prototype.

Phuong an khuyen nghi:

- Frontend: Vercel Hobby, free.
- Backend: Render Web Service Free.
- Database: Supabase Postgres Free.
- File storage: Supabase Storage Free.

Khong dung Render Postgres cho phuong an free-first vi free database cua Render co gioi han 30 ngay. Khong dung Render persistent disk vi disk tinh phi theo GB/thang. Hugging Face Space cung co filesystem tam thoi, nen van can Supabase cho DB/storage neu muon du lieu ton tai sau restart.

## Kien truc

```text
Vercel FE
  -> Render Free FastAPI backend
      -> Supabase Postgres
      -> Supabase Storage
```

Alternative backend:

```text
Vercel FE
  -> Hugging Face Docker Space FastAPI backend
      -> Supabase Postgres
      -> Supabase Storage
```

## 1. Tao Supabase project

1. Vao Supabase Dashboard.
2. Tao project moi.
3. Luu database password.
4. Bam nut **Connect** trong Supabase project.
5. Chon **Session pooler** connection string, khong dung **Direct connection**.
6. Doi password placeholder trong URI thanh password that.

Gia tri se dung cho backend:

```text
DATABASE_URL=postgres://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres
```

Backend se tu doi `postgresql://` sang driver `postgresql+psycopg://`, nen ban khong can sua URI bang tay.

Quan trong: Render Free nen dung **Session pooler** cua Supabase vi no chay IPv4. Direct connection cua Supabase Free thuong la IPv6, va se gay loi dang:

```text
Network is unreachable
connection to server at "<ipv6-address>", port 5432 failed
```

Neu password co ky tu dac biet nhu `@`, `#`, `%`, `/`, `:` thi can URL encode password truoc khi dua vao `DATABASE_URL`.

## 2. Tao Supabase Storage bucket

1. Vao **Storage**.
2. Tao bucket ten:

```text
flashcards
```

3. De bucket o che do **Public** de frontend doc duoc image/audio.
4. Vao **Project Settings** -> **API** va copy:
   - Project URL
   - `service_role` key

Can than: `service_role` key chi dat o backend Render/Hugging Face. Khong bao gio dat key nay vao Vercel frontend.

Backend env can co:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=flashcards
SUPABASE_STORAGE_PREFIX=flashcards
```

## 3. Deploy backend tren Render Free

Repo da co `render.yaml` cau hinh Web Service Free, khong tao database va khong tao disk.

1. Day repo len GitHub.
2. Vao Render Dashboard.
3. Chon **New** -> **Blueprint**.
4. Chon repo nay.
5. Render se doc `render.yaml` va tao service `flashcards-api`.
6. Khi Render hoi env vars, nhap:

```text
DATABASE_URL=<Supabase Session pooler URI>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=flashcards
```

7. Deploy.
8. Test:

```text
https://<render-service>.onrender.com/health
```

Ket qua dung:

```json
{"status":"ok"}
```

Luu y Render Free:

- Service co the sleep khi khong co traffic, request dau tien sau khi sleep se cham.
- Bandwidth free co gioi han.
- Khong dung filesystem de luu du lieu quan trong. Code hien tai da day Anki media/PDF len Supabase Storage khi env Supabase duoc cau hinh.

## 4. Deploy frontend tren Vercel Free

1. Vao Vercel Dashboard.
2. Chon **Add New** -> **Project**.
3. Import cung repo.
4. Cau hinh:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Them Production Environment Variables:

```text
VITE_API_BASE_URL=https://<render-service>.onrender.com/api
VITE_ASSET_BASE_URL=https://<render-service>.onrender.com
```

6. Deploy.

Backend da cho phep cac domain `https://*.vercel.app` qua `CORS_ORIGIN_REGEX`.

Neu ban dung custom domain, vao Render service -> **Environment** va them domain vao:

```text
CORS_ORIGINS=https://your-domain.com,http://localhost:5173,http://127.0.0.1:5173
```

Sau do redeploy backend.

## 5. Alternative: backend tren Hugging Face Space Free

Repo da co `Dockerfile` o root de chay FastAPI tren port `7860`, phu hop Docker Space.

1. Tao Hugging Face Space moi.
2. Chon SDK: **Docker**.
3. Dung repo nay lam source hoac push code len Space repo.
4. Trong Space settings, them runtime secrets/variables:

```text
DATABASE_URL=<Supabase Session pooler URI>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=flashcards
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$
```

5. Khi Space build xong, backend URL thuong co dang:

```text
https://<username>-<space-name>.hf.space
```

6. Tren Vercel, dung:

```text
VITE_API_BASE_URL=https://<username>-<space-name>.hf.space/api
VITE_ASSET_BASE_URL=https://<username>-<space-name>.hf.space
```

Luu y Hugging Face Free:

- Filesystem cua Space la ephemeral, mat khi restart/stop.
- Code da dung Supabase Storage cho media/PDF neu env Supabase duoc cau hinh.
- Space co the sleep hoac rebuild cham, phu hop demo/prototype hon backend production nghiem tuc.

## 6. Local development

Backend local:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend local:

```powershell
cd frontend
npm install
npm run dev
```

Frontend local env, tao `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ASSET_BASE_URL=http://localhost:8000
```

Backend local neu muon test voi Supabase, tao `backend/.env`:

```text
DATABASE_URL=<Supabase Session pooler URI>
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=flashcards
SUPABASE_STORAGE_PREFIX=flashcards
```

Neu khong co env Supabase, backend local se dung SQLite va filesystem local nhu truoc.

## 7. Kiem tra sau deploy

1. Backend `/health` tra ve `{"status":"ok"}`.
2. Frontend load home khong loi CORS trong browser console.
3. Tao deck moi.
4. Tao card moi.
5. Import file `.apkg` nho, sau do kiem tra image/audio la URL Supabase hoac load duoc tren frontend.
6. Upload PDF nho, kiem tra document sang status `ready`.
7. Refresh truc tiep route `/stats` hoac `/review`; Vercel khong duoc tra 404.

## 8. Khi nao can tra phi

Free-first phu hop ca nhan/prototype. Nen nang cap khi:

- Backend bi sleep lam trai nghiem qua cham.
- Supabase free het quota DB/storage/bandwidth.
- Can uptime on dinh hon.
- Can auth va multi-user nghiem tuc.

Thu tu nang cap hop ly:

1. Nang Render backend len paid instance nho.
2. Nang Supabase len Pro khi DB/storage het quota.
3. Sau nay neu media lon, chuyen sang Cloudflare R2/S3.
# Learning OS migrations and reset

Render starts the API with `alembic upgrade head`; it never resets data. For a production reset, first export a Supabase snapshot and verify the exact project host. Then run `python -m scripts.reset_app_schema --project-ref <ref> --confirm "RESET FLASHIE APP DATA" --dry-run`, review the listed app tables, remove `--dry-run`, and run `alembic upgrade head`. The script rejects SQLite, localhost, a missing/mismatched project ref, and an incorrect phrase. It never addresses Supabase `auth`, `storage`, extensions, or storage objects.
