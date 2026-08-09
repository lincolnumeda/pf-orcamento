import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrcamentoPage from './routes/publico/OrcamentoPage';
import AprovarPage from './routes/publico/AprovarPage';
import LoginPage from './routes/login/LoginPage';
import RegrasPage from './routes/admin/RegrasPage';
import KanbanPage from './routes/central/KanbanPage';
import { RequireAuth } from './components/auth/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrcamentoPage />} />
        <Route path="/aprovar/:id" element={<AprovarPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin/regras"
          element={
            <RequireAuth>
              <RegrasPage />
            </RequireAuth>
          }
        />
        <Route
          path="/central"
          element={
            <RequireAuth>
              <KanbanPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
