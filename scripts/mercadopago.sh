#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Conecta a lista de presentes à sua conta do Mercado Pago (Pix e cartão de crédito).
#
#  Na VPS:
#     cd /opt/noivado && git pull && ./scripts/mercadopago.sh
#
#  Pede o Access Token de produção e a assinatura secreta do webhook — o que você
#  cola NÃO aparece na tela nem fica no histórico —, confere o token no Mercado Pago,
#  grava no .env (só o root lê) e reinicia o site com ./scripts/vps-setup.sh.
#  Para trocar de conta depois, é só rodar de novo.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
MP_API="${MP_API_BASE:-https://api.mercadopago.com}"

if [ ! -f .env ]; then
  echo "✗ Não achei o .env. Instale o site primeiro: ./scripts/vps-setup.sh" >&2
  exit 1
fi

setenv() { # setenv CHAVE valor  → substitui (mesmo comentada) ou acrescenta no .env
  if grep -qE "^#? ?$1=" .env; then sed -i -E "s|^#? ?$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
getenv() { grep -E "^$1=" .env | cut -d= -f2- || true; }

echo
echo "Mercado Pago — conectar a lista de presentes"
echo
echo "  1) Access Token de PRODUÇÃO"
echo "     (Mercado Pago Developers → Suas integrações → sua aplicação → Credenciais de produção)"
read -rsp "     Cole aqui e tecle Enter (não aparece na tela): " TOKEN
echo
TOKEN="$(printf %s "$TOKEN" | tr -d '[:space:]')"
case "$TOKEN" in
  APP_USR-*) ;;
  TEST-*)
    echo "✗ Esse é um token de TESTE (começa com TEST-). Use o de produção, que começa com APP_USR-." >&2
    exit 1
    ;;
  *)
    echo "✗ Isso não parece um Access Token: ele começa com APP_USR-. Copie de novo." >&2
    exit 1
    ;;
esac
if ! [[ "$TOKEN" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "✗ O token tem caracteres inesperados. Copie de novo, inteiro." >&2
  exit 1
fi

echo "     conferindo no Mercado Pago…"
# O token vai num cabeçalho lido de um descritor, não na linha de comando (não aparece no `ps`).
if ! CONTA=$(curl -fsS --max-time 20 -H @<(printf 'Authorization: Bearer %s\n' "$TOKEN") "$MP_API/users/me"); then
  echo "✗ O Mercado Pago não aceitou este token (ou não respondeu). Confira se copiou o Access Token de produção inteiro." >&2
  exit 1
fi
campo() { printf %s "$CONTA" | grep -o "\"$1\": *\"[^\"]*\"" | head -n1 | cut -d'"' -f4; }
NICK="$(campo nickname)"
EMAIL="$(campo email)"
echo "     ✓ Conta: ${NICK:-sem apelido}${EMAIL:+ · $EMAIL}"

APP_URL="$(getenv APP_URL)"
echo
echo "  2) Assinatura secreta do webhook (recomendado)"
echo "     (sua aplicação → Webhooks → Configurar notificações → modo produção)"
echo "     URL:    ${APP_URL:-https://seu-site}/api/webhooks/mercadopago"
echo "     Evento: Pagamentos"
read -rsp "     Cole a assinatura secreta e tecle Enter (ou só Enter para pular): " SECRET
echo
SECRET="$(printf %s "$SECRET" | tr -d '[:space:]')"
if [ -n "$SECRET" ] && ! [[ "$SECRET" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "✗ A assinatura tem caracteres inesperados. Copie de novo." >&2
  exit 1
fi

setenv MP_ACCESS_TOKEN "$TOKEN"
if [ -n "$SECRET" ]; then setenv MP_WEBHOOK_SECRET "$SECRET"; fi
setenv PAYMENTS_SIMULATION false
chmod 600 .env
echo
echo "  ✓ Credenciais gravadas no .env"
if [ -z "$SECRET" ] && [ -z "$(getenv MP_WEBHOOK_SECRET)" ]; then
  echo "    (sem assinatura do webhook: os pagamentos são confirmados consultando o Mercado Pago;"
  echo "     rode este script de novo quando tiver a assinatura)"
fi

if [ "${NO_APPLY:-}" = 1 ]; then
  echo "  NO_APPLY=1: o site não foi reiniciado."
  exit 0
fi
echo "  reiniciando o site com as credenciais…"
echo
./scripts/vps-setup.sh
echo
echo "Pronto! Confira no painel: Configurações → Presentes (quadro “Mercado Pago”)."
