import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Topbar } from './Topbar';

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === 'carregando') return <main>Carregando...</main>;
  if (auth.status !== 'autorizado') return <Navigate to="/login" replace />;

  return (
    <>
      <Topbar usuario={auth.usuario} />
      {children}
    </>
  );
}
