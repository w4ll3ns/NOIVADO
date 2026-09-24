#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Deploy do site do noivado a partir do SEU COMPUTADOR, via SSH.
#  Envia o último commit para a VPS e roda lá o scripts/vps-setup.sh.
#  (Se preferir, rode o vps-setup.sh direto na VPS — veja o cabeçalho dele.)
#
#  Uso (dentro da pasta do projeto):
#     ./scripts/deploy.sh maby-chris                   # alias do ~/.ssh/config
#     ./scripts/deploy.sh maby-chris noivado.exemplo.com.br
#
#  O alias precisa entrar sem senha (chave SSH). Variáveis opcionais:
#  REMOTE_DIR (padrão ~/noivado), ADMIN_EMAIL, SEED_DEMO=false, APP_HOST_PORT,
#  SKIP_DNS_CHECK=1 — as últimas são repassadas ao vps-setup.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${1:-}"
DOMAIN_ARG="${2:-}"
REMOTE_DIR="${REMOTE_DIR:-noivado}"

if [ -z "$HOST" ]; then
  echo "Uso: ./scripts/deploy.sh <alias-ssh> [dominio]" >&2
  exit 1
fi
# O OpenSSH 9.6+ recusa nomes de host com & ; ' " $ ( ) etc., mesmo definidos no ~/.ssh/config.
case "$HOST" in
  *[\&\;\'\"\`\$\\\<\>\|\(\)\{\}\ ]*)
    echo "✗ O alias '$HOST' tem caracteres que o SSH não aceita (ex.: &)." >&2
    echo "  Use só letras, números, ponto, hífen ou _ — ex.: Host maby-chris no ~/.ssh/config." >&2
    exit 1 ;;
esac
cd "$(git rev-parse --show-toplevel)"

echo "▸ Testando SSH em $HOST…"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" 'echo "  conectado em $(hostname)"'

if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠ Há alterações não commitadas — será enviado o último commit ($(git rev-parse --short HEAD))."
fi

echo "▸ Enviando o código ($(git rev-parse --short HEAD))…"
ssh "$HOST" "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && rm -rf src drizzle public scripts tests docs"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C $REMOTE_DIR"

echo "▸ Preparando o servidor…"
REMOTE_ENV=""
for v in ADMIN_EMAIL SEED_DEMO APP_HOST_PORT SKIP_DNS_CHECK; do
  if [ -n "${!v:-}" ]; then REMOTE_ENV+="$v=$(printf '%q' "${!v}") "; fi
done
ssh "$HOST" "cd $REMOTE_DIR && ${REMOTE_ENV}bash scripts/vps-setup.sh $(printf '%q' "$DOMAIN_ARG")"
