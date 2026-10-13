# NextVault Server

## Run
```bash
cd server
docker compose up -d          # Postgres (or point DATABASE_URL at your own)
cp .env.example .env
npm install
npm run dev                   # migrates automatically, listens on 127.0.0.1:4000
```

## Try it
```bash
curl -F "file=@sample.md" http://127.0.0.1:4000/sources
curl http://127.0.0.1:4000/sources/<id>      # status + extracted text
```

## Test
Needs a database named `nextvault_test` (or set `TEST_DATABASE_URL`). `npm test`

## Layout
`routes/` HTTP only → `ingestion/` business logic + SQL (`repository.ts`) → `storage/` bytes → `db/` pool + migrations. Auth lives behind one function in `auth/currentUser.ts`.
