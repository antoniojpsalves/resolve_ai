import { OccurrenceStatus, Priority, PrismaClient } from '@prisma/client';

import { buildOccurrenceCode } from '../src/modules/occurrence/domain/protocol';
import { hashPassword } from '../src/modules/identity/infra/password';

/**
 * Seed determinístico: mesma execução -> mesmos dados de negócio.
 *
 * Duas exceções inerentes à natureza das ferramentas usadas (documentadas
 * também no relatório da Tarefa 2):
 *  - `passwordHash` (bcrypt) embute um salt aleatório gerado pela própria
 *    lib a cada chamada; o valor do hash muda a cada execução, mas a senha
 *    em texto plano ("Senha@123") continua válida em ambas (verifyPassword
 *    sempre retorna true). Não é possível fixar o salt sem alterar o
 *    contrato de `password.ts` compartilhado com a Tarefa 3.
 *  - Os `id` (cuid()) são gerados pelo Prisma a cada inserção e não são
 *    determináveis pelo PRNG local; como as tabelas são limpas e
 *    recriadas do zero a cada rodada, isso não afeta a igualdade dos
 *    dados de negócio (nomes, e-mails, contagens, status, datas, codes).
 */

const prisma = new PrismaClient();

const SEED_NOW = new Date('2026-09-01T12:00:00.000Z');

// --- PRNG determinístico (mulberry32) ---------------------------------
function mulberry32(seed: number) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260901);

function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[rngInt(0, items.length - 1)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rngInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Avança a partir de `prev` alguns dias, sem nunca ultrapassar SEED_NOW. */
function nextDate(prev: Date, minDays: number, maxDays: number): Date {
  const candidate = addDays(prev, rngInt(minDays, maxDays));
  const capped = new Date(Math.min(candidate.getTime(), SEED_NOW.getTime() - 1000));
  return capped.getTime() <= prev.getTime() ? new Date(prev.getTime() + 1000) : capped;
}

// --- Conteúdo de apoio ---------------------------------------------------

const LOCATION_LABELS = [
  'Bloco A, térreo',
  'Bloco B, garagem -1',
  'Bloco B, garagem -2',
  'Bloco C, hall de entrada',
  'Torre A, 3º andar',
  'Torre A, 7º andar',
  'Torre B, 10º andar',
  'Torre B, cobertura',
  'Área da piscina',
  'Salão de festas',
  'Portaria principal',
  'Playground',
  'Academia',
  'Corredor do 5º andar, Torre B',
  'Estacionamento de visitantes',
  'Salão de jogos',
];

const PRIORITY_POOL: Priority[] = [
  Priority.BAIXA,
  Priority.BAIXA,
  Priority.MEDIA,
  Priority.MEDIA,
  Priority.MEDIA,
  Priority.ALTA,
  Priority.ALTA,
  Priority.URGENTE,
];

type ContentTemplate = { title: string; description: string };

const CONTENT_BY_CATEGORY: Record<string, ContentTemplate[]> = {
  eletrica: [
    {
      title: 'Lâmpada queimada no corredor',
      description:
        'A lâmpada do corredor está queimada há alguns dias, deixando o ambiente escuro à noite.',
    },
    {
      title: 'Tomada sem energia no salão de festas',
      description:
        'Nenhuma tomada do salão de festas está funcionando, dificultando o uso de equipamentos.',
    },
    {
      title: 'Quadro de disjuntores desarmando sozinho',
      description:
        'O disjuntor geral do bloco tem desarmado sozinho diversas vezes na última semana.',
    },
  ],
  hidraulica: [
    {
      title: 'Vazamento na tubulação da garagem',
      description:
        'Há um vazamento visível na tubulação do teto da garagem, formando poças de água.',
    },
    {
      title: 'Torneira com vazamento constante',
      description: 'A torneira da área comum está pingando continuamente, desperdiçando água.',
    },
    {
      title: 'Entupimento no ralo do corredor',
      description: 'O ralo do corredor está entupido e a água não escoa corretamente após a chuva.',
    },
  ],
  limpeza: [
    {
      title: 'Lixo acumulado na lixeira comum',
      description:
        'O lixo não está sendo recolhido com a frequência adequada e está se acumulando.',
    },
    {
      title: 'Corredor sujo após obra',
      description:
        'Restos de material de obra ficaram espalhados pelo corredor e não foram limpos.',
    },
    {
      title: 'Vidros da portaria sujos',
      description: 'Os vidros da portaria estão manchados e prejudicam a visibilidade.',
    },
  ],
  seguranca: [
    {
      title: 'Câmera de segurança fora do ar',
      description:
        'A câmera do estacionamento aparenta estar desligada há dias, sem gravar imagens.',
    },
    {
      title: 'Portão da garagem não fecha corretamente',
      description: 'O portão da garagem trava aberto às vezes, permitindo acesso indevido.',
    },
    {
      title: 'Interfone da portaria com falha',
      description:
        'O interfone não está transmitindo o áudio corretamente, dificultando a autorização de visitantes.',
    },
  ],
  elevadores: [
    {
      title: 'Elevador social com ruído estranho',
      description: 'O elevador social da Torre A está fazendo um ruído incomum durante o trajeto.',
    },
    {
      title: 'Elevador de serviço parado',
      description: 'O elevador de serviço está parado no térreo e não atende chamadas.',
    },
    {
      title: 'Porta do elevador demorando para fechar',
      description: 'A porta do elevador demora muito além do normal para fechar, atrasando o uso.',
    },
  ],
  'areas-comuns': [
    {
      title: 'Banco quebrado na área de lazer',
      description:
        'Um dos bancos da área de lazer está com a estrutura quebrada, oferecendo risco.',
    },
    {
      title: 'Churrasqueira com defeito',
      description: 'A churrasqueira da área gourmet não está acendendo corretamente.',
    },
    {
      title: 'Piso solto no salão de jogos',
      description:
        'Algumas peças do piso do salão de jogos estão soltas, representando risco de queda.',
    },
  ],
  jardinagem: [
    {
      title: 'Grama alta no jardim frontal',
      description: 'A grama do jardim frontal não é cortada há semanas e está muito alta.',
    },
    {
      title: 'Árvore com galhos caídos',
      description: 'Uma árvore próxima ao playground derrubou galhos após o vento forte.',
    },
    {
      title: 'Sistema de irrigação não liga',
      description: 'O sistema de irrigação automática do jardim parou de funcionar.',
    },
  ],
  infraestrutura: [
    {
      title: 'Rachadura na parede da garagem',
      description:
        'Foi identificada uma rachadura na parede da garagem que parece estar aumentando.',
    },
    {
      title: 'Infiltração no teto do subsolo',
      description: 'Há sinais de infiltração no teto do subsolo, com manchas de umidade.',
    },
    {
      title: 'Piso da calçada interna danificado',
      description: 'O piso da calçada interna está com placas soltas e desniveladas.',
    },
  ],
};

const NOTE_EM_ANALISE = [
  'Ocorrência em análise pela equipe responsável.',
  'Chamado avaliado pela administração, aguardando definição da equipe técnica.',
];

const NOTE_EM_ATENDIMENTO = [
  'Equipe de manutenção acionada para atendimento.',
  'Prestador de serviço agendado para realizar o reparo.',
];

const NOTE_RESOLUCAO = [
  'Equipe técnica realizou o reparo e testou o funcionamento.',
  'Serviço concluído e item verificado pela administração.',
  'Reparo finalizado; situação normalizada.',
];

const NOTE_CANCELAMENTO = [
  'Ocorrência cancelada: item já havia sido resolvido internamente.',
  'Cancelada a pedido do solicitante, chamado duplicado.',
  'Cancelada pela administração: fora do escopo de manutenção do condomínio.',
];

const COMMENT_POOL = [
  'Obrigado pelo retorno, aguardando a solução.',
  'Podem confirmar o prazo para o atendimento?',
  'Já faz alguns dias, alguma novidade?',
  'Equipe já foi acionada, aguardem contato.',
  'Assim que possível vamos verificar e retornar.',
  'Ainda está pendente, por favor verifiquem quando puderem.',
  'Confirmando que o problema persiste no mesmo local.',
  'Vamos agendar uma vistoria para os próximos dias.',
];

const RATING_COMMENT_POOL = [
  'Atendimento rápido e eficiente.',
  'Ficou tudo certo, obrigado!',
  'Poderia ter sido mais rápido, mas resolveram bem.',
  'Excelente serviço, equipe muito atenciosa.',
  null,
  null,
];

const CATEGORY_SEED = [
  { name: 'Elétrica', slug: 'eletrica' },
  { name: 'Hidráulica', slug: 'hidraulica' },
  { name: 'Limpeza', slug: 'limpeza' },
  { name: 'Segurança', slug: 'seguranca' },
  { name: 'Elevadores', slug: 'elevadores' },
  { name: 'Áreas Comuns', slug: 'areas-comuns' },
  { name: 'Jardinagem', slug: 'jardinagem' },
  { name: 'Infraestrutura', slug: 'infraestrutura' },
];

// Distribuição alvo (soma = 25), embaralhada de forma determinística.
const STATUS_PLAN: OccurrenceStatus[] = shuffle([
  ...Array(5).fill(OccurrenceStatus.ABERTA),
  ...Array(4).fill(OccurrenceStatus.EM_ANALISE),
  ...Array(5).fill(OccurrenceStatus.EM_ATENDIMENTO),
  ...Array(9).fill(OccurrenceStatus.RESOLVIDA),
  ...Array(2).fill(OccurrenceStatus.CANCELADA),
]);

// Para as 2 CANCELADA, varia o ponto de cancelamento (direto de ABERTA / a
// partir de EM_ANALISE) para que o histórico não fique repetitivo.
let cancelVariant = 0;

type HistoryDraft = {
  fromStatus: OccurrenceStatus | null;
  toStatus: OccurrenceStatus;
  note: string | null;
  changedById: string;
  createdAt: Date;
};

type OccurrenceDraft = {
  title: string;
  description: string;
  status: OccurrenceStatus;
  priority: Priority;
  categorySlug: string;
  locationLabel: string;
  createdById: string;
  assignedToId: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  history: HistoryDraft[];
};

async function main() {
  // Limpeza idempotente, respeitando a ordem de FK.
  await prisma.rating.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.occurrence.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // --- Usuários ---------------------------------------------------------
  const sharedPasswordHash = await hashPassword('Senha@123');

  const gestor1 = await prisma.user.create({
    data: {
      name: 'Marcos Oliveira',
      email: 'gestor1@resolveai.com',
      passwordHash: sharedPasswordHash,
      role: 'GESTOR',
    },
  });
  const gestor2 = await prisma.user.create({
    data: {
      name: 'Fernanda Souza',
      email: 'gestor2@resolveai.com',
      passwordHash: sharedPasswordHash,
      role: 'GESTOR',
    },
  });

  const ana = await prisma.user.create({
    data: {
      name: 'Ana Paula Ribeiro',
      email: 'ana@resolveai.com',
      passwordHash: sharedPasswordHash,
      role: 'SOLICITANTE',
    },
  });
  const bruno = await prisma.user.create({
    data: {
      name: 'Bruno Costa',
      email: 'bruno@resolveai.com',
      passwordHash: sharedPasswordHash,
      role: 'SOLICITANTE',
    },
  });
  const carla = await prisma.user.create({
    data: {
      name: 'Carla Mendes',
      email: 'carla@resolveai.com',
      passwordHash: sharedPasswordHash,
      role: 'SOLICITANTE',
    },
  });

  const gestores = [gestor1, gestor2];
  const solicitantes = [ana, bruno, carla];

  // --- Categorias ---------------------------------------------------------
  const categories = new Map<string, { id: string }>();
  for (const c of CATEGORY_SEED) {
    const category = await prisma.category.create({
      data: { name: c.name, slug: c.slug, active: true },
    });
    categories.set(c.slug, category);
  }
  const categorySlugs = CATEGORY_SEED.map((c) => c.slug);

  // --- Rascunho das 25 ocorrências (sem code, atribuído após ordenar) ----
  const drafts: OccurrenceDraft[] = STATUS_PLAN.map((status) => {
    const categorySlug = pick(categorySlugs);
    const content = pick(CONTENT_BY_CATEGORY[categorySlug]);
    const createdById = pick(solicitantes).id;
    const priority = pick(PRIORITY_POOL);
    const locationLabel = pick(LOCATION_LABELS);

    let daysAgoRange: [number, number];
    switch (status) {
      case OccurrenceStatus.ABERTA:
        daysAgoRange = [1, 20];
        break;
      case OccurrenceStatus.EM_ANALISE:
        daysAgoRange = [5, 40];
        break;
      case OccurrenceStatus.EM_ATENDIMENTO:
        daysAgoRange = [10, 60];
        break;
      case OccurrenceStatus.RESOLVIDA:
        daysAgoRange = [20, 90];
        break;
      case OccurrenceStatus.CANCELADA:
      default:
        daysAgoRange = [5, 50];
        break;
    }
    const daysAgo = rngInt(daysAgoRange[0], daysAgoRange[1]);
    const createdAt = addDays(SEED_NOW, -daysAgo);

    const history: HistoryDraft[] = [
      {
        fromStatus: null,
        toStatus: OccurrenceStatus.ABERTA,
        note: null,
        changedById: createdById,
        createdAt,
      },
    ];

    let assignedToId: string | null = null;
    let resolutionNote: string | null = null;
    let resolvedAt: Date | null = null;

    if (status === OccurrenceStatus.EM_ANALISE) {
      const analiseDate = nextDate(createdAt, 1, 6);
      history.push({
        fromStatus: OccurrenceStatus.ABERTA,
        toStatus: OccurrenceStatus.EM_ANALISE,
        note: pick(NOTE_EM_ANALISE),
        changedById: pick(gestores).id,
        createdAt: analiseDate,
      });
    }

    if (status === OccurrenceStatus.EM_ATENDIMENTO || status === OccurrenceStatus.RESOLVIDA) {
      const analiseDate = nextDate(createdAt, 1, 6);
      history.push({
        fromStatus: OccurrenceStatus.ABERTA,
        toStatus: OccurrenceStatus.EM_ANALISE,
        note: pick(NOTE_EM_ANALISE),
        changedById: pick(gestores).id,
        createdAt: analiseDate,
      });

      const atendimentoResponsible = pick(gestores);
      assignedToId = atendimentoResponsible.id;
      const atendimentoDate = nextDate(analiseDate, 1, 6);
      history.push({
        fromStatus: OccurrenceStatus.EM_ANALISE,
        toStatus: OccurrenceStatus.EM_ATENDIMENTO,
        note: pick(NOTE_EM_ATENDIMENTO),
        changedById: atendimentoResponsible.id,
        createdAt: atendimentoDate,
      });

      if (status === OccurrenceStatus.RESOLVIDA) {
        const resolvidaDate = nextDate(atendimentoDate, 1, 6);
        resolutionNote = pick(NOTE_RESOLUCAO);
        resolvedAt = resolvidaDate;
        history.push({
          fromStatus: OccurrenceStatus.EM_ATENDIMENTO,
          toStatus: OccurrenceStatus.RESOLVIDA,
          note: resolutionNote,
          changedById: atendimentoResponsible.id,
          createdAt: resolvidaDate,
        });
      }
    }

    if (status === OccurrenceStatus.CANCELADA) {
      const variant = cancelVariant % 2;
      cancelVariant += 1;

      if (variant === 0) {
        // Cancela direto de ABERTA.
        const cancelDate = nextDate(createdAt, 1, 6);
        history.push({
          fromStatus: OccurrenceStatus.ABERTA,
          toStatus: OccurrenceStatus.CANCELADA,
          note: pick(NOTE_CANCELAMENTO),
          changedById: pick(gestores).id,
          createdAt: cancelDate,
        });
      } else {
        // Passa por EM_ANALISE antes de cancelar.
        const analiseDate = nextDate(createdAt, 1, 6);
        history.push({
          fromStatus: OccurrenceStatus.ABERTA,
          toStatus: OccurrenceStatus.EM_ANALISE,
          note: pick(NOTE_EM_ANALISE),
          changedById: pick(gestores).id,
          createdAt: analiseDate,
        });
        const cancelDate = nextDate(analiseDate, 1, 6);
        history.push({
          fromStatus: OccurrenceStatus.EM_ANALISE,
          toStatus: OccurrenceStatus.CANCELADA,
          note: pick(NOTE_CANCELAMENTO),
          changedById: pick(gestores).id,
          createdAt: cancelDate,
        });
      }
    }

    return {
      title: content.title,
      description: content.description,
      status,
      priority,
      categorySlug,
      locationLabel,
      createdById,
      assignedToId,
      resolutionNote,
      resolvedAt,
      createdAt,
      history,
    };
  });

  // Ordena por data de criação para que o código do protocolo cresça no
  // tempo, como aconteceria em produção.
  drafts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const createdOccurrences: {
    id: string;
    status: OccurrenceStatus;
    resolvedAt: Date | null;
    createdAt: Date;
    createdById: string;
  }[] = [];

  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    const sequence = i + 1;
    const code = buildOccurrenceCode(draft.createdAt.getUTCFullYear(), sequence);
    const category = categories.get(draft.categorySlug);
    if (!category) {
      throw new Error(`Categoria não encontrada para slug ${draft.categorySlug}`);
    }

    const occurrence = await prisma.occurrence.create({
      data: {
        code,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        categoryId: category.id,
        locationLabel: draft.locationLabel,
        createdById: draft.createdById,
        assignedToId: draft.assignedToId,
        resolutionNote: draft.resolutionNote,
        resolvedAt: draft.resolvedAt,
        createdAt: draft.createdAt,
        history: {
          create: draft.history.map((h) => ({
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            note: h.note,
            changedById: h.changedById,
            createdAt: h.createdAt,
          })),
        },
      },
    });

    createdOccurrences.push({
      id: occurrence.id,
      status: occurrence.status,
      resolvedAt: occurrence.resolvedAt,
      createdAt: occurrence.createdAt,
      createdById: occurrence.createdById,
    });
  }

  // --- Comentários: 1 a 3 em ~metade das ocorrências ----------------------
  for (const occurrence of createdOccurrences) {
    if (rng() >= 0.5) continue;

    const count = rngInt(1, 3);
    let lastDate = occurrence.createdAt;
    for (let i = 0; i < count; i += 1) {
      const authorId = rng() < 0.5 ? occurrence.createdById : pick(gestores).id;
      lastDate = nextDate(lastDate, 1, 4);
      await prisma.comment.create({
        data: {
          occurrenceId: occurrence.id,
          authorId,
          body: pick(COMMENT_POOL),
          createdAt: lastDate,
        },
      });
    }
  }

  // --- Avaliações: ~6 das RESOLVIDA ---------------------------------------
  const resolved = createdOccurrences.filter((o) => o.status === OccurrenceStatus.RESOLVIDA);
  const ratedOccurrences = shuffle(resolved).slice(0, Math.min(6, resolved.length));
  for (const occurrence of ratedOccurrences) {
    const baseDate = occurrence.resolvedAt ?? occurrence.createdAt;
    await prisma.rating.create({
      data: {
        occurrenceId: occurrence.id,
        score: rngInt(3, 5),
        comment: pick(RATING_COMMENT_POOL),
        createdAt: nextDate(baseDate, 1, 3),
      },
    });
  }

  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const occurrenceCount = await prisma.occurrence.count();
  const commentCount = await prisma.comment.count();
  const ratingCount = await prisma.rating.count();
  const historyCount = await prisma.statusHistory.count();

  console.log('Seed concluído:');
  console.log(`  usuários: ${userCount}`);
  console.log(`  categorias: ${categoryCount}`);
  console.log(`  ocorrências: ${occurrenceCount}`);
  console.log(`  comentários: ${commentCount}`);
  console.log(`  avaliações: ${ratingCount}`);
  console.log(`  entradas de histórico: ${historyCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
