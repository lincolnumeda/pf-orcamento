import { useState } from 'react';
import type { Indicacao } from '../../types';
import { enviarWhatsappIndicacao } from '../../lib/indicacoes';
import { linkWhatsApp } from '../../lib/orcamentos';
import {
  ROTULO_MENSAGEM_INDICACAO,
  montarMensagemIndicacao,
  type TipoMensagemIndicacao,
} from '../../../supabase/functions/_shared/mensagensIndicacao.ts';

interface Props {
  indicacao: Indicacao;
  tipo: TipoMensagemIndicacao;
  autorNome: string;
  onFechar: () => void;
  onEnviado: () => void;
}

// Prévia editável antes de cada envio manual. O texto inicial vem do arquivo
// único de mensagens (supabase/functions/_shared/mensagensIndicacao.ts).
export function PreviaWhatsapp({ indicacao, tipo, autorNome, onFechar, onEnviado }: Props) {
  const [mensagem, setMensagem] = useState(() =>
    montarMensagemIndicacao(tipo, {
      indicadorNome: indicacao.indicador_nome,
      escolaNome: indicacao.escola_nome,
      comissao: indicacao.comissao,
      link: `${window.location.origin}/indique`,
    }),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const faltaVariavel = /\{\w+\}/.test(mensagem);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await enviarWhatsappIndicacao(indicacao.id, tipo, mensagem.trim(), autorNome);
      onEnviado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar WhatsApp');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop indicacao-previa" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>WhatsApp: {ROTULO_MENSAGEM_INDICACAO[tipo]}</h2>
        <p className="modal__sub">
          Para {indicacao.indicador_nome} · {indicacao.indicador_whatsapp}. Revise e edite antes de enviar.
        </p>
        <textarea rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
        {faltaVariavel && (
          <p className="indicacao-aviso">A mensagem ainda tem variável sem preencher (ex.: {'{comissao}'}).</p>
        )}
        {erro && <p className="resumo__erro">{erro}</p>}
        <div className="modal-actions indicacao-previa__acoes">
          <a
            className="btn btn-ghost"
            href={linkWhatsApp(indicacao.indicador_whatsapp, mensagem)}
            target="_blank"
            rel="noreferrer"
            title="Abre o WhatsApp Web com o texto — não marca como enviada"
          >
            Abrir no WhatsApp
          </a>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>
            Agora não
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={enviar}
            disabled={enviando || !mensagem.trim() || faltaVariavel}
          >
            {enviando ? 'Enviando...' : 'Enviar via WhatsGW'}
          </button>
        </div>
      </div>
    </div>
  );
}
