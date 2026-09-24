# Noivado · Maby & Chris

Convite digital, portal individual do convidado, confirmação de presença, lista de presentes com
Mercado Pago, envio personalizado pelo WhatsApp, álbum colaborativo com câmera e QR Codes, e um
painel administrativo completo — tudo com a identidade do Save the Date (Casa de Zaquia, Centro
Histórico de São Luís, 31 · 10 · 2026).

> O planejamento pedido no briefing (design system, paleta, tipografia, componentes, wireframes,
> navegação, banco, portal, fluxos de RSVP/WhatsApp/presentes/Mercado Pago/álbum/câmera e estrutura
> do admin) está em **[docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md)**.

## O que tem aqui

**Site público**
- Abertura com a fachada da Casa de Zaquia em gravura: a porta dupla abre em 3D, a luz do interior
  surge, a "câmera" se aproxima e entra no casarão. Pode ser pulada e não se repete no mesmo aparelho.
- Home com contador ("Faltam XX dias…"), Nossa História (texto + linha do tempo + fotos oficiais),
  O noivado (data, horários, programação, orientações e o próprio Save the Date), Localização
  (Google Maps / Waze), Dress Code (paleta sugerida e cores reservadas), Presentes, Dúvidas.
- Galeria ("Nossa história em fotos" + "Nosso noivado pelos seus olhos"), livro de mensagens e aviso
  de privacidade (LGPD).

**Portal do convidado** — `/i/<código>`
- Um link por convite (pessoa, casal, família ou grupo), com 12 caracteres aleatórios, sem dados pessoais.
- "Olá, João e Maria! ❤️": minha presença, meu presente, minha mensagem, informações do evento e álbum.
- Confirmação individual por pessoa, acompanhantes (quando permitido, até o máximo definido),
  perguntas opcionais e alteração até o prazo — cada envio fica no histórico.
- "Link acessado" só é registrado quando um navegador de verdade abre o convite (robôs de prévia do
  WhatsApp não contam) e a pré-visualização pelo painel também não conta.

**Presentes + Mercado Pago**
- Valor fixo ou personalizado (mínimo, máximo, sugerido, atalhos), presente único, limitado ou
  múltiplo; "Já fomos presenteados ❤️" quando esgota; reserva de 30 min contra compras simultâneas.
- Checkout Pro (ambiente do Mercado Pago: Pix, cartão, boleto). Nenhum dado de cartão passa por aqui.
- Webhook com verificação de assinatura, consulta obrigatória à API e idempotência. A página de
  retorno nunca aprova nada sozinha.

**Álbum colaborativo** — `/a/<código>` (QR Code)
- Sem login: abrir câmera (traseira por padrão), prévia "Gostou dessa foto?", salvar, tirar outra.
  Fallback para a câmera nativa quando o navegador não permite; envio da galeria (várias fotos).
- Guarda o original + versão web WebP sem EXIF/GPS + miniatura. Moderação (padrão: exigir aprovação).
- QR Codes por local (mesas, bar, entrada…): PNG, SVG, PDF A4 com 4 cartões e versão para imprimir.

**Painel** — `/admin`
- Dashboard com funil (enviados → acessados → confirmados), presenças, presentes e álbum.
- Convites: filtros do funil, busca, WhatsApp com pré-visualização, lembrete para quem acessou e não
  confirmou, copiar link/mensagem, ver portal, histórico completo, importação Excel/CSV.
- Envio em sequência pelo WhatsApp, modelos com variáveis, presentes, pagamentos (filtros por
  período/status/presente/convidado), mensagens, álbum/fotos (ZIP), galeria do casal, FAQ,
  configurações sem programação, equipe com papéis e registros de auditoria.
- Exportação em Excel e CSV de convidados, convites, RSVP, presentes, pagamentos e mensagens.

## Tecnologia

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL + Drizzle ORM · sharp · Mercado Pago
REST API · pdf-lib · qrcode · exceljs · fflate. Sem frameworks de UI: o design system é CSS próprio
(`src/styles`), com fontes locais OFL (Cormorant Garamond, EB Garamond e Pinyon Script).

## Rodando localmente

Pré-requisitos: Node 20.9+ e PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL, APP_URL=http://localhost:3000, APP_SECRET
                              # e ADMIN_EMAIL/ADMIN_PASSWORD para o primeiro acesso
npm run db:migrate            # cria as tabelas
npm run db:seed               # presentes, FAQ, programação, modelos de WhatsApp, álbum e admin
npm run db:seed -- --demo     # (opcional) 3 convites de exemplo — os links aparecem no terminal
npm run dev
```

- Site: http://localhost:3000 · Painel: http://localhost:3000/admin
- Sem `MP_ACCESS_TOKEN` e com `PAYMENTS_SIMULATION=true`, o fluxo de presentes usa uma tela de
  simulação (somente em desenvolvimento).
- A câmera exige HTTPS — em `localhost` o navegador libera; para testar no celular use um túnel HTTPS.

Outros comandos: `npm run admin:create -- email@dominio.com "Nome" owner` (cria ou redefine senha),
`npm test` (testes), `npm run typecheck`, `npm run db:generate` (após mudar `src/lib/db/schema.ts`).

## Publicando

### Opção A — um servidor (VPS) com Docker

**Em um comando**, do seu computador (onde o alias SSH da VPS já funciona):

```bash
git clone https://github.com/w4ll3ns/NOIVADO.git && cd NOIVADO
git checkout claude/maby-chris-engagement-site-1ejh8s
./scripts/deploy.sh 'maby&chris'                        # sem domínio → https://<ip>.sslip.io
./scripts/deploy.sh 'maby&chris' noivado.seudominio.com # com domínio (DNS A apontando para a VPS)
```

O script envia o código, instala o Docker se faltar, cria swap em VPS pequenas, gera o `.env`
com segredos aleatórios, abre as portas 80/443 no `ufw`, sobe Postgres + app + Caddy (HTTPS) e
imprime o endereço, o login do painel e três convites de exemplo (`SEED_DEMO=false` para não
criá-los). Rodar de novo atualiza o site mantendo banco, fotos e `.env`. Se a VPS já tiver nginx/Apache
nas portas 80/443, ele sobe sem o Caddy e mostra a configuração de proxy a usar.

**Manualmente:**

```bash
cp .env.example .env    # APP_URL=https://seu-dominio, APP_SECRET, MP_*, ADMIN_*, DOMAIN, POSTGRES_PASSWORD
docker compose up -d --build
```

Sobe Postgres, aplica migrações/seed, inicia a aplicação e o Caddy com HTTPS automático. Fotos ficam
no volume `storage`; faça backup dele e do volume `pgdata`.

### Opção B — plataformas gerenciadas

Qualquer host de Node com Postgres (Neon, Supabase, Railway, Render…). Em plataformas sem disco
persistente (ex.: Vercel), use `STORAGE_DRIVER=s3` com Cloudflare R2, S3 ou B2. Rode
`npm run db:migrate && npm run db:seed` uma vez apontando para o banco de produção.

### Checklist de produção
- [ ] `APP_URL` com o domínio final em **https** (vai nos links dos convites e QR Codes).
- [ ] `APP_SECRET` forte; `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` se houver mais de uma instância.
- [ ] Mercado Pago: credenciais de **produção** em `MP_ACCESS_TOKEN`; em *Suas integrações → Webhooks*
      configure `https://SEU-DOMINIO/api/webhooks/mercadopago`, evento **Pagamentos**, e copie a
      assinatura secreta para `MP_WEBHOOK_SECRET`. Faça um presente de teste de R$ 1,00.
- [ ] Troque a senha inicial do painel em *Minha conta*; crie acessos para quem ajudar (papéis Editor/Leitura).
- [ ] Revise em *Configurações*: endereço completo, horários, prazo do RSVP, contato para dúvidas.
- [ ] Imprima os QR Codes em *Álbum → QR Code* (um por local) e teste um envio no celular.

## Como os noivos usam

1. **Convites** → *Importar* (planilha modelo disponível) ou *+ Novo convite*. Um convite = um link.
2. **WhatsApp** → *Envio em sequência*: abre o WhatsApp com a mensagem pronta, você toca em enviar,
   volta e passa para o próximo. Nada é enviado automaticamente.
3. Acompanhe o **Dashboard**: quem acessou e ainda não confirmou recebe o botão *Enviar lembrete*.
4. No dia: QR Codes nas mesas; aprove as fotos em **Fotos**; depois, *Baixar álbum* (ZIP dos originais)
   e encerre os envios em **Álbum** (o QR continua mostrando a galeria).

## Segurança e privacidade

- Sessões do painel com token aleatório (hash SHA-256 no banco), cookie `HttpOnly`/`Secure`/`SameSite=Lax`
  (`__Host-` em produção), expiração deslizante; senhas com scrypt; bloqueio por tentativas (IP e e-mail).
- Papéis (proprietário, editor, leitura) verificados no servidor em toda página e ação; auditoria.
- CSP com nonce por requisição, HSTS, `X-Frame-Options`, `Referrer-Policy` (o código do convite não vaza
  para outros sites), `Permissions-Policy` (câmera só no próprio site), redirecionamento para HTTPS.
- Validação no servidor (zod), SQL parametrizado (Drizzle), texto de convidados escapado pelo React,
  CSV protegido contra fórmulas, verificação de origem nos endpoints, limites de taxa no Postgres.
- Upload: tipo verificado pelo conteúdo, limite de tamanho, versões públicas sem metadados de localização;
  originais e fotos não aprovadas só são servidos ao painel.
- Telefones, e-mails, pagamentos e históricos nunca aparecem em páginas públicas; IPs são guardados
  apenas como HMAC. Detalhes para o convidado em `/privacidade`.

## Estrutura

```
docs/PLANEJAMENTO.md        planejamento (15 itens)
drizzle/                    migrações SQL
scripts/                    migrate, seed, create-admin
src/app/(site)/             site público, portal (/i), presentes, galeria, mensagens
src/app/a/[token]/          álbum colaborativo (QR)
src/app/admin/              painel
src/app/api/                beacon de acesso, upload, webhook MP, exportações, QR, ZIP
src/components/casarao/     fachada da Casa de Zaquia (SVG)
src/components/intro/       abertura com a porta
src/components/ornaments/   divisores, molduras, brasão, ícones em gravura
src/lib/                    regras de negócio (convites, RSVP, presentes, pagamentos, álbum…)
src/styles/                 design system (tokens, base, site, abertura, casarão, admin)
tests/                      testes (vitest)
```

## Personalizando a arte

- `public/brand/save-the-date.jpg` é o Save the Date original — usado na seção do evento e como imagem
  de prévia quando o link é compartilhado.
- A fachada está em `src/components/casarao/Facade.tsx` (SVG desenhado em código, fiel ao estilo do
  Save the Date). Se o ilustrador enviar uma versão vetorial da Casa de Zaquia, ela pode substituir esse
  componente mantendo o recorte da porta (`DOOR`) para a animação.
