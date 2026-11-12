// Dados de exemplo para conhecer o app: uma casa com quatro moradores,
// contas fixas, dois cartões e duas metas. Tudo relativo ao mês atual.

import { itensDoMes, registrarRenda } from "./calc";
import { novoId, type Backend } from "./dados/backend";
import { addMes } from "./meses";
import {
  dadosVazios,
  type Aporte,
  type Compra,
  type Conta,
  type Dados,
  type Id,
  type Lancamento,
  type Mes,
  type NomeTabela,
  type Perfil,
} from "./types";

const R = (reais: number) => Math.round(reais * 100);
const dia = (mes: Mes, d: number) => `${mes}-${String(d).padStart(2, "0")}`;

export async function semearExemplo(
  backend: Backend,
  perfil: Perfil,
  hoje: string,
): Promise<void> {
  const mes = hoje.slice(0, 7);
  const diaHoje = Number(hoje.slice(8, 10));
  const inicio = addMes(mes, -5);
  const larId = novoId();
  const eu = novoId();

  await backend.criarLar({
    larId,
    moradorId: eu,
    nome: "Nossa casa",
    moradorNome: perfil.nome,
    cor: perfil.cor,
  });

  const cores = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => c !== perfil.cor);
  const [mae, ana, bia] = [novoId(), novoId(), novoId()];
  const d = dadosVazios();
  d.perfis = [perfil];
  d.moradores = [
    { id: eu, larId, nome: perfil.nome, cor: perfil.cor, perfilId: perfil.id, peso: 1, salarioCompartilhado: null },
    { id: mae, larId, nome: "Mãe", cor: cores[3], perfilId: null, peso: 1, salarioCompartilhado: null },
    { id: ana, larId, nome: "Ana", cor: cores[1], perfilId: null, peso: 1, salarioCompartilhado: null },
    { id: bia, larId, nome: "Bia", cor: cores[5], perfilId: null, peso: 1, salarioCompartilhado: null },
  ];

  const base = {
    natureza: "despesa" as const,
    recorrente: true,
    mesInicio: inicio,
    mesFim: null,
    estimada: false,
    moradia: false,
    participantes: null,
  };
  const casa = (
    nome: string,
    valor: number,
    diaVencimento: number,
    categoria: string,
    pagadorId: Id,
    extra: Partial<Conta> = {},
  ): Conta => ({
    ...base,
    id: novoId(),
    perfilId: null,
    larId,
    nome,
    valor: R(valor),
    diaVencimento,
    categoria,
    pagadorId,
    moradia: true,
    ...extra,
  });
  const minha = (
    nome: string,
    valor: number,
    diaVencimento: number,
    categoria: string,
    extra: Partial<Conta> = {},
  ): Conta => ({
    ...base,
    id: novoId(),
    perfilId: perfil.id,
    larId: null,
    nome,
    valor: R(valor),
    diaVencimento,
    categoria,
    pagadorId: null,
    ...extra,
  });

  const emergencia = novoId();
  const sofa = novoId();
  const guardar = novoId();

  d.contas = [
    casa("Aluguel", 2400, 5, "aluguel", eu),
    casa("Mercado", 1600, 8, "mercado", mae, { moradia: false, estimada: true }),
    casa("Condomínio", 790, 10, "condominio", mae),
    casa("Luz", 340, 12, "luz", ana, { estimada: true }),
    casa("Internet", 129.9, 15, "internet", eu, { participantes: { [eu]: 1, [ana]: 1, [bia]: 1 } }),
    casa("Água", 185, 18, "agua", bia, { estimada: true }),
    casa("Gás", 120, 20, "gas", bia),
    minha("Curso de inglês", 280, 5, "educacao", { mesFim: addMes(mes, 4) }),
    { ...minha("Guardar na reserva", 600, 6, "reserva"), id: guardar, metaId: emergencia },
    minha("Academia", 119.9, 8, "saude"),
    minha("Plano de saúde", 420, 10, "saude"),
    minha("Celular", 59.9, 15, "internet"),
    minha("Freela de fim de semana", 800, 20, "renda", {
      natureza: "receita",
      recorrente: false,
      mesInicio: mes,
    }),
  ];

  const principal = novoId();
  const daCasa = novoId();
  d.cartoes = [
    {
      id: principal, perfilId: perfil.id, larId: null, nome: "Platinum", banco: "Banco Aurora",
      cor: 0, limite: R(8000), diaFechamento: 28, diaVencimento: 5,
    },
    {
      id: daCasa, perfilId: perfil.id, larId, nome: "Casa", banco: "Cooperativa Sol",
      cor: 3, limite: R(3000), diaFechamento: 20, diaVencimento: 27,
    },
  ];

  const compra = (
    cartaoId: Id,
    descricao: string,
    valor: number,
    mesPrimeira: Mes,
    extra: Partial<Compra> = {},
  ): Compra => ({
    id: novoId(),
    cartaoId,
    perfilId: perfil.id,
    larId: cartaoId === daCasa ? larId : null,
    descricao,
    valor: R(valor),
    parcelas: 1,
    recorrente: false,
    mesPrimeira,
    mesFim: null,
    data: dia(addMes(mesPrimeira, -1), 14),
    ...extra,
  });
  d.compras = [
    compra(principal, "Notebook", 4800, addMes(mes, -3), { parcelas: 10, categoria: "educacao" }),
    compra(principal, "Passagens de ônibus", 1240, addMes(mes, -1), { parcelas: 4, categoria: "transporte" }),
    compra(principal, "Tênis de corrida", 479.7, mes, { parcelas: 3, categoria: "saude" }),
    compra(principal, "Restaurante", 186.4, mes, { categoria: "lazer" }),
    compra(principal, "Livros", 132.5, mes, { categoria: "educacao" }),
    compra(principal, "Uber", 64.2, mes, { categoria: "transporte" }),
    compra(principal, "Mercado do mês", 312.75, addMes(mes, -1), { categoria: "mercado" }),
    compra(principal, "Streaming de filmes", 39.9, inicio, { recorrente: true, categoria: "assinatura" }),
    compra(principal, "Música", 21.9, inicio, { recorrente: true, categoria: "assinatura" }),
    compra(principal, "Presente de aniversário", 260, addMes(mes, 1), { data: dia(mes, 2), categoria: "familia" }),
    compra(daCasa, "Farmácia", 142.3, mes, { categoria: "saude" }),
    compra(daCasa, "Material de limpeza", 96.8, mes, { categoria: "mercado" }),
    compra(daCasa, "Conserto da geladeira", 540, mes, { parcelas: 2, categoria: "outros" }),
  ];

  d.metas = [
    { id: emergencia, perfilId: perfil.id, larId: null, nome: "Reserva de emergência", alvo: R(20000), cor: 2 },
    { id: sofa, perfilId: null, larId, nome: "Sofá novo", alvo: R(3500), cor: 6 },
  ];
  const aporte = (
    metaId: Id,
    valor: number,
    data: string,
    descricao = "",
    origem: string | null = null,
  ): Aporte => ({
    id: novoId(),
    metaId,
    perfilId: metaId === emergencia ? perfil.id : null,
    larId: metaId === sofa ? larId : null,
    valor: R(valor),
    data,
    descricao,
    origem,
  });

  // Meses passados inteiros pagos; neste mês, só o que já venceu.
  const pago = (mesAlvo: Mes, ateDia: number): Lancamento[] =>
    itensDoMes(d, mesAlvo)
      .filter((i) => i.dia <= ateDia)
      .map((i) => ({
        id: novoId(),
        perfilId: i.escopo === "pessoal" ? i.perfilId : null,
        larId: i.escopo === "casa" ? i.larId : null,
        refTipo: i.refTipo,
        refId: i.refId,
        mes: mesAlvo,
        valor: null,
        pago: true,
        pulado: false,
      }));
  d.lancamentos = [
    ...[-5, -4, -3, -2, -1].flatMap((n) => pago(addMes(mes, n), 31)),
    ...pago(mes, diaHoje - 1),
  ];

  // Cada mês em que "Guardar na reserva" foi paga virou um valor guardado.
  d.aportes = [
    aporte(emergencia, 2000, dia(inicio, 1), "Saldo inicial"),
    ...d.lancamentos
      .filter((l) => l.refId === guardar)
      .map((l) => aporte(emergencia, 600, dia(l.mes, 6), "Guardar na reserva", `conta:${guardar}:${l.mes}`)),
    aporte(sofa, 450, dia(addMes(mes, -2), 10), "Vaquinha da casa"),
    aporte(sofa, 450, dia(addMes(mes, -1), 10), "Vaquinha da casa"),
  ];

  // O salário subiu no mês passado: os meses anteriores mostram o valor antigo.
  await backend.atualizar("perfis", perfil.id, {
    historico: registrarRenda(
      { ...perfil, salario: Math.round(perfil.salario * 0.9), historico: null },
      addMes(mes, -1),
      perfil.salario,
      perfil.orcamentoDiaADia,
    ),
  });

  // Carteiras e gastos do dia a dia, no mês passado e neste (só até hoje).
  const banco = novoId();
  const bolso = novoId();
  d.carteiras = [
    { id: banco, perfilId: perfil.id, nome: "Conta do banco", tipo: "corrente", saldoInicial: R(3200), cor: 0, arquivada: false },
    { id: bolso, perfilId: perfil.id, nome: "Dinheiro", tipo: "dinheiro", saldoInicial: R(150), cor: 5, arquivada: false },
  ];
  const gastos: [number, number, string, string, number, Id][] = [
    // [mês relativo, dia, descrição, categoria, valor, carteira]
    [-1, 2, "Padaria", "alimentacao", 18.5, bolso],
    [-1, 4, "Uber", "transporte", 23.9, banco],
    [-1, 7, "Almoço", "alimentacao", 42, banco],
    [-1, 11, "Farmácia", "saude", 56.3, banco],
    [-1, 15, "iFood", "alimentacao", 61.8, banco],
    [-1, 19, "Cinema", "lazer", 64, banco],
    [-1, 23, "Uber", "transporte", 31.2, banco],
    [-1, 27, "Presente", "compras", 89.9, banco],
    [0, 1, "Padaria", "alimentacao", 16.4, bolso],
    [0, 2, "Uber", "transporte", 27.6, banco],
    [0, 3, "Almoço", "alimentacao", 48, banco],
    [0, 5, "iFood", "alimentacao", 73.5, banco],
    [0, 6, "Livraria", "educacao", 54.9, banco],
    [0, 8, "Uber", "transporte", 19.8, banco],
    [0, 9, "Lanche", "alimentacao", 22, bolso],
    [0, 12, "Farmácia", "saude", 38.7, banco],
    [0, 16, "Almoço", "alimentacao", 45, banco],
    [0, 20, "Cinema", "lazer", 58, banco],
  ];
  d.transacoes = gastos
    .filter(([n, noDia]) => n < 0 || noDia <= diaHoje)
    .map(([n, noDia, descricao, categoria, valor, carteiraId]) => ({
      id: novoId(),
      perfilId: perfil.id,
      data: dia(addMes(mes, n), noDia),
      descricao,
      valor: R(valor),
      tipo: "saida" as const,
      categoria,
      carteiraId,
      carteiraDestinoId: null,
      observacao: "",
    }));
  d.transacoes.push({
    id: novoId(),
    perfilId: perfil.id,
    data: dia(addMes(mes, -1), 28),
    descricao: "Saque para a carteira",
    valor: R(100),
    tipo: "transferencia",
    categoria: "transferencia",
    carteiraId: banco,
    carteiraDestinoId: bolso,
    observacao: "",
  });

  const gravar = async <K extends NomeTabela>(tabela: K, linhas: Dados[K]) => {
    // Em paralelo: o modo GitHub junta tudo numa gravação só (o GitHub limita
    // quantas gravações por minuto aceita); os outros modos fazem uma por vez.
    await Promise.all(linhas.map((linha) => backend.inserir(tabela, linha)));
  };
  await gravar(
    "moradores",
    d.moradores.filter((m) => m.id !== eu),
  );
  await gravar("contas", d.contas);
  await gravar("cartoes", d.cartoes);
  await gravar("compras", d.compras);
  await gravar("metas", d.metas);
  await gravar("aportes", d.aportes);
  await gravar("lancamentos", d.lancamentos);
  await gravar("carteiras", d.carteiras);
  await gravar("transacoes", d.transacoes);
}
