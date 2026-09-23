/**
 * Conteúdo inicial (editável no painel). Usado por `npm run db:seed`.
 */

export const seedGiftCategories = [
  {
    slug: 'experiencias',
    name: 'Momentos para a nossa história',
    description: 'Experiências a dois para guardar na memória.',
    icon: 'tacas',
  },
  {
    slug: 'lua-de-mel',
    name: 'Lua de mel',
    description: 'Pequenos pedaços da nossa primeira viagem desta nova fase.',
    icon: 'aviao',
  },
  {
    slug: 'nosso-lar',
    name: 'Nosso novo lar',
    description: 'Para deixar a nossa casa com a nossa cara.',
    icon: 'casa',
  },
  {
    slug: 'humor',
    name: 'Presentes com uma pitada de humor',
    description: 'Porque um relacionamento feliz também é feito de boas risadas.',
    icon: 'sorriso',
  },
] as const

type SeedGift = {
  category: (typeof seedGiftCategories)[number]['slug']
  name: string
  description?: string
  icon: string
  /** Valor em reais. `null` = valor personalizado. */
  price: number | null
  availability?: 'unique' | 'limited' | 'unlimited'
  quantity?: number
  featured?: boolean
}

export const seedGifts: SeedGift[] = [
  // Clássicos — experiências
  { category: 'experiencias', name: 'Jantar romântico para os noivos', description: 'Uma noite só nossa, à luz de velas, para brindar ao que vem por aí.', icon: 'jantar', price: 350, featured: true },
  { category: 'experiencias', name: 'Um brinde à nossa nova fase', description: 'Taças erguidas e um espumante gelado para celebrar o sim.', icon: 'tacas', price: 250 },
  { category: 'experiencias', name: 'Café da manhã especial', description: 'Uma manhã sem pressa, com cheiro de café e pão quentinho.', icon: 'cafe', price: 180 },
  { category: 'experiencias', name: 'Experiência gastronômica', description: 'Um menu degustação para descobrirmos sabores novos juntos.', icon: 'jantar', price: 400 },
  { category: 'experiencias', name: 'Fim de semana dos noivos', description: 'Dois dias longe da rotina, só para nós dois.', icon: 'mala', price: 800, availability: 'limited', quantity: 2 },
  { category: 'experiencias', name: 'Novas memórias para nossa história', description: 'Escolha o valor e nos ajude a colecionar novos momentos.', icon: 'camera', price: null },
  { category: 'experiencias', name: 'Experiência surpresa', description: 'Deixe que a vida (e vocês) nos surpreendam.', icon: 'presente', price: 500 },
  // Clássicos — lua de mel
  { category: 'lua-de-mel', name: 'Uma diária da nossa viagem', description: 'Uma noite a mais no destino dos nossos sonhos.', icon: 'chave', price: 600, availability: 'limited', quantity: 7 },
  { category: 'lua-de-mel', name: 'Passeio especial na lua de mel', description: 'Um passeio para guardar na memória (e no rolo da câmera).', icon: 'mapa', price: 450 },
  { category: 'lua-de-mel', name: 'Jantar na lua de mel', description: 'Uma mesa com vista e um brinde em sua homenagem.', icon: 'jantar', price: 350 },
  { category: 'lua-de-mel', name: 'Upgrade do quarto', description: 'Porque a vista importa — e muito.', icon: 'estrela', price: 700, availability: 'unique' },
  { category: 'lua-de-mel', name: 'Um pedacinho da nossa lua de mel', description: 'Contribua com o valor que o seu coração mandar.', icon: 'aviao', price: null, featured: true },
  // Clássicos — nosso lar
  { category: 'nosso-lar', name: 'Um mimo para nosso novo lar', description: 'Um carinho para a casa onde a nossa história vai morar.', icon: 'casa', price: null },
  { category: 'nosso-lar', name: 'Café para nossa casa', description: 'Para as manhãs e para as visitas — que serão muitas, esperamos.', icon: 'cafe', price: 300, availability: 'unique' },
  { category: 'nosso-lar', name: 'Jogo de taças', description: 'Para todos os brindes que ainda vamos fazer.', icon: 'tacas', price: 280, availability: 'unique' },
  { category: 'nosso-lar', name: 'Jogo de jantar', description: 'Para reunir quem amamos ao redor da nossa mesa.', icon: 'prato', price: 500, availability: 'unique' },
  { category: 'nosso-lar', name: 'Roupa de cama especial', description: 'Lençóis macios para os domingos preguiçosos.', icon: 'lua', price: 400, availability: 'limited', quantity: 2 },
  { category: 'nosso-lar', name: 'Kit de vinhos', description: 'Para abrir em datas especiais — e em terças-feiras comuns também.', icon: 'vinho', price: 350 },
  { category: 'nosso-lar', name: 'Decoração para nossa casa', description: 'Detalhes que transformam uma casa em lar.', icon: 'vaso', price: null },
  // Humor
  { category: 'humor', name: 'Primeira DR oficialmente como noivos', description: 'Ajude a garantir café, sobremesa e diplomacia.', icon: 'cafe', price: 150, featured: true },
  { category: 'humor', name: 'Fundo emergencial para quando ela disser: “Não precisa me dar nada.”', description: 'Todos sabemos que é melhor não arriscar.', icon: 'presente', price: 250 },
  { category: 'humor', name: 'Fundo: “Amor, você decide.”', description: 'Para aquelas decisões em que alguém aparentemente já decidiu.', icon: 'balanca', price: 200 },
  { category: 'humor', name: 'Controle remoto da nova casa', description: 'Um presente simbólico. A posse definitiva ainda está em negociação.', icon: 'chave', price: 300 },
  { category: 'humor', name: 'Primeiro delivery depois de ninguém querer cozinhar', description: 'Um clássico de todo lar feliz.', icon: 'prato', price: 150 },
  { category: 'humor', name: 'Fundo para sobrevivência pós-festa', description: 'Água, café e silêncio no dia seguinte.', icon: 'lua', price: 180 },
  { category: 'humor', name: 'Fundo: “Eu avisei.”', description: 'Será usado com moderação. Ou não.', icon: 'estrela', price: 200 },
  { category: 'humor', name: 'Fundo da primeira compra: “Só fomos olhar.”', description: 'Todos sabemos como essa história termina.', icon: 'presente', price: 500 },
  { category: 'humor', name: 'Taxa oficial para ela escolher a decoração', description: 'Ele poderá emitir opiniões. A aprovação segue outro fluxo.', icon: 'vaso', price: 350 },
  { category: 'humor', name: 'Fundo para ele fingir que entendeu a decoração', description: 'Um investimento em harmonia conjugal.', icon: 'casa', price: 250 },
  { category: 'humor', name: 'Assinatura vitalícia: “Sim, amor.”', description: 'Renovação automática, sem multa por fidelidade.', icon: 'coracao', price: 300 },
  { category: 'humor', name: 'Primeiro café depois de uma discussão', description: 'Porque tudo fica melhor depois de um café.', icon: 'cafe', price: 100 },
  { category: 'humor', name: 'Jantar para resolver quem estava certo', description: 'Spoiler: ninguém vai admitir.', icon: 'balanca', price: 350 },
  { category: 'humor', name: 'Fundo: “O que você quer comer?”', description: 'Investimento para as próximas centenas de vezes que essa pergunta será feita.', icon: 'jantar', price: 200 },
  { category: 'humor', name: 'Vale paciência premium', description: 'Quantidade limitada e alta procura.', icon: 'estrela', price: 300, availability: 'limited', quantity: 3 },
  { category: 'humor', name: 'Contribuição para o primeiro: “Você não vai colocar isso aí, né?”', description: 'Escolha o valor da negociação.', icon: 'vaso', price: null },
  { category: 'humor', name: 'Fundo para futuras compras por impulso', description: 'Porque o “só fomos olhar” vai acontecer de novo.', icon: 'presente', price: null },
  { category: 'humor', name: 'Fundo secreto do casal', description: 'O destino é segredo. A gratidão, não.', icon: 'chave', price: null },
  { category: 'humor', name: 'Ajude os noivos a manterem a paz', description: 'Toda contribuição para a diplomacia é bem-vinda.', icon: 'coracao', price: null },
]

export const seedSchedule = [
  { timeLabel: '19h30', title: 'Recepção dos convidados', description: 'Chegue com calma: o casarão estará de portas abertas para você.' },
  { timeLabel: '20h00', title: 'Um momento especial', description: 'O brinde que dá início a este novo capítulo.' },
  { timeLabel: '20h30', title: 'Jantar e celebração', description: null },
  { timeLabel: '22h00', title: 'Festa', description: 'Pista aberta até quando a alegria permitir.' },
]

export const seedStory = [
  { dateLabel: 'O começo', title: 'Nos encontramos', text: 'Um encontro que parecia simples — e mudou tudo.' },
  { dateLabel: 'Os anos', title: 'Construímos nossa história', text: 'Entre viagens, rotinas e sonhos, aprendemos a ser casa um do outro.' },
  { dateLabel: 'O pedido', title: 'Escolhemos continuar caminhando juntos', text: 'Um sim que já morava em nós dois.' },
  { dateLabel: '31 . 10 . 2026', title: 'E agora, o noivado', text: 'Queremos celebrar esse novo capítulo ao lado de pessoas especiais.' },
]

export const seedFaqs = [
  { question: 'Qual o horário?', answer: 'A recepção começa às {{HORARIO_EVENTO}} do dia {{DATA_EVENTO}}. Chegue com tranquilidade — a programação completa está na seção O Noivado.' },
  { question: 'Onde será?', answer: 'Na {{LOCAL_EVENTO}}, {{ENDERECO_EVENTO}}. Na seção Localização você encontra os atalhos para o Google Maps e o Waze.' },
  { question: 'Há estacionamento?', answer: 'As orientações sobre estacionamento e acesso ao casarão estão na seção O Noivado.' },
  { question: 'Qual o traje?', answer: 'Esporte fino. Na seção Dress Code você encontra a paleta de cores sugerida e algumas recomendações.' },
  { question: 'Posso levar acompanhante?', answer: 'Seu convite mostra exatamente quem está convidado. Quando houver acompanhante, o espaço para informar o nome aparecerá na confirmação de presença.' },
  { question: 'Crianças são convidadas?', answer: 'Os nomes que aparecem no seu convite são os das pessoas convidadas. Se tiver qualquer dúvida, fale com a gente.' },
  { question: 'Até quando posso confirmar?', answer: 'Até {{PRAZO_RSVP}}, pelo seu link pessoal. Assim conseguimos preparar tudo com carinho.' },
  { question: 'Como funciona a lista de presentes?', answer: 'Cada ideia da lista é uma contribuição simbólica, paga de forma segura pelo Mercado Pago (Pix, cartão ou boleto). Assim que o pagamento é confirmado, o presente aparece no seu convite.' },
  { question: 'Posso alterar minha confirmação?', answer: 'Sim! Volte ao seu link pessoal até {{PRAZO_RSVP}} e toque em “Alterar confirmação”.' },
]

export const seedWhatsappTemplates = [
  {
    kind: 'invite_individual' as const,
    name: 'Convite individual',
    body: `Olá, {{NOME_CONVIDADO}}! ❤️

É com muita alegria que queremos dividir com você um momento muito especial das nossas vidas.

Nosso noivado acontecerá no dia {{DATA_EVENTO}}, na {{LOCAL_EVENTO}}.

Criamos um convite especial para você:
{{LINK_CONVITE}}

Esperamos você!

{{NOME_CASAL}}`,
  },
  {
    kind: 'invite_couple' as const,
    name: 'Convite casal',
    body: `Olá, {{NOME_CONVIDADO}}! ❤️

É com muita alegria que queremos dividir com vocês um momento muito especial das nossas vidas.

Nosso noivado acontecerá no dia {{DATA_EVENTO}}, às {{HORARIO_EVENTO}}, na {{LOCAL_EVENTO}}.

Preparamos um convite especial para vocês dois:
{{LINK_CONVITE}}

Esperamos vocês!

{{NOME_CASAL}}`,
  },
  {
    kind: 'invite_family' as const,
    name: 'Convite família',
    body: `Olá, {{NOME_CONVIDADO}}! ❤️

Queremos muito a {{NOME_GRUPO}} ao nosso lado em um dia tão especial.

Nosso noivado acontecerá no dia {{DATA_EVENTO}}, às {{HORARIO_EVENTO}}, na {{LOCAL_EVENTO}}.

No convite abaixo vocês podem confirmar a presença de cada um:
{{LINK_CONVITE}}

Com carinho,
{{NOME_CASAL}}`,
  },
  {
    kind: 'invite_close_family' as const,
    name: 'Familiares próximos',
    body: `{{NOME_CONVIDADO}}, ❤️

Vocês fazem parte da nossa história desde o começo — e não poderíamos viver este momento sem vocês.

Nosso noivado será no dia {{DATA_EVENTO}}, às {{HORARIO_EVENTO}}, na {{LOCAL_EVENTO}}.

Preparamos este convite com todo o nosso carinho:
{{LINK_CONVITE}}

Amamos vocês!
{{NOME_CASAL}}`,
  },
  {
    kind: 'rsvp_reminder' as const,
    name: 'Lembrete RSVP',
    body: `Olá, {{NOME_CONVIDADO}}! ❤️

Passando para lembrar da confirmação do nosso noivado.

Seu convite já foi acessado, mas sua confirmação ainda está pendente.

Quando puder, confirme por aqui:
{{LINK_CONVITE}}

Estamos preparando tudo com muito carinho e esperamos poder celebrar com você.

{{NOME_CASAL}}`,
  },
  {
    kind: 'thanks_after_rsvp' as const,
    name: 'Agradecimento após confirmação',
    body: `{{NOME_CONVIDADO}}, recebemos a sua confirmação! ❤️

Obrigado por fazer parte deste momento. Nos vemos no dia {{DATA_EVENTO}}, às {{HORARIO_EVENTO}}, na {{LOCAL_EVENTO}}.

Seu convite continua disponível aqui:
{{LINK_CONVITE}}

{{NOME_CASAL}}`,
  },
  {
    kind: 'final_reminder' as const,
    name: 'Lembrete final',
    body: `{{NOME_CONVIDADO}}, está chegando! ✨

Nosso noivado é no dia {{DATA_EVENTO}}, às {{HORARIO_EVENTO}}.
Local: {{LOCAL_EVENTO}} — {{ENDERECO_EVENTO}}

Todos os detalhes (e como chegar) estão no seu convite:
{{LINK_CONVITE}}

Até lá!
{{NOME_CASAL}}`,
  },
]

export const seedAlbum = {
  name: 'Álbum do Noivado',
  description: 'Queremos ver o nosso noivado pelos seus olhos.',
  closedMessage:
    'Nosso álbum já foi encerrado para novos registros, mas você ainda pode conferir as fotos desse dia especial.',
}

/** Convites de demonstração (somente com `npm run db:seed -- --demo`). */
export const demoInvitations = [
  {
    label: 'Família Silva',
    kind: 'family' as const,
    phone: '98999990001',
    guests: [
      { firstName: 'João', lastName: 'Silva' },
      { firstName: 'Maria', lastName: 'Silva' },
      { firstName: 'Pedro', lastName: 'Silva' },
    ],
  },
  {
    label: 'Ana e Lucas',
    kind: 'couple' as const,
    phone: '98999990002',
    guests: [
      { firstName: 'Ana', lastName: 'Costa' },
      { firstName: 'Lucas', lastName: 'Pereira' },
    ],
  },
  {
    label: 'Beatriz Almeida',
    kind: 'individual' as const,
    phone: '98999990003',
    allowCompanions: true,
    maxCompanions: 1,
    guests: [{ firstName: 'Beatriz', lastName: 'Almeida' }],
  },
]
