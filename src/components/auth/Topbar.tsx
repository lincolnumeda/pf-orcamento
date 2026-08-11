import { NavLink } from 'react-router-dom';
import type { UsuarioAutorizado } from '../../lib/auth';
import { sair } from '../../lib/auth';

export function Topbar({ usuario }: { usuario: UsuarioAutorizado }) {
  return (
    <div className="topbar">
      <div className="topbar__marca">
        <span className="topbar__ponto" />
        Pequenos Fluentes
      </div>

      <nav className="topbar__abas">
        <NavLink to="/central" className={({ isActive }) => `tab ${isActive ? 'tab--ativa' : ''}`}>
          Central
        </NavLink>
        <NavLink to="/admin/regras" className={({ isActive }) => `tab ${isActive ? 'tab--ativa' : ''}`}>
          Regras
        </NavLink>
      </nav>

      <div className="topbar__conta">
        <span className="topbar__usuario">{usuario.nome || usuario.email}</span>
        <button className="btn btn-ghost" onClick={() => sair()}>
          Sair
        </button>
      </div>
    </div>
  );
}
