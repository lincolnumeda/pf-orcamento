interface RespostaViaCep {
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export async function buscarCidadeUf(cep: string): Promise<string | null> {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!resposta.ok) return null;

    const dados: RespostaViaCep = await resposta.json();
    if (dados.erro || !dados.localidade || !dados.uf) return null;

    return `${dados.localidade}/${dados.uf}`;
  } catch {
    return null;
  }
}
