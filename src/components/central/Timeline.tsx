import type { Interacao, TipoInteracao } from '../../types';

const ROTULO_TIPO: Record<TipoInteracao, string> = {
  nota: 'Nota',
  whatsapp_enviado: 'WhatsApp',
  status_alterado: 'Status',
  email_enviado: 'Email',
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function Timeline({ interacoes, carregando }: { interacoes: Interacao[]; carregando: boolean }) {
  if (carregando) return <p className="timeline__carregando">Carregando histórico...</p>;
  if (interacoes.length === 0) return <p className="timeline__vazio">Nenhuma interação registrada ainda.</p>;

  return (
    <ul className="timeline">
      {interacoes.map((i) => (
        <li key={i.id} className={`timeline__item timeline__item--${i.tipo}`}>
          <div className="timeline__cabecalho">
            <span className="timeline__tipo">{ROTULO_TIPO[i.tipo]}</span>
            <span className="timeline__data">{formatarData(i.criado_em)}</span>
          </div>
          <p className="timeline__conteudo">{i.conteudo}</p>
          {i.autor && <span className="timeline__autor">{i.autor}</span>}
        </li>
      ))}
    </ul>
  );
}
