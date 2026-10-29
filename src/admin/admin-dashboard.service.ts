import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitation } from '../invitation/invitation.entity';
import { Payment } from '../payment/payment.entity';
import { User } from '../user/user.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { AffiliateProfile } from '../affiliate/entities/affiliate-profile.entity';
import { WithdrawRequest } from '../affiliate/entities/withdraw-request.entity';
import {
  AffiliateStatus,
  WithdrawStatus,
} from '../affiliate/types/affiliate.type';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { AdminService } from './admin.service';
import { buildActionQueue } from './admin-action-queue';
import { resolveDashboardPeriod } from './admin-dashboard-period';
import {
  aggregateDashboardPeriod,
  compareMetric,
  DashboardInvitationRow,
  DashboardPaymentRow,
} from './admin-dashboard-metrics';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Guest) private readonly guests: Repository<Guest>,
    @InjectRepository(TemplateDesign)
    private readonly templates: Repository<TemplateDesign>,
    @InjectRepository(AffiliateProfile)
    private readonly affiliates: Repository<AffiliateProfile>,
    @InjectRepository(WithdrawRequest)
    private readonly withdrawals: Repository<WithdrawRequest>,
    private readonly admin: AdminService,
  ) {}

  /** One prioritised list across payments, invitations and payouts. */
  async getActionQueue() {
    const [reconciliation, pending] = await Promise.all([
      this.admin.getReconciliationQueue(),
      this.withdrawals.find({
        where: { status: WithdrawStatus.PENDING },
        order: { createdAt: 'ASC' },
        select: { id: true, requestedAmount: true, createdAt: true },
      }),
    ]);
    return buildActionQueue(reconciliation as any, {
      count: pending.length,
      oldestAt: pending[0]?.createdAt ?? null,
      totalAmount: pending.reduce((sum, row) => sum + Number(row.requestedAmount || 0), 0),
    });
  }

  async getOverview(query: DashboardQueryDto) {
    const period = resolveDashboardPeriod(query);
    // Read only reporting fields, never full users, tokens or invitation content.
    // Filter both periods before aggregating; Date hydration follows the same
    // driver configuration as the rest of the application.
    const [invitationRows, paymentRows] = await Promise.all([
      this.invitations
        .createQueryBuilder('inv')
        .leftJoin('inv.templateDesign', 'template')
        .leftJoin('template.category', 'category')
        .select('inv.id', 'id')
        .addSelect('inv.createdAt', 'createdAt')
        .addSelect('category.name', 'category')
        .where('inv.createdAt >= :start AND inv.createdAt < :end', {
          start: period.previousStart,
          end: period.effectiveEnd,
        })
        .getRawMany<DashboardInvitationRow>(),
      this.payments
        .createQueryBuilder('p')
        .leftJoin('p.invitation', 'inv')
        .select('p.id', 'id')
        .addSelect('p.invitationId', 'invitationId')
        .addSelect('COALESCE(p.userId, inv.userId)', 'buyerId')
        .addSelect('LOWER(TRIM(p.email))', 'buyerEmail')
        .addSelect('p.amount', 'amount')
        .addSelect('p.status', 'status')
        .addSelect('p.purpose', 'purpose')
        .addSelect('p.paymentMethod', 'paymentMethod')
        .addSelect('p.paymentType', 'paymentType')
        .addSelect('p.settlementTime', 'settlementTime')
        .addSelect('p.createdAt', 'createdAt')
        .where(
          '(p.settlementTime >= :start AND p.settlementTime < :end) OR (p.createdAt >= :start AND p.createdAt < :end)',
          { start: period.previousStart, end: period.effectiveEnd },
        )
        .getRawMany<DashboardPaymentRow>(),
    ]);
    const current = aggregateDashboardPeriod(
      invitationRows,
      paymentRows,
      period,
    );
    const previous = aggregateDashboardPeriod(
      invitationRows,
      paymentRows,
      period,
      true,
    );
    const comparison = Object.fromEntries(
      Object.entries(current.metrics).map(([key, value]) => [
        key,
        compareMetric(
          value,
          previous.metrics[key as keyof typeof previous.metrics],
        ),
      ]),
    );
    const countRequests = {
      users: this.users.count(),
      invitations: this.invitations.count(),
      guests: this.guests.count(),
      templates: this.templates.count(),
      activeResellers: this.affiliates.count({
        where: { status: AffiliateStatus.ACTIVE },
      }),
      pendingWithdrawals: this.withdrawals.count({
        where: { status: WithdrawStatus.PENDING },
      }),
    };
    const keys = Object.keys(countRequests);
    const counts = await Promise.allSettled(Object.values(countRequests));
    const totals = Object.fromEntries(
      counts.map((result, index) => [
        keys[index],
        result.status === 'fulfilled' ? result.value : null,
      ]),
    );
    return {
      period,
      totals,
      metrics: current.metrics,
      comparison,
      trend: current.trend,
      categories: current.categories,
      sourceWarnings: counts.flatMap((result, index) =>
        result.status === 'rejected' ? [keys[index]] : [],
      ),
      sources: {
        money: 'payment_records',
        invitations: 'invitation_records',
        visitors: 'not_connected',
        historicalEnvironmentVerified: false,
        currentGatewayEnvironment:
          String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true'
            ? 'production'
            : 'sandbox_or_unconfirmed',
      },
      definitions: {
        revenue:
          'Nominal transaksi undangan sukses bersumber Midtrans dengan waktu pelunasan; setelah diskon, belum dikurangi biaya, refund atau komisi. Simulasi dan aktivasi gratis dikecualikan.',
        paidOrders:
          'Jumlah transaksi berbayar undangan, termasuk upgrade; setiap ID order dihitung satu kali.',
        paidInvitations:
          'Undangan unik yang menerima pembayaran pada periode; transaksi undangan yang sudah dihapus tetap masuk penerimaan.',
        buyers:
          'Akun pembayar unik, memakai email ternormalisasi bila ID akun tidak tersedia.',
        freeActivations:
          'Aktivasi undangan sukses nol rupiah dengan sumber gratis/promo yang dikenali.',
        pendingOrders:
          'Percobaan checkout undangan yang dibuat pada periode dan masih pending saat laporan dibuka.',
        comparison:
          'Rentang sebelumnya sepanjang jumlah hari yang sama, dengan waktu pengamatan setara bila hari terakhir masih berjalan.',
        history:
          'Lingkungan sandbox/production transaksi lama belum tersimpan. Waktu mengikuti konfigurasi pembacaan tanggal database aplikasi. Verifikasi sumber produksi sebelum memakai laporan untuk pembukuan.',
      },
    };
  }
}
