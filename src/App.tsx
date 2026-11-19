import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrcamentoPage from './routes/publico/OrcamentoPage';
import AprovarPage from './routes/publico/AprovarPage';
import LoginPage from './routes/login/LoginPage';
import RegrasPage from './routes/admin/RegrasPage';
import KanbanPage from './routes/central/KanbanPage';
import IndicacoesPage from './routes/central/IndicacoesPage';
import FunilPage from './routes/central/FunilPage';
import IndiquePage from './routes/publico/indique/IndiquePage';
import RegulamentoIndiquePage from './routes/publico/indique/RegulamentoIndiquePage';
import { RequireAuth } from './components/auth/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrcamentoPage />} />
        <Route path="/aprovar/:id" element={<AprovarPage />} />
        <Route path="/indique" element={<IndiquePage />} />
        <Route path="/indique/regulamento" element={<RegulamentoIndiquePage />} />
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
        <Route
          path="/central/indicacoes"
          element={
            <RequireAuth>
              <IndicacoesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/central/funil"
          element={
            <RequireAuth>
              <FunilPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
