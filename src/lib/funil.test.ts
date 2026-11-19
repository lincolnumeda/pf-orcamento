import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
const select = vi.fn();
const from = vi.fn((_tabela: string) => ({ insert }));
const getSession = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: () => getSession() } },
  orcamentoDb: { from: (tabela: string) => from(tabela) },
}));

function storageEmMemoria(): Storage {
  const dados = new Map<string, string>();
  return {
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, String(v)),
    removeItem: (k) => void dados.delete(k),
    clear: () => dados.clear(),
    key: (i) => [...dados.keys()][i] ?? null,
    get length() {
      return dados.size;
    },
  };
}

const storageQuebrado = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
} as unknown as Storage;

async function carregar() {
  vi.resetModules();
  return import('./funil');
}

const esperarEnvio = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  insert.mockReset();
  select.mockReset();
  from.mockClear();
  getSession.mockReset();
  // O retorno do insert tem .select() disponível: se o código chamasse, o
  // teste pegaria (anon não pode ler a tabela).
  insert.mockImplementation(() => Object.assign(Promise.resolve({ error: null }), { select }));
  getSession.mockResolvedValue({ data: { session: null } });
  vi.stubGlobal('window', { location: { search: '?origem=ManyChat', hostname: 'orcamento.pequenosfluentes.com.br' }, innerWidth: 390 });
  vi.stubGlobal('document', { referrer: '' });
  vi.stubGlobal('localStorage', storageEmMemoria());
  vi.stubGlobal('sessionStorage', storageEmMemoria());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('calcularOrigem', () => {
  it('usa o ?origem= da URL, normalizado', async () => {
    const { calcularOrigem } = await carregar();
    expect(calcularOrigem('?origem=ManyChat', '', 'x.com')).toBe('manychat');
    expect(calcularOrigem('?origem=Insta Bio!', '', 'x.com')).toBe('insta-bio');
  });

  it('corta o ?origem= em 100 caracteres', async () => {
    const { calcularOrigem } = await carregar();
    expect(calcularOrigem(`?origem=${'a'.repeat(500)}`, '', 'x.com')).toHaveLength(100);
  });

  it('sem parâmetro, usa só o domínio do referrer (sem www, sem caminho)', async () => {
    const { calcularOrigem } = await carregar();
    expect(calcularOrigem('', 'https://www.instagram.com/p/abc?x=1', 'x.com')).toBe('instagram.com');
  });

  it('referrer do próprio site, inválido ou vazio vira "direto"', async () => {
    const { calcularOrigem } = await carregar();
    expect(calcularOrigem('', 'https://www.x.com/central', 'x.com')).toBe('direto');
    expect(calcularOrigem('', 'não é url', 'x.com')).toBe('direto');
    expect(calcularOrigem('?origem=', '', 'x.com')).toBe('direto');
  });
});

describe('calcularDispositivo', () => {
  it('abaixo de 768px é mobile', async () => {
    const { calcularDispositivo } = await carregar();
    expect(calcularDispositivo(390)).toBe('mobile');
    expect(calcularDispositivo(1280)).toBe('desktop');
  });
});

describe('registrarEvento', () => {
  it('faz insert simples (sem .select()) só com os campos permitidos, sem dado pessoal', async () => {
    const { registrarEvento } = await carregar();
    registrarEvento('pagina_aberta');
    await esperarEnvio();

    expect(from).toHaveBeenCalledWith('eventos');
    expect(insert).toHaveBeenCalledTimes(1);
    const linha = insert.mock.calls[0][0];
    expect(Object.keys(linha).sort()).toEqual(['dispositivo', 'equipe', 'evento', 'origem', 'visitante_id']);
    expect(linha).toMatchObject({ evento: 'pagina_aberta', origem: 'manychat', dispositivo: 'mobile', equipe: false });
    expect(select).not.toHaveBeenCalled();
  });

  it('marca equipe=true quando há sessão logada no navegador', async () => {
    getSession.mockResolvedValue({ data: { session: { user: {} } } });
    const { registrarEvento } = await carregar();
    registrarEvento('livro_adicionado');
    await esperarEnvio();
    expect(insert.mock.calls[0][0].equipe).toBe(true);
  });

  it('não registra o mesmo evento 2x na mesma aba, nem depois de recarregar a página', async () => {
    const primeira = await carregar();
    primeira.registrarEvento('pagina_aberta');
    primeira.registrarEvento('pagina_aberta');
    // "recarregar": módulo novo, mesmo sessionStorage
    const segunda = await carregar();
    segunda.registrarEvento('pagina_aberta');
    segunda.registrarEvento('contato_iniciado');
    await esperarEnvio();

    expect(insert.mock.calls.map((c) => c[0].evento)).toEqual(['pagina_aberta', 'contato_iniciado']);
  });

  it('mantém o mesmo visitante_id entre eventos', async () => {
    const { registrarEvento } = await carregar();
    registrarEvento('pagina_aberta');
    registrarEvento('livro_adicionado');
    await esperarEnvio();
    const [a, b] = insert.mock.calls.map((c) => c[0].visitante_id);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it('com storage bloqueado, ainda registra (1 código por página) e não lança erro', async () => {
    vi.stubGlobal('localStorage', storageQuebrado);
    vi.stubGlobal('sessionStorage', storageQuebrado);
    const { registrarEvento } = await carregar();
    expect(() => {
      registrarEvento('pagina_aberta');
      registrarEvento('pagina_aberta');
      registrarEvento('frete_calculado');
    }).not.toThrow();
    await esperarEnvio();
    const linhas = insert.mock.calls.map((c) => c[0]);
    expect(linhas.map((l) => l.evento)).toEqual(['pagina_aberta', 'frete_calculado']);
    expect(linhas[0].visitante_id).toBe(linhas[1].visitante_id);
  });

  it('se o insert ou a sessão falharem, não lança erro nem rejeita promessa solta', async () => {
    getSession.mockRejectedValue(new Error('rede'));
    insert.mockImplementation(() => Promise.reject(new Error('rede')));
    const { registrarEvento } = await carregar();
    expect(() => registrarEvento('orcamento_enviado')).not.toThrow();
    await esperarEnvio();
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
