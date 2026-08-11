<?php
// Relay simples: repassa a chamada da Edge Function enviar-whatsapp pro
// WhatsGW. Existe porque a WhatsGW reseta conexões vindas da infraestrutura
// do Supabase Edge Functions (provável restrição de IP do lado deles) — daqui
// da Hostinger a conexão sai de um IP "normal" de hospedagem compartilhada.
//
// A Edge Function já monta o payload completo (apikey, phone_number,
// contact_phone_number, message_type, message_body) — este arquivo só
// autentica a chamada e repassa o corpo exatamente como chegou.

// Substituído pelo GitHub Actions no deploy (ver .github/workflows/deploy.yml)
// — nunca fica com o valor real neste arquivo dentro do repositório.
const RELAY_SHARED_SECRET = '__RELAY_SHARED_SECRET__';

const WHATSGW_URL = 'https://app.whatsgw.com.br/api/WhatsGw/Send';

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method Not Allowed']);
}

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

if ($authHeader !== ('Bearer ' . RELAY_SHARED_SECRET)) {
    respond(401, ['error' => 'Não autorizado']);
}

$body = file_get_contents('php://input');

$ch = curl_init(WHATSGW_URL);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
]);

$resposta = curl_exec($ch);

if ($resposta === false) {
    $erro = curl_error($ch);
    curl_close($ch);
    respond(502, ['error' => "Falha ao repassar pro WhatsGW: {$erro}"]);
}

$statusWhatsGw = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($statusWhatsGw ?: 200);
header('Content-Type: application/json');
echo $resposta;
