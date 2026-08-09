import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas em .env.local');
}

// Sem schema padrão: este projeto lê/escreve tanto em `orcamento` (dados do
// próprio app) quanto em `public` (usuarios/modulos/permissoes, reaproveitados
// do pf-corporativo) — cada chamada escolhe o schema explicitamente.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const orcamentoDb = supabase.schema('orcamento');
