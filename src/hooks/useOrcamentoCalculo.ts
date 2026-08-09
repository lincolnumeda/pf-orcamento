import { useEffect, useMemo, useState } from 'react';
import type { Produto, ItemOrcamento } from '../types';
import { calcularOrcamento, contarLivros, type ResultadoCalculo } from '../lib/motorRegras';
import { calcularPrazoProducao, type ResultadoPrazoProducao } from '../lib/prazoProducao';
import { cotarFrete } from '../lib/frete';
import { buscarCidadeUf } from '../lib/cep';
import { useRegras } from './useRegras';
import { usePrazosProducao } from './usePrazosProducao';

const CEP_DEBOUNCE_MS = 600;

function cepValido(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ''));
}

export interface SelecaoProduto {
  quantidade: number;
  teachersGuide: boolean;
}

export function useOrcamentoCalculo(produtos: Produto[]) {
  const { regras } = useRegras();
  const { prazos: prazosProducao } = usePrazosProducao();
  const [cep, setCep] = useState('');
  const [selecoes, setSelecoes] = useState<Record<string, SelecaoProduto>>({});
  const [freteBruto, setFreteBruto] = useState(0);
  const [freteDias, setFreteDias] = useState<number | null>(null);
  const [freteServico, setFreteServico] = useState<string | null>(null);
  const [freteCarregando, setFreteCarregando] = useState(false);
  const [freteErro, setFreteErro] = useState<string | null>(null);
  const [cidadeUf, setCidadeUf] = useState<string | null>(null);

  const definirQuantidade = (produtoId: string, quantidade: number) => {
    setSelecoes((atual) => ({
      ...atual,
      [produtoId]: { quantidade: Math.max(0, quantidade), teachersGuide: atual[produtoId]?.teachersGuide ?? false },
    }));
  };

  const alternarTeachersGuide = (produtoId: string, ativo: boolean) => {
    setSelecoes((atual) => ({
      ...atual,
      [produtoId]: { quantidade: atual[produtoId]?.quantidade ?? 0, teachersGuide: ativo },
    }));
  };

  const itens: ItemOrcamento[] = useMemo(() => {
    const lista: ItemOrcamento[] = [];
    for (const produto of produtos) {
      const selecao = selecoes[produto.id];
      if (!selecao || selecao.quantidade <= 0) continue;

      lista.push({
        produto_id: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        quantidade: selecao.quantidade,
        preco_unitario: produto.preco,
        teachers_guide: false,
      });

      if (selecao.teachersGuide) {
        const guia = produtos.find((p) => p.categoria === 'teachers_guide' && p.livro_relacionado === produto.nome);
        if (guia) {
          lista.push({
            produto_id: guia.id,
            nome: guia.nome,
            categoria: guia.categoria,
            quantidade: 1,
            preco_unitario: guia.preco,
            teachers_guide: true,
          });
        }
      }
    }
    return lista;
  }, [produtos, selecoes]);

  const totalLivros = useMemo(() => contarLivros(itens), [itens]);

  useEffect(() => {
    if (!cepValido(cep) || totalLivros === 0) {
      setFreteBruto(0);
      setFreteDias(null);
      setFreteServico(null);
      setFreteErro(null);
      return;
    }

    let cancelado = false;
    setFreteCarregando(true);
    setFreteErro(null);

    const timer = setTimeout(() => {
      cotarFrete(cep, totalLivros)
        .then((cotacao) => {
          if (cancelado) return;
          setFreteBruto(cotacao.valor);
          setFreteDias(cotacao.prazoDias);
          setFreteServico(cotacao.servico);
        })
        .catch((err) => {
          if (cancelado) return;
          setFreteErro(err instanceof Error ? err.message : 'Falha ao cotar frete');
          setFreteBruto(0);
          setFreteDias(null);
          setFreteServico(null);
        })
        .finally(() => {
          if (!cancelado) setFreteCarregando(false);
        });
    }, CEP_DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [cep, totalLivros]);

  useEffect(() => {
    if (!cepValido(cep)) {
      setCidadeUf(null);
      return;
    }

    let cancelado = false;
    const timer = setTimeout(() => {
      buscarCidadeUf(cep).then((resultado) => {
        if (!cancelado) setCidadeUf(resultado);
      });
    }, CEP_DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [cep]);

  const resultado: ResultadoCalculo = useMemo(
    () => calcularOrcamento({ itens, freteBruto, regras, produtos }),
    [itens, freteBruto, regras, produtos],
  );

  const prazoProducao: ResultadoPrazoProducao | null = useMemo(
    () => (totalLivros > 0 ? calcularPrazoProducao(totalLivros, prazosProducao) : null),
    [totalLivros, prazosProducao],
  );

  return {
    cep,
    setCep,
    selecoes,
    definirQuantidade,
    alternarTeachersGuide,
    itens,
    totalLivros,
    freteCarregando,
    freteErro,
    freteDias,
    freteServico,
    prazoProducao,
    cidadeUf,
    resultado,
  };
}
