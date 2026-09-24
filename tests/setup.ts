import { existsSync } from "node:fs";

// Testes de integração usam o projeto Supabase de DESENVOLVIMENTO (.env.local).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
