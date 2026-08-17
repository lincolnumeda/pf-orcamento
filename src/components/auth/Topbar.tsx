import { NavLink } from 'react-router-dom';
import { sair } from '../../lib/auth';

const HUB_URL = 'https://corporativo.pequenosfluentes.com.br/dashboard';

export function Topbar() {
  return (
    <div className="topbar">
      <div className="topbar__inner">
        <div className="topbar__esquerda">
          <a className="topbar__voltar" href={HUB_URL}>
            <span aria-hidden="true">←</span> <span className="topbar__voltar-label">Voltar</span>
          </a>
          <h1 className="topbar__titulo">Central de Orçamentos</h1>
        </div>

        <nav className="topbar__abas">
          <NavLink to="/central" className={({ isActive }) => `tab ${isActive ? 'tab--ativa' : ''}`}>
            Central
          </NavLink>
          <NavLink to="/admin/regras" className={({ isActive }) => `tab ${isActive ? 'tab--ativa' : ''}`}>
            Regras
          </NavLink>
        </nav>

        <button className="topbar__sair" onClick={() => sair()}>
          Sair
        </button>
      </div>
    </div>
  );
}
