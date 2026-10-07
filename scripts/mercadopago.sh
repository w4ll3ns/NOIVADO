#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Conecta a lista de presentes à sua conta do Mercado Pago (Pix e cartão de crédito).
#
#  Na VPS:
#     cd /opt/noivado && git pull && ./scripts/mercadopago.sh
#
#  Pede o Access Token e a Public Key de produção e a assinatura secreta do webhook
#  (o token e a assinatura NÃO aparecem na tela nem ficam no histórico), confere o token
#  no Mercado Pago, grava no .env (só o root lê) e reinicia o site com ./scripts/vps-setup.sh.
#  Com a Public Key, o convidado paga sem sair do site (Pix com QR Code e cartão).
#  Rodando de novo, Enter mantém o que já está salvo.
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
ATUAL_TOKEN="$(getenv MP_ACCESS_TOKEN)"
ATUAL_PUBLIC="$(getenv MP_PUBLIC_KEY)"
ATUAL_SECRET="$(getenv MP_WEBHOOK_SECRET)"

echo "  1) Access Token de PRODUÇÃO"
echo "     (Mercado Pago Developers → Suas integrações → sua aplicação → Credenciais de produção)"
if [ -n "$ATUAL_TOKEN" ]; then
  read -rsp "     Cole o novo e tecle Enter (não aparece na tela), ou só Enter para manter o atual: " TOKEN
else
  read -rsp "     Cole aqui e tecle Enter (não aparece na tela): " TOKEN
fi
echo
TOKEN="$(printf %s "$TOKEN" | tr -d '[:space:]')"
if [ -z "$TOKEN" ] && [ -n "$ATUAL_TOKEN" ]; then
  TOKEN="$ATUAL_TOKEN"
  echo "     (mantendo o Access Token atual)"
fi
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

echo
echo "  2) Public Key de PRODUÇÃO (para pagar sem sair do site)"
echo "     (mesma tela das credenciais; também começa com APP_USR-)"
if [ -n "$ATUAL_PUBLIC" ]; then
  read -rp "     Cole a nova e tecle Enter, ou só Enter para manter a atual: " PUBLIC
else
  read -rp "     Cole aqui e tecle Enter (ou só Enter para pular): " PUBLIC
fi
PUBLIC="$(printf %s "$PUBLIC" | tr -d '[:space:]')"
if [ -z "$PUBLIC" ]; then PUBLIC="$ATUAL_PUBLIC"; fi
if [ -n "$PUBLIC" ]; then
  case "$PUBLIC" in
    APP_USR-*) ;;
    TEST-*)
      echo "✗ Essa é uma Public Key de TESTE. Use a de produção, que começa com APP_USR-." >&2
      exit 1
      ;;
    *)
      echo "✗ Isso não parece uma Public Key (ela começa com APP_USR-)." >&2
      exit 1
      ;;
  esac
  if ! [[ "$PUBLIC" =~ ^[A-Za-z0-9_-]+$ ]] || [ "$PUBLIC" = "$TOKEN" ]; then
    echo "✗ Confira a Public Key: ela é diferente do Access Token (é a chave mais curta)." >&2
    exit 1
  fi
fi

APP_URL="$(getenv APP_URL)"
echo
echo "  3) Assinatura secreta do webhook (recomendado)"
echo "     (sua aplicação → Webhooks → Configurar notificações → modo produção)"
echo "     URL:    ${APP_URL:-https://seu-site}/api/webhooks/mercadopago"
echo "     Evento: Pagamentos"
if [ -n "$ATUAL_SECRET" ]; then
  read -rsp "     Cole a nova assinatura e tecle Enter, ou só Enter para manter a atual: " SECRET
else
  read -rsp "     Cole a assinatura secreta e tecle Enter (ou só Enter para pular): " SECRET
fi
echo
SECRET="$(printf %s "$SECRET" | tr -d '[:space:]')"
if [ -n "$SECRET" ] && ! [[ "$SECRET" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "✗ A assinatura tem caracteres inesperados. Copie de novo." >&2
  exit 1
fi

setenv MP_ACCESS_TOKEN "$TOKEN"
if [ -n "$PUBLIC" ]; then setenv MP_PUBLIC_KEY "$PUBLIC"; fi
if [ -n "$SECRET" ]; then setenv MP_WEBHOOK_SECRET "$SECRET"; fi
setenv PAYMENTS_SIMULATION false
chmod 600 .env
echo
echo "  ✓ Credenciais gravadas no .env"
if [ -n "$PUBLIC" ]; then
  echo "    Pagamento: no próprio site (Pix com QR Code e cartão de crédito)"
else
  echo "    Pagamento: na página do Mercado Pago (sem Public Key)"
fi
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
