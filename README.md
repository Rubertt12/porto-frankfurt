# Porto Frankfurt

Sistema de gestão condominial — aplicação web responsiva para administração, portaria e moradores.

## Estrutura

- `src/` — aplicação React + TypeScript + Vite
- `src/styles/` — estilos globais e identidade visual
- `src/components/` — componentes reutilizáveis
- `src/features/` — módulos do condomínio
- `supabase/migrations/` — estrutura do banco e políticas RLS
- `public/` — ativos estáticos

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

As credenciais do Supabase devem ser configuradas nas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nunca publique chaves administrativas no frontend.
