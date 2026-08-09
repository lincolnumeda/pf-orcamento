import type { UsuarioAutorizado } from '../../lib/auth';
import { sair } from '../../lib/auth';

export function Topbar({ usuario }: { usuario: UsuarioAutorizado }) {
  return (
    <div className="topbar">
      <span className="topbar__usuario">{usuario.nome || usuario.email}</span>
      <button className="topbar__sair" onClick={() => sair()}>
        Sair
      </button>
    </div>
  );
}
