export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

// Confere os dois dígitos verificadores. Rejeita sequências repetidas
// (000.000.000-00, 111.111.111-11...), que passam na conta mas não existem.
export function cpfValido(valor: string): boolean {
  const c = somenteDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    return ((soma * 10) % 11) % 10;
  };

  return digito(c.slice(0, 9), 10) === Number(c[9]) && digito(c.slice(0, 10), 11) === Number(c[10]);
}

// Máscara progressiva enquanto digita: 000.000.000-00
export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// WhatsApp brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular), DDD sem
// zero na frente.
export function whatsappValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  return (d.length === 10 || d.length === 11) && /^[1-9]{2}/.test(d);
}
