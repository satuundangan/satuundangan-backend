/** Turns the raw reconciliation + payout sources into one prioritised "perlu tindakan" list. */
export interface QueueSourceItem {
  type: string;
  severity?: string;
  paymentId?: number;
  orderId?: string;
  invitationId?: number | null;
  title: string;
  description: string;
  amount?: number;
  customer?: string;
  createdAt?: Date | string | null;
}

export interface ActionItem {
  key: string;
  domain: 'transaksi' | 'undangan' | 'payout';
  type: string;
  priority: 1 | 2 | 3;
  priorityLabel: 'Tinggi' | 'Sedang' | 'Rendah';
  title: string;
  reason: string;
  ageHours: number | null;
  amount: number | null;
  customer: string | null;
  link: string | null;
  linkNote: string | null;
}

const PRIORITY_LABEL = { 1: 'Tinggi', 2: 'Sedang', 3: 'Rendah' } as const;
const TYPE_RULES: Record<string, { domain: ActionItem['domain']; priority: 1 | 2 | 3 }> = {
  SUCCESS_NOT_PUBLISHED: { domain: 'transaksi', priority: 1 },
  PUBLISHED_UNPAID: { domain: 'undangan', priority: 2 },
  COMMISSION_PENDING: { domain: 'transaksi', priority: 2 },
  PENDING_AGING: { domain: 'transaksi', priority: 3 },
};

export function ageInHours(value: Date | string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.round((now.getTime() - time) / 3_600_000)) : null;
}

export function buildActionQueue(
  reconciliation: { items: QueueSourceItem[]; countsByType: Record<string, number> },
  payouts: { count: number; oldestAt: Date | string | null; totalAmount: number },
  now = new Date(),
) {
  const items: ActionItem[] = reconciliation.items.map((item, index) => {
    const rule = TYPE_RULES[item.type] ?? { domain: 'transaksi' as const, priority: 3 as const };
    const link =
      item.type === 'PUBLISHED_UNPAID' && item.invitationId
        ? `/admin/invitations/${item.invitationId}/edit`
        : `/admin/payments?tab=reconciliation&type=${item.type}`;
    return {
      key: `${item.type}:${item.paymentId ?? item.invitationId ?? index}`,
      domain: rule.domain,
      type: item.type,
      priority: rule.priority,
      priorityLabel: PRIORITY_LABEL[rule.priority],
      title: item.title,
      reason: item.description,
      ageHours: ageInHours(item.createdAt, now),
      amount: item.amount ? Number(item.amount) : null,
      customer: item.customer ?? null,
      link,
      linkNote: null,
    };
  });
  if (payouts.count > 0) {
    items.push({
      key: 'WITHDRAW_PENDING',
      domain: 'payout',
      type: 'WITHDRAW_PENDING',
      priority: ageInHours(payouts.oldestAt, now)! >= 72 ? 1 : 2,
      priorityLabel: ageInHours(payouts.oldestAt, now)! >= 72 ? 'Tinggi' : 'Sedang',
      title: `${payouts.count} permintaan penarikan komisi menunggu`,
      reason: 'Permintaan penarikan reseller belum diproses.',
      ageHours: ageInHours(payouts.oldestAt, now),
      amount: payouts.totalAmount,
      customer: null,
      // The payout page is currently redirected to the dashboard (program not active), so no link is offered.
      link: null,
      linkNote: 'Halaman payout belum aktif; proses setelah program reseller diaktifkan.',
    });
  }
  items.sort((a, b) => a.priority - b.priority || (b.ageHours ?? 0) - (a.ageHours ?? 0));
  const counts = reconciliation.countsByType;
  return {
    count: items.length,
    items,
    countsBySource: {
      transaksi: (counts.successNotPublished ?? 0) + (counts.commissionPending ?? 0) + (counts.pendingAging ?? 0),
      undangan: counts.publishedUnpaid ?? 0,
      payout: payouts.count,
    },
    unavailableSources: [
      { source: 'bantuan', reason: 'Fitur bantuan pelanggan belum ada, sehingga belum bisa masuk antrean.' },
    ],
    note: 'Antrean mengambil data dari pusat pembayaran dan tidak mengikuti filter periode. Jenis tertentu dibatasi 50 baris oleh sumbernya.',
  };
}
