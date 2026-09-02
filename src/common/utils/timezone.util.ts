/**
 * O Brasil (horário de Brasília, BRT) é UTC-3 o ano inteiro desde a extinção
 * do horário de verão em 2019 — por isso um offset fixo aqui é seguro.
 *
 * BUG que isso corrige: `openTime`/`closeTime` da arena são cadastrados pelo
 * dono em horário local (ex: "06:00" = 6h da manhã em Brasília), mas o resto
 * do sistema trabalha 100% em UTC (Postgres armazena `timestamptz`, o
 * frontend manda ISO com 'Z'). Em vários pontos do código (grade de
 * disponibilidade, validação de horário de funcionamento) esse "06:00" era
 * jogado direto em `setUTCHours(6, ...)`, tratando horário de Brasília como
 * se já fosse UTC — isso abre/fecha a arena com 3 horas de diferença do que
 * o dono configurou, e some com essas 3 horas de qualquer comparação com o
 * "agora" real (`new Date()`, que é sempre UTC de verdade).
 */
export const BRAZIL_UTC_OFFSET_HOURS = 3;

/**
 * Recebe uma data de referência (só o dia importa) e um horário "HH:MM" em
 * horário local de Brasília, e retorna o instante UTC correspondente.
 */
export function brazilTimeToUtcDate(reference: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(reference);
  result.setUTCHours(hours + BRAZIL_UTC_OFFSET_HOURS, minutes, 0, 0);
  return result;
}

/** Inverso: pega um instante UTC e devolve a hora/minuto em Brasília, pra exibição. */
export function utcDateToBrazilTimeLabel(date: Date): string {
  const brtHours = ((date.getUTCHours() - BRAZIL_UTC_OFFSET_HOURS) % 24 + 24) % 24;
  const brtMinutes = date.getUTCMinutes();
  return `${String(brtHours).padStart(2, '0')}:${String(brtMinutes).padStart(2, '0')}`;
}

/**
 * ⚠️ USO RESTRITO: só para timestamps vindos do App Atleta (mobile) em rotas
 * como `createAppBooking`.
 *
 * O app mobile envia `startTime`/`endTime` como ISO terminado em "Z"
 * (ex: "2026-08-29T14:00:00.000Z"), mas os dígitos ali representam o
 * horário de Brasília pretendido pelo atleta, não um instante UTC de
 * verdade — ou seja, "14:00:00.000Z" na prática quer dizer "14:00 em
 * Brasília" (que é 17:00 UTC de verdade). Essa é uma convenção conhecida e
 * aceita do app (não vamos mudar o cliente); esta função reinterpreta os
 * dígitos recebidos como horário de Brasília e devolve o instante UTC real
 * correspondente, pra todo o resto do sistema (comparação com `now`,
 * Postgres, webhooks da Asaas) continuar operando em UTC de verdade e sem
 * ambiguidade.
 *
 * NÃO usar isso em timestamps vindos do painel web (`createAdminBooking`),
 * que já manda UTC real via `.toISOString()` de um `Date` de verdade — usar
 * esta função lá deslocaria as reservas do painel em +3h, criando um bug novo.
 */
export function parseAppMobileTimestamp(raw: string): Date {
  const naive = new Date(raw); // lê os dígitos "de cara", ignorando o que o 'Z' afirma
  return new Date(
    Date.UTC(
      naive.getUTCFullYear(),
      naive.getUTCMonth(),
      naive.getUTCDate(),
      naive.getUTCHours() + BRAZIL_UTC_OFFSET_HOURS,
      naive.getUTCMinutes(),
      naive.getUTCSeconds(),
      naive.getUTCMilliseconds(),
    ),
  );
}
