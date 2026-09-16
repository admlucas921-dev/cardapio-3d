export type DayHours = {
  closed: boolean;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
};

export type OpeningHours = Record<string, DayHours>;

export const WEEK_DAYS: { key: string; label: string; short: string }[] = [
  { key: "0", label: "Domingo", short: "Dom" },
  { key: "1", label: "Segunda-feira", short: "Seg" },
  { key: "2", label: "Terça-feira", short: "Ter" },
  { key: "3", label: "Quarta-feira", short: "Qua" },
  { key: "4", label: "Quinta-feira", short: "Qui" },
  { key: "5", label: "Sexta-feira", short: "Sex" },
  { key: "6", label: "Sábado", short: "Sáb" },
];

export function defaultDay(): DayHours {
  return { closed: true, open: "09:00", close: "18:00" };
}

export function normalizeHours(raw: unknown): OpeningHours {
  const source = (raw ?? {}) as Record<string, Partial<DayHours>>;
  const result: OpeningHours = {};
  for (const day of WEEK_DAYS) {
    const entry = source[day.key] ?? {};
    result[day.key] = {
      closed: entry.closed ?? true,
      open: entry.open ?? "09:00",
      close: entry.close ?? "18:00",
    };
  }
  return result;
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Verifica se o estabelecimento está aberto agora (fuso do dispositivo). */
export function isOpenNow(raw: unknown, now: Date = new Date()): boolean {
  const hours = normalizeHours(raw);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = String(now.getDay());
  const yesterdayKey = String((now.getDay() + 6) % 7);

  const today = hours[todayKey];
  if (today && !today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (open !== null && close !== null) {
      if (close > open && minutes >= open && minutes < close) return true;
      // Fecha depois da meia-noite
      if (close <= open && minutes >= open) return true;
    }
  }

  const yesterday = hours[yesterdayKey];
  if (yesterday && !yesterday.closed) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (open !== null && close !== null && close <= open && minutes < close) return true;
  }

  return false;
}

export function hasAnyOpenDay(raw: unknown): boolean {
  const hours = normalizeHours(raw);
  return WEEK_DAYS.some((d) => !hours[d.key]!.closed);
}
