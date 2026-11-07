# EpiCenter Notes

Un seul repo : Express + Prisma (PostgreSQL) + React (Vite). Auth email/mot de passe (JWT en cookie httpOnly).

## Lancer en local
```
npm install
cp .env.example .env      # renseigner DATABASE_URL et JWT_SECRET
npx prisma migrate dev --name init
npm run dev               # front http://localhost:5173, api :3000
```

## Production (Render)
- Build : `npm install && npm run build`
- Start : `npm start` (NODE_ENV=production, sert l'API et le front sur le même port)
- Variables : DATABASE_URL, JWT_SECRET
