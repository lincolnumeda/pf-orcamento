import type { UsuarioAutorizado } from '../../lib/auth';
import { sair } from '../../lib/auth';

export function Topbar({ usuario }: { usuario: UsuarioAutorizado }) {
  return (
    <div className="topbar">
      <div className="topbar__marca">
        <span className="topbar__ponto" />
        Pequenos Fluentes
      </div>
      <div className="topbar__conta">
        <span className="topbar__usuario">{usuario.nome || usuario.email}</span>
        <button className="btn btn-ghost" onClick={() => sair()}>
          Sair
        </button>
      </div>
    </div>
  );
}
