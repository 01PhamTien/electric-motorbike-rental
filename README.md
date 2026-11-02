# Electric Motorbike Rental - Da Nang

## Chạy database
```bash
docker compose up -d
```

## Chạy backend
```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run start:dev
```

Swagger: http://localhost:3000/api/docs

## Chạy frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: http://localhost:5173

## Tài khoản seed
- Admin: `admin@evrental.local` / `Admin@123456`
- Staff: `staff@evrental.local` / `Staff@123456`
