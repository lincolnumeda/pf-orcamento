-- Disparo automático de WhatsApp 5 minutos após um orçamento ser criado.
-- Roda tudo isso no SQL Editor do Supabase (Dashboard → SQL Editor), na
-- ordem em que aparece no arquivo.

-- 1) Extensões necessárias (pg_cron e pg_net já vêm disponíveis em projetos
--    Supabase, só precisam ser habilitadas uma vez).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Guarda a service_role key no Vault em vez de deixar em texto puro no
--    banco. SUBSTITUA 'COLE_AQUI_A_SERVICE_ROLE_KEY' pelo valor de
--    SUPABASE_SERVICE_ROLE_KEY do seu .env antes de rodar esta linha —
--    depois de rodar, apague o valor deste bloco da sua tela/histórico.
select vault.create_secret('COLE_AQUI_A_SERVICE_ROLE_KEY', 'service_role_key');

-- 3) Coluna de controle: marca quando o WhatsApp automático já foi
--    disparado para aquele orçamento, pra nunca mandar duas vezes.
ALTER TABLE orcamento.orcamentos
  ADD COLUMN IF NOT EXISTS whatsapp_automatico_enviado_em timestamptz;

-- 4) Função que varre orçamentos com mais de 5 minutos e ainda sem envio
--    automático, marca como enviado (antes de disparar, pra não reenviar
--    se o cron rodar de novo no meio do caminho) e chama a Edge Function
--    enviar-whatsapp via pg_net (assíncrono, não trava a função).
CREATE OR REPLACE FUNCTION orcamento.disparar_whatsapp_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = orcamento, extensions, vault, public
AS $$
DECLARE
  r record;
  function_url text := 'https://vtwxjuuzbonvywnmcics.supabase.co/functions/v1/enviar-whatsapp';
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  FOR r IN
    SELECT id
    FROM orcamento.orcamentos
    WHERE criado_em <= now() - interval '5 minutes'
      AND whatsapp_automatico_enviado_em IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE orcamento.orcamentos
    SET whatsapp_automatico_enviado_em = now()
    WHERE id = r.id;

    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('orcamento_id', r.id, 'tipo', 'automatico')
    );
  END LOOP;
END;
$$;

-- 5) Agenda a função pra rodar a cada 1 minuto (ela mesma filtra quem já
--    passou de 5 minutos e ainda não foi notificado).
SELECT cron.schedule(
  'whatsapp-automatico',
  '* * * * *',
  'SELECT orcamento.disparar_whatsapp_automatico();'
);

-- Pra conferir que o job foi criado:
-- SELECT * FROM cron.job;

-- Pra cancelar o agendamento, se precisar:
-- SELECT cron.unschedule('whatsapp-automatico');
