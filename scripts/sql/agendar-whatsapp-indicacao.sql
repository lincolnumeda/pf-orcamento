-- WhatsApp automático "indicação recebida", ~2 minutos depois do insert.
-- Mesmo padrão de agendar-whatsapp-automatico.sql (pg_cron + pg_net + Vault).
-- Roda no SQL Editor do Supabase DEPOIS de criar-indicacoes.sql.
--
-- Pré-requisitos (já feitos quando o WhatsApp automático de orçamento foi
-- configurado — NÃO precisa repetir):
--   - extensões pg_cron e pg_net habilitadas
--   - secret 'service_role_key' no Vault
-- Pra conferir: SELECT name FROM vault.decrypted_secrets WHERE name = 'service_role_key';
--
-- Também precisa da Edge Function enviar-whatsapp-indicacao publicada:
--   npx supabase functions deploy enviar-whatsapp-indicacao

-- 1) Função que varre indicações com mais de 2 minutos ainda sem disparo,
--    marca whatsapp_recebida_disparado_em (antes de chamar, pra o cron nunca
--    disparar duas vezes) e chama a Edge Function via pg_net (assíncrono).
--    A function, por sua vez, só envia se whatsapp_recebida_enviado_em ainda
--    estiver vazio. Se o envio falhar, a Central mostra o botão "Recebida"
--    disponível pra mandar à mão.
--    Janela de 1 dia: se o cron ficar parado, não sai mensagem velha em massa.
CREATE OR REPLACE FUNCTION orcamento.disparar_whatsapp_indicacao_recebida()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = orcamento, extensions, vault, public
AS $$
DECLARE
  r record;
  function_url text := 'https://vtwxjuuzbonvywnmcics.supabase.co/functions/v1/enviar-whatsapp-indicacao';
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  FOR r IN
    SELECT id
    FROM orcamento.indicacoes
    WHERE criado_em <= now() - interval '2 minutes'
      AND criado_em >= now() - interval '1 day'
      AND whatsapp_recebida_disparado_em IS NULL
      AND whatsapp_recebida_enviado_em IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE orcamento.indicacoes
    SET whatsapp_recebida_disparado_em = now()
    WHERE id = r.id;

    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('indicacao_id', r.id, 'tipo', 'recebida', 'automatico', true)
    );
  END LOOP;
END;
$$;

-- 2) Agenda pra rodar a cada 1 minuto (a função filtra quem já passou de 2
--    minutos e ainda não foi disparado).
SELECT cron.schedule(
  'whatsapp-indicacao-recebida',
  '* * * * *',
  'SELECT orcamento.disparar_whatsapp_indicacao_recebida();'
);

-- Pra conferir que o job foi criado:
-- SELECT * FROM cron.job;
-- Últimas execuções:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Pra cancelar o agendamento, se precisar:
-- SELECT cron.unschedule('whatsapp-indicacao-recebida');
