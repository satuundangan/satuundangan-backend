import { DashboardPeriod, jakartaDate } from './admin-dashboard-period';

export interface DashboardInvitationRow {
  id: number | string;
  createdAt: Date | string;
  category?: string | null;
}

export interface DashboardPaymentRow {
  id: number | string;
  invitationId?: number | string | null;
  buyerId?: number | string | null;
  buyerEmail?: string | null;
  amount: number | string;
  status: string;
  purpose?: string;
  paymentMethod?: string | null;
  paymentType?: string | null;
  settlementTime?: Date | string | null;
  createdAt: Date | string;
}

function inWindow(
  value: Date | string | null | undefined,
  start: Date,
  end: Date,
) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return (
    Number.isFinite(time) && time >= start.getTime() && time < end.getTime()
  );
}

export function compareMetric(value: number, previous: number) {
  return {
    value,
    previous,
    delta: value - previous,
    percent:
      previous > 0
        ? Math.round(((value - previous) / previous) * 1000) / 10
        : null,
  };
}

export function aggregateDashboardPeriod(
  invitations: DashboardInvitationRow[],
  payments: DashboardPaymentRow[],
  period: DashboardPeriod,
  previous = false,
) {
  const start = previous ? period.previousStart : period.start;
  const end = previous ? period.previousEffectiveEnd : period.effectiveEnd;
  const metrics = {
    invitationsCreated: 0,
    revenue: 0,
    paidOrders: 0,
    paidInvitations: 0,
    buyers: 0,
    freeActivations: 0,
    pendingOrders: 0,
    aiRevenue: 0,
    aiOrders: 0,
    unverifiedSuccesses: 0,
    averageOrderValue: 0,
  };
  const trend = Array.from({ length: period.days }, (_, i) => {
    const date = jakartaDate(new Date(start.getTime() + i * 86_400_000));
    return {
      date,
      dayLabel: date.slice(5),
      count: 0,
      revenue: 0,
      paidOrders: 0,
    };
  });
  const byDate = new Map(trend.map((day) => [day.date, day]));
  const categories = new Map<string, number>();
  const invitationIds = new Set<string>();
  const buyers = new Set<string>();
  const seenInvitations = new Set<string>();
  const seenPayments = new Set<string>();

  for (const invitation of invitations) {
    const id = String(invitation.id);
    if (seenInvitations.has(id) || !inWindow(invitation.createdAt, start, end))
      continue;
    seenInvitations.add(id);
    metrics.invitationsCreated++;
    const category = invitation.category || 'Lainnya';
    categories.set(category, (categories.get(category) || 0) + 1);
    const day = byDate.get(jakartaDate(new Date(invitation.createdAt)));
    if (day) day.count++;
  }

  for (const payment of payments) {
    const id = String(payment.id);
    if (seenPayments.has(id)) continue;
    seenPayments.add(id);
    if (payment.paymentType === 'simulation') continue;
    const purpose = payment.purpose || 'invitation';
    const createdHere = inWindow(payment.createdAt, start, end);
    if (payment.status === 'pending' && purpose === 'invitation' && createdHere)
      metrics.pendingOrders++;
    if (payment.status !== 'success') continue;

    const amount = Number(payment.amount);
    const validAmount = Number.isFinite(amount) && amount >= 0;
    const settledHere = inWindow(payment.settlementTime, start, end);
    const hasSettlement =
      Boolean(payment.settlementTime) &&
      Number.isFinite(new Date(payment.settlementTime!).getTime());
    const isGateway = payment.paymentMethod === 'midtrans' && hasSettlement;
    const isFree =
      amount === 0 &&
      (payment.paymentType === 'free' ||
        payment.paymentMethod === 'FREE_ACTIVATION');
    if (!validAmount || !hasSettlement || (!isGateway && !isFree)) {
      if (createdHere) metrics.unverifiedSuccesses++;
      continue;
    }
    if (!settledHere) continue;
    if (isFree && purpose === 'invitation') {
      metrics.freeActivations++;
      continue;
    }
    if (!isGateway || amount <= 0) continue;
    if (purpose === 'ai_credits') {
      metrics.aiRevenue += amount;
      metrics.aiOrders++;
      continue;
    }
    if (purpose !== 'invitation') continue;

    metrics.revenue += amount;
    metrics.paidOrders++;
    if (payment.invitationId != null)
      invitationIds.add(String(payment.invitationId));
    if (payment.buyerId != null) buyers.add(`user:${payment.buyerId}`);
    else if (payment.buyerEmail?.trim())
      buyers.add(`email:${payment.buyerEmail.trim().toLowerCase()}`);
    const day = byDate.get(jakartaDate(new Date(payment.settlementTime!)));
    if (day) {
      day.revenue += amount;
      day.paidOrders++;
    }
  }
  metrics.revenue = Math.round(metrics.revenue * 100) / 100;
  metrics.aiRevenue = Math.round(metrics.aiRevenue * 100) / 100;
  metrics.paidInvitations = invitationIds.size;
  metrics.buyers = buyers.size;
  metrics.averageOrderValue = metrics.paidOrders
    ? Math.round((metrics.revenue / metrics.paidOrders) * 100) / 100
    : 0;
  return {
    metrics,
    trend,
    categories: [...categories]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}
