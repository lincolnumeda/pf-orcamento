// Lógica pura de montagem da chamada pro WhatsGW — sem rede, testável com
// qualquer runtime.

export interface EnvioWhatsapp {
  numeroDestino: string;
  mensagem: string;
}

export interface PayloadWhatsGW {
  apikey: string;
  phone_number: string;
  contact_phone_number: string;
  message_type: string;
  message_body: string;
}

export function formatarNumero(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

export function montarPayloadWhatsGW(apiKey: string, numeroRemetente: string, envio: EnvioWhatsapp): PayloadWhatsGW {
  return {
    apikey: apiKey,
    phone_number: formatarNumero(numeroRemetente),
    contact_phone_number: formatarNumero(envio.numeroDestino),
    message_type: 'text',
    message_body: envio.mensagem,
  };
}
