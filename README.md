# Porto Frankfurt

Sistema de gestão condominial — aplicação web responsiva para administração, portaria e moradores.

## Stack
React + TypeScript + Vite · Supabase Auth/PostgreSQL/Storage/Realtime · Vercel.

## Estrutura
- `src/` — aplicação React
- `src/lib/` — integração Supabase
- `src/styles.css` — identidade visual e responsividade
- `supabase/migrations/` — histórico versionado do banco

## Desenvolvimento
```bash
npm install
cp .env.example .env
npm run dev
```

## Build
```bash
npm run build
```

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente. Use apenas chave publicável no navegador; nunca exponha service_role.
