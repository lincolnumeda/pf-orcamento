import { supabase } from './supabase';

// Módulo que dá acesso a este app, cadastrado em public.modulos pelo
// pf-corporativo (slug 'orcamento').
const MODULO_SLUG = 'orcamento';

export interface UsuarioAutorizado {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
}

export async function entrarComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/central` },
  });
  if (error) throw error;
}

export async function sair() {
  await supabase.auth.signOut();
}

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  admin: boolean;
  permissoes: { modulo: { slug: string } | null }[] | null;
}

// Mesma lógica de autorização do pf-corporativo (lib/auth.ts de lá,
// callbacks.signIn/session do NextAuth) — usuário precisa existir, estar
// ativo, e ter permissão pro módulo 'orcamento'. Reescrita client-side aqui
// porque este app é uma SPA estática, sem servidor pra rodar NextAuth.
export async function buscarUsuarioAutorizado(email: string): Promise<UsuarioAutorizado | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, ativo, admin, permissoes ( modulo:modulos ( slug ) )')
    .eq('email', email)
    .single<UsuarioRow>();

  if (error || !data || !data.ativo) return null;

  const temAcesso = (data.permissoes ?? []).some((p) => p.modulo?.slug === MODULO_SLUG);
  if (!temAcesso) return null;

  return { id: data.id, nome: data.nome, email: data.email, admin: data.admin };
}
