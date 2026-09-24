# Noivado Maby & Chris — Planejamento

Este documento cobre os 15 itens pedidos antes da implementação (seção 68 do briefing).
O código em `src/` segue exatamente estas decisões; quando algo mudar, atualize aqui.

A referência visual é o Save the Date (`public/brand/save-the-date.jpg`): fundo creme rosado,
traço sépia fino, moldura barroca com arabescos, casarão em gravura e a combinação
"caixa-alta serifada espaçada + caligrafia".

---

## 1. Design System

**Princípio:** o site é papel impresso, não interface. Cada tela deve parecer uma página do
convite — muito respiro, traço fino, ornamentos pontuais e nenhuma "cara de app".

| Camada | Arquivo | Conteúdo |
| --- | --- | --- |
| Tokens | `src/styles/tokens.css` | cores, tipografia, espaçamentos, raios, durações |
| Base | `src/styles/base.css` | reset, papel texturizado, tipografia, links, foco |
| Componentes do site | `src/styles/site.css` | botões, molduras, seções, formulários, portal, presentes, álbum |
| Admin | `src/styles/admin.css` | layout funcional com a mesma paleta e títulos serifados |
| Ornamentos | `src/components/ornaments/*` | SVGs: divisores, cantos de moldura, brasão, ícones em gravura |
| Casarão | `src/components/casarao/*` | o desenho original do Save the Date + luzes nas janelas |

Regras:

- **Sem sombras genéricas.** Profundidade vem de filetes duplos (`border` + `outline` com offset),
  como nas molduras impressas.
- **Sem gradientes modernos.** O único "gradiente" é a luz quente atrás da porta na abertura.
- **Textura de papel** via SVG `feTurbulence` embutido (≈ 400 bytes), opacidade 4–6%.
- **Movimento lento e curto**: 200–400 ms para interações, 2,4 s na abertura; tudo respeita
  `prefers-reduced-motion`.
- **Toques grandes**: altura mínima de 52 px para botões e opções no celular.

## 2. Paleta (amostrada do Save the Date)

Valores medidos na imagem (média de pixels de fundo e de traço):

| Token | Hex | Uso |
| --- | --- | --- |
| `--paper` | `#F8EDE5` | fundo principal (idêntico ao Save the Date) |
| `--ivory` | `#FCF7F2` | superfícies elevadas, cartões de papel |
| `--cream` | `#F2E4D8` | faixas alternadas, campos |
| `--beige` | `#E7D6C6` | filetes, divisórias |
| `--taupe-light` | `#CDBBA9` | bordas suaves, estados desabilitados |
| `--taupe` | `#B1A190` | traço médio medido na imagem |
| `--sepia` | `#7C6855` | traço principal da gravura, títulos, botões |
| `--sepia-deep` | `#62503F` | hover de botões, ícones |
| `--ink` | `#4E3E31` | texto corrido (contraste 8,4:1 sobre `--paper`) |
| `--glow` | `#FFF3DD` | luz interna do casarão (somente na abertura) |

Cores de estado (apenas no admin e em selos discretos), dessaturadas para conversar com o sépia:
`--sage #6F7F5C` (confirmado/aprovado), `--ochre #A9844A` (pendente), `--rose #A0604F`
(recusado/erro), `--slate #6E7076` (neutro/informativo).

Contraste verificado: `--sepia` sobre `--paper` = 4,6:1 (AA para texto normal);
`--ink` sobre `--paper` = 8,4:1.

## 3. Tipografia

As mesmas duas famílias do Save the Date, ambas OFL, servidas localmente por `next/font/local`
(sem requisição externa):

| Papel | Fonte | Onde |
| --- | --- | --- |
| Títulos e texto | **EB Garamond** variável 400–800 (+ itálico) | "NOIVADO" e títulos em caixa-alta com `letter-spacing: .28em`; parágrafos, formulários, portal |
| Caligrafia | **MonteCarlo** 400 | "Maby & Chris", saudações ("Olá, João e Maria") |

Escala fluida (`clamp`), mobile first:

- `--fs-script-xl` 3.4 → 6.2 rem (nome do casal na abertura)
- `--fs-display` 1.9 → 3 rem (títulos de seção)
- `--fs-caps` 0.95 → 1.15 rem (sobretítulos em caixa-alta espaçada)
- `--fs-body` 1.125 rem (18 px), `line-height: 1.65`
- `--fs-small` 0.95 rem

O admin usa EB Garamond nos títulos e a pilha de sistema (`system-ui`) nas tabelas, por densidade.

## 4. Componentes principais

| Componente | Descrição |
| --- | --- |
| `Casarao` | o casarão do Save the Date (traço sépia transparente) com luz quente opcional nas janelas e no portão |
| `CasaraoIntro` | abertura: o casarão se desenha, as janelas acendem, ENTRAR leva a câmera pelo portão; "pular"; memória por dispositivo |
| `Divider` / `Rule` | os filetes do Save the Date (arabesco e losango), recortados da arte |
| `FrameCorners` | o canto de voluta do Save the Date, espelhado nos quatro cantos de cartões |
| `Crest` | o topo do dossel do Save the Date (urna com folhagem), no alto de páginas |
| `SaveTheDateFrame` | a moldura inteira do Save the Date (topo da página inicial, com os textos por cima) |
| `Button` | primário (sépia sólido, filete interno), secundário (contorno), texto (sublinhado fino) |
| `SectionTitle` | sobretítulo em caixa-alta + título serifado + divisor |
| `PaperCard` | superfície marfim com filete duplo — substitui "cards" genéricos |
| `Seal` | selo circular de status ("Presença confirmada", "Presente recebido") |
| `ChoiceToggle` | par de opções grandes ("Estarei presente" / "Não poderei comparecer") |
| `Countdown` | "Faltam XX dias para celebrarmos juntos." (fuso America/Fortaleza) |
| `SiteNav` | barra discreta; no celular, "Menu" abre página inteira com a lista em serifa |
| `GiftCard` | cartão de papel com ícone gravado, nome, descrição em itálico e valor |
| `CameraCapture` | câmera em tela cheia, obturador, prévia "Gostou dessa foto?" |
| `Lightbox` | visualização em tela cheia da galeria com gestos |
| `EngravedIcon` | ícones de linha no estilo gravura (taças, avião, casa, café, coração, câmera…) |

## 5. Wireframes (mobile, 390 px)

```
ABERTURA                       HOME                           PORTAL /i/[token]
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│               pular ›│       │ ❦  Menu   [CONFIRMAR]│       │ ❦  Menu   [CONFIRMAR]│
│      Maby & Chris    │       │        ~crest~       │       │   Olá, João e Maria! │
│      31 . 10 . 2026  │       │       NOIVADO        │       │  Que bom ter vocês   │
│  ┌────────────────┐  │       │     Maby & Chris     │       │      por aqui.       │
│  │ ▲ platibanda ▲ │  │       │  31 de outubro 2026  │       │ ┌─ MINHA PRESENÇA ─┐ │
│  │ ∩ ∩ ∩ ∩ ∩ sac. │  │       │    Casa de Zaquia    │       │ │ ✓ confirmada     │ │
│  │ ∩ ∩ ▯▯ ∩ ∩     │  │       │ Centro Histórico–MA  │       │ │ João · Maria     │ │
│  │▔▔▔▔porta▔▔▔▔▔▔ │  │       │   — ∽ • ❦ • ∽ —      │       │ │ [ALTERAR]        │ │
│  └────────────────┘  │       │ Faltam 38 dias para  │       │ ├─ MEU PRESENTE ───┤ │
│ "Uma nova porta se   │       │ celebrarmos juntos.  │       │ │ Jantar romântico │ │
│  abre para a nossa   │       │ [CONFIRMAR PRESENÇA] │       │ │ R$ 350 · recebido│ │
│      história."      │       │ [  VER DETALHES   ]  │       │ ├─ MINHA MENSAGEM ─┤ │
│      [ ENTRAR ]      │       │    ver presentes ›   │       │ ├─ O NOIVADO ──────┤ │
└──────────────────────┘       └──────────────────────┘       └──────────────────────┘

RSVP /i/[token]/presenca       PRESENTE /presentes/[id]       ÁLBUM /a/[token]
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│ Contamos com vocês?  │       │   (ícone gravado)    │       │    Álbum do Noivado  │
│ ── João Silva ─────  │       │   Jantar romântico   │       │ Registre esse momento│
│ [✓ Estarei presente] │       │ "Uma noite só nossa" │       │       conosco.       │
│ [  Não poderei     ] │       │      R$ 350,00       │       │ Queremos ver o nosso │
│ ── Maria Silva ────  │       │ Seus dados           │       │ noivado pelos seus   │
│ [✓ Estarei presente] │       │ Nome  [João Silva  ] │       │        olhos.        │
│ + acompanhante (1)   │       │ E-mail[.........   ] │       │ [   ABRIR CÂMERA   ] │
│ Algo que devemos     │       │ Mensagem aos noivos  │       │ [ESCOLHER DA GALERIA]│
│ saber? (opcional)  ▾ │       │ [................. ] │       │ aviso de privacidade │
│ [ENVIAR RESPOSTA]    │       │ [    PRESENTEAR    ] │       │                      │
└──────────────────────┘       └──────────────────────┘       └──────────────────────┘
```

Desktop: mesma estrutura, coluna central de até 720 px para texto e grade de 2–3 colunas
para presentes e galeria; o casarão da abertura ocupa ~80% da altura.

## 6. Arquitetura de navegação

```
/                      Home (abertura na 1ª visita do dispositivo)
  #historia            Nossa História (texto + timeline + fotos oficiais)
  #noivado             O nosso noivado (data, horários, orientações, programação)
  #localizacao         Localização (Google Maps / Waze, mapa ilustrado)
  #traje               Dress Code
  #duvidas             Dúvidas (FAQ)
/confirmar             Confirmar presença (redireciona para o convite reconhecido
                       ou explica como usar o link pessoal)
/presentes             Lista de presentes
/presentes/[id]        Presentear
/presentes/retorno     Retorno do Mercado Pago (status confirmado pelo backend)
/galeria               Nossa história em fotos + "Nosso noivado pelos seus olhos"
/mensagens             Livro de mensagens
/privacidade           Aviso de privacidade (LGPD)
/i/[token]             Portal do convidado (link único)
/i/[token]/presenca    Confirmação / alteração de presença
/a/[token]             Álbum colaborativo (QR Code) — câmera e galeria
/admin/...             Painel administrativo
```

Menu (desktop no topo; celular em "Menu"): Início · Nossa História · O Noivado ·
Localização · Dress Code · Presentes · Galeria · Dúvidas, com **CONFIRMAR PRESENÇA** sempre
em destaque. Quando o visitante é reconhecido, aparece também **Meu convite**.

## 7. Modelo de banco (PostgreSQL + Drizzle)

Fonte da verdade: `src/lib/db/schema.ts`. Relações principais:

```
admins 1─* admin_sessions
admins 1─* audit_logs
guest_groups 1─* invitations 1─* guests
invitations 1─* invitation_tokens          (link único; pode ser regenerado/revogado)
invitations 1─* invitation_events          (timeline: envio, acesso, RSVP, presente…)
invitations 1─* rsvps 1─* rsvp_guests      (cada envio é um registro imutável = histórico)
gift_categories 1─* gifts 1─* gift_payments 1─* payment_events
invitations 1─* gift_payments              (opcional: presente anônimo)
invitations 1─* messages                   (origem: rsvp | gift | guestbook)
albums 1─* album_tokens 1─* photos 1─* photo_moderation
invitations 1─* photos                     (opcional, quando enviado pelo portal)
whatsapp_templates, faqs, gallery_photos, story_milestones, schedule_items,
site_settings (chave → JSON validado com zod), media (imagens do admin), rate_limits
```

"Events" do briefing: como o sistema atende a um único evento, os dados do evento ficam em
`site_settings['event']` (tipado), e as demais tabelas não precisam de chave de evento.

Decisões:

- Chaves `uuid` (não sequenciais) em tudo que pode aparecer em URL.
- Tokens de convite: 12 caracteres base62 de `crypto.randomBytes` (~71 bits),
  sem dados pessoais; tokens de álbum: 10 caracteres.
- Nada é apagado fisicamente quando há histórico: presentes, convites e convidados têm
  `archived_at`; pagamentos e eventos são imutáveis.
- Valores em centavos (`integer`).
- Status do convite derivado de colunas desnormalizadas (`sent_at`, `first_accessed_at`,
  `rsvp_status`) para filtros rápidos no funil.

## 8. Portal do Convidado

- `/i/[token]` renderiza o portal diretamente (sem redirecionar), com metadados OG genéricos
  (o Save the Date) — o link encaminhado não revela nomes na prévia do WhatsApp.
- **"Link acessado"** só é registrado por um *beacon* executado no navegador
  (`POST /api/convite/acesso`). Robôs de prévia (WhatsApp, Facebook, Telegram…) não
  executam JavaScript, então não geram acessos falsos. Pré-visualização do admin
  (`?preview=1` com sessão de admin) também não conta.
- O beacon grava um cookie `httpOnly` com o token: as páginas de presentes, álbum e
  mensagens reconhecem o convidado sem pedir nome.
- Blocos: Minha presença · Meu presente · Minha mensagem · O noivado (data, horário,
  local, como chegar, dress code) · Álbum (quando aberto).
- Linguagem: o sistema afirma "o link do convite foi acessado", nunca "Fulano viu".

## 9. Fluxo RSVP

```
Portal → [Confirmar presença] → /i/[token]/presenca
  ├─ lista as pessoas do convite (sem pedir nome)
  ├─ cada pessoa: ESTAREI PRESENTE | NÃO PODEREI COMPARECER
  ├─ acompanhantes (só se permitido; até o máximo configurado; nomes obrigatórios)
  ├─ opcionais configuráveis: restrição alimentar, necessidade especial, observações,
  │   música desejada, mensagem aos noivos
  └─ ENVIAR RESPOSTA
       ├─ valida no servidor (zod + prazo + pessoas pertencem ao convite)
       ├─ grava rsvps + rsvp_guests (novo registro a cada envio → histórico)
       ├─ atualiza guests.attendance e invitations.rsvp_status
       ├─ evento "Presença confirmada" / "Alterou para não comparecer"
       └─ mensagem aos noivos → messages (origem rsvp)
Após o prazo (`rsvp.deadline`): formulário bloqueado com texto gentil e contato dos noivos.
```

## 10. Fluxo WhatsApp

```
Admin › Convites › [WhatsApp]
  → escolhe modelo (padrão por tipo: individual / casal / família / familiares próximos;
    lembrete para quem acessou e não confirmou)
  → PRÉ-VISUALIZAÇÃO: Para, Telefone, Mensagem (editável antes de abrir)
  → [ABRIR NO WHATSAPP]  api.whatsapp.com/send?phone=55…&text=…  (nova aba)
       registra "Convite preparado/aberto no WhatsApp" e marca como Enviado
       (com opção de desfazer)
  → [COPIAR MENSAGEM] / [COPIAR LINK]
Nenhuma mensagem é enviada automaticamente (sem WhatsApp Business API).
Variáveis: {{NOME_CONVIDADO}} {{NOME_GRUPO}} {{LINK_CONVITE}} {{NOME_CASAL}}
{{DATA_EVENTO}} {{HORARIO_EVENTO}} {{LOCAL_EVENTO}} {{ENDERECO_EVENTO}} {{PRAZO_RSVP}}
```

"Envio em sequência": na tela WhatsApp, uma fila percorre convites não enviados (ou
pendentes de lembrete) um a um — abrir, voltar, próximo.

## 11. Fluxo Presentes

```
/presentes (categorias, destaque, "Já fomos presenteados ❤️" quando esgotado)
  → /presentes/[id]
       valor fixo: exibido, não editável
       valor personalizado: "Quanto você gostaria de nos presentear?" + atalhos
                            (R$ 100/200/300/500/Outro) + mínimo/máximo validados
       dados: nome, e-mail, telefone (opcional), mensagem — pré-preenchidos se reconhecido
  → [PRESENTEAR] (server action)
       valida disponibilidade (aprovados + reservas de 30 min < quantidade)
       cria gift_payments (status awaiting) e evento "Presente selecionado"
       cria preferência no Mercado Pago → redireciona ao ambiente seguro do MP
  → /presentes/retorno?ref=…  mostra o status do BANCO (e sincroniza com a API do MP)
```

Disponibilidade: `unique` (1), `limited` (N), `unlimited`. Registros nunca são apagados.

## 12. Arquitetura Mercado Pago

- **Checkout Pro** (hospedado): cartão, Pix e boleto sem dados sensíveis no nosso servidor.
- `POST /checkout/preferences` com `external_reference = gift_payments.id`,
  `X-Idempotency-Key`, `notification_url`, `back_urls`, `expiration_date_to`.
- **Webhook** `POST /api/webhooks/mercadopago`:
  1. valida assinatura `x-signature` (HMAC-SHA256 de `id:…;request-id:…;ts:…;`) com
     `MP_WEBHOOK_SECRET` e janela de tempo;
  2. **nunca confia no corpo**: busca `GET /v1/payments/{id}` com o access token;
  3. confere `external_reference`, valor e moeda;
  4. grava `payment_events` com chave de deduplicação única (idempotência);
  5. atualiza status com transições seguras (aprovado só "volta" por reembolso/estorno
     do mesmo pagamento);
  6. na primeira aprovação: evento no convite + mensagem aos noivos.
- Retorno do navegador **não aprova nada**: a página consulta o banco e, se ainda
  pendente, pede ao backend para sincronizar via `GET /v1/payments/search`.
- Status: Aguardando pagamento · Aprovado · Recusado · Cancelado · Expirado · Reembolsado.
- Guardamos só: ids (interno/MP), valor, status, forma de pagamento, datas. Nada de cartão.
- Sem credenciais, o modo de demonstração (somente fora de produção) simula a aprovação.

## 13. Fluxo do álbum

```
Admin › Álbum › QR Code: gera tokens por local (Mesas, Bar, Entrada…)
  → PNG / SVG / página de impressão (A4 com 4 cartões) / PDF
QR → /a/[token] (sem login)
  → "Registre esse momento conosco." "Queremos ver o nosso noivado pelos seus olhos."
  → [ABRIR CÂMERA]  [ESCOLHER DA GALERIA]
  → prévia → nome opcional (+ autorização para exibir) → SALVAR NO ÁLBUM
  → POST /api/album/[token]/upload
       rate limit por IP, validação de tipo real (sharp), tamanho máximo
       grava ORIGINAL + versão WEB (WebP 1600 px, sem EXIF/GPS) + MINIATURA (WebP 600 px)
       status: pendente (padrão, exige aprovação) ou aprovada (publicação automática)
  → "Foto recebida! ❤️" [TIRAR OUTRA FOTO]
Álbum encerrado: o QR continua funcionando e mostra a galeria.
Admin › Fotos: moderação (pendente/aprovada/oculta/rejeitada), seleção múltipla, ZIP.
```

## 14. Fluxo da câmera

```
[ABRIR CÂMERA]
  ├─ HTTPS + navigator.mediaDevices? ── não ─→ fallback <input capture="environment">
  ├─ getUserMedia({ video: { facingMode: { ideal: "environment" }, 1920×1080 ideal } })
  │     negado/erro ─→ mensagem gentil + fallback
  ├─ visor em tela cheia · obturador · alternar câmera · fechar
  ├─ captura → canvas → JPEG 0,92 (tamanho real do sensor de vídeo)
  ├─ PRÉVIA grande: "Gostou dessa foto?" [TIRAR NOVAMENTE] [SALVAR NO ÁLBUM]
  ├─ envio com barra de progresso; o arquivo só sai do aparelho ao confirmar
  └─ "Foto recebida! ❤️" [TIRAR OUTRA FOTO]
Galeria do aparelho: múltipla seleção, prévia em grade, remover antes de enviar;
HEIC/arquivos enormes são convertidos no próprio navegador (canvas → JPEG).
```

## 15. Estrutura administrativa

```
/admin/login
/admin                Dashboard: funil de convites, presenças, presentes, álbum
/admin/convites       lista com filtros do funil, busca, ações (WhatsApp, copiar, portal,
                      histórico, editar), criar, importar CSV/XLSX, exportar
/admin/convites/[id]  edição do convite + pessoas + timeline + regenerar link
/admin/convidados     pessoas individualmente (presença, restrições)
/admin/rsvp           respostas e histórico de alterações
/admin/presentes      presentes e categorias (+ novo presente)
/admin/pagamentos     pagamentos com filtros (período, status, presente, convidado)
/admin/mensagens      "Mensagens para Maby & Chris" (RSVP, presentes, livro)
/admin/album          configurações do álbum + QR Codes
/admin/fotos          moderação e downloads
/admin/whatsapp       modelos de mensagem + envio em sequência
/admin/faq            perguntas frequentes
/admin/galeria        "Nossa história em fotos" (fotos oficiais)
/admin/configuracoes  evento, abertura, história, programação, dress code, RSVP,
                      presentes, privacidade, contato
/admin/equipe         administradores (owner) · /admin/logs auditoria
```

Permissões: **owner** (tudo, inclusive equipe), **editor** (conteúdo e convidados),
**viewer** (somente leitura). Toda ação de escrita gera `audit_logs`.
