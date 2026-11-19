# Porto Frankfurt Desktop

## Objetivo
Aplicativo Windows independente da versão hospedada. O modo desktop usa SQLite no próprio computador e não exige conexão com internet para as operações locais.

## Arquitetura
- Interface: React + Vite (compartilhada com a aplicação web).
- Container desktop: Tauri 2.
- Banco local: SQLite por meio de `tauri-plugin-sql`.
- Banco online: Supabase, mantido como ambiente de produção.
- Separação explícita entre os modos local e online; o banco local nunca deve apontar para o projeto Supabase de produção.

## Banco local inicial
O esquema inicial cria tabelas para condomínios, blocos, apartamentos, moradores, veículos, vagas, áreas comuns, reservas, encomendas, comunicados, ocorrências e movimentações financeiras.

O banco é criado em `porto-frankfurt.db` na área de dados do aplicativo. O modo desktop deve continuar utilizável sem rede.

## Comandos
- `npm run desktop:dev`: abrir o aplicativo desktop em desenvolvimento.
- `npm run desktop:build`: gerar os instaladores Windows (NSIS e MSI).

## Próximas etapas
1. Integrar as telas administrativas ao repositório SQLite local.
2. Implementar CRUD completo de moradores, veículos, encomendas, reservas, comunicados e financeiro.
3. Implementar backup/restauração do SQLite e dados demonstrativos.
4. Criar uma camada de sincronização opcional e explícita entre SQLite e Supabase, com resolução de conflitos e sem sobrescrever dados de produção automaticamente.
5. Validar o instalador em Windows 10/11.
