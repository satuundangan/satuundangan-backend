import { BadRequestException } from '@nestjs/common';

const DAY = 86_400_000;
const WIB = 7 * 60 * 60 * 1000;

export function jakartaDate(value: Date): string {
  return new Date(value.getTime() + WIB).toISOString().slice(0, 10);
}

function midnight(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Tanggal harus memakai format YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(parsed.getTime()) || jakartaDate(parsed) !== value) {
    throw new BadRequestException('Tanggal tidak valid.');
  }
  return parsed;
}

export function resolveDashboardPeriod(
  query: { days?: number; startDate?: string; endDate?: string } = {},
  now = new Date(),
) {
  const today = jakartaDate(now);
  const days = Number(query.days ?? 7);
  if (![7, 30, 90].includes(days)) {
    throw new BadRequestException(
      'Pilihan periode adalah 7, 30, atau 90 hari.',
    );
  }
  if (Boolean(query.startDate) !== Boolean(query.endDate)) {
    throw new BadRequestException(
      'Tanggal awal dan akhir wajib diisi bersama.',
    );
  }
  const endDate = query.endDate || today;
  const lastDay = midnight(endDate);
  const startDate =
    query.startDate ||
    jakartaDate(new Date(lastDay.getTime() - (days - 1) * DAY));
  const start = midnight(startDate);
  const end = new Date(lastDay.getTime() + DAY);
  const dayCount = Math.round((end.getTime() - start.getTime()) / DAY);
  if (dayCount < 1 || dayCount > 366 || endDate > today) {
    throw new BadRequestException(
      'Periode harus berurutan, maksimal 366 hari, dan tidak melewati hari ini.',
    );
  }
  const effectiveEnd = new Date(Math.min(end.getTime(), now.getTime()));
  const previousStart = new Date(start.getTime() - dayCount * DAY);
  const previousEnd = new Date(start);
  const previousEffectiveEnd = new Date(
    previousStart.getTime() + effectiveEnd.getTime() - start.getTime(),
  );
  return {
    startDate,
    endDate,
    start,
    end,
    effectiveEnd,
    previousStart,
    previousEnd,
    previousEffectiveEnd,
    previousStartDate: jakartaDate(previousStart),
    previousEndDate: jakartaDate(new Date(previousEnd.getTime() - DAY)),
    days: dayCount,
    timezone: 'Asia/Jakarta',
    includesToday: endDate === today,
    asOf: now.toISOString(),
  };
}

export type DashboardPeriod = ReturnType<typeof resolveDashboardPeriod>;
