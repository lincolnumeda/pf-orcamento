import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { entrarComGoogle, sair } from '../../lib/auth';

export default function LoginPage() {
  const auth = useAuth();

  if (auth.status === 'autorizado') {
    return <Navigate to="/central" replace />;
  }

  return (
    <main className="login-page">
      <div className="login-page__card">
        <h1>Central de Orçamentos</h1>
        <p className="login-page__subtitulo">Pequenos Fluentes</p>

        {auth.status === 'nao_autorizado' && (
          <div className="login-page__negado">
            <p>
              A conta <strong>{auth.email}</strong> não tem acesso liberado a este módulo.
            </p>
            <button onClick={() => sair()}>Sair</button>
          </div>
        )}

        {(auth.status === 'deslogado' || auth.status === 'carregando') && (
          <button
            className="login-page__google"
            onClick={() => entrarComGoogle()}
            disabled={auth.status === 'carregando'}
          >
            Entrar com Google
          </button>
        )}
      </div>
    </main>
  );
}
