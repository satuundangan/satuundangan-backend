import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';

const KEY = 'maintenance';
const CACHE_MS = 10_000;
const MAX_MESSAGE = 300;
const MAX_REASON = 300;

export interface MaintenanceState {
  enabled: boolean;
  /** Shown to visitors. */
  message: string;
  /** Internal note for other admins; never exposed publicly. */
  reason: string;
  /** ISO time maintenance is expected to end, or null when unknown. */
  until: string | null;
  updatedAt: string | null;
  updatedById: number | null;
}

const DEFAULT_STATE: MaintenanceState = {
  enabled: false,
  message: 'Satu Undangan sedang dalam perawatan singkat. Pembelian dinonaktifkan sementara.',
  reason: '',
  until: null,
  updatedAt: null,
  updatedById: null,
};

@Injectable()
export class MaintenanceService {
  private cache: { state: MaintenanceState; at: number } | null = null;

  constructor(@InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>) {}

  async get(): Promise<MaintenanceState> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.state;
    let state = DEFAULT_STATE;
    try {
      const row = await this.repo.findOne({ where: { key: KEY } });
      if (row) {
        state = {
          ...DEFAULT_STATE,
          ...row.value,
          updatedAt: row.updatedAt?.toISOString() ?? null,
          updatedById: row.updatedById,
        };
      }
    } catch {
      // The setting table being unavailable must never lock visitors out; treat as off.
    }
    this.cache = { state, at: Date.now() };
    return state;
  }

  /** Active means enabled and not past its planned end time. */
  async isActive(now = new Date()): Promise<boolean> {
    const state = await this.get();
    if (!state.enabled) return false;
    return !state.until || Date.parse(state.until) > now.getTime();
  }

  async publicStatus() {
    const state = await this.get();
    const active = await this.isActive();
    return {
      maintenance: {
        active,
        message: active ? state.message : null,
        until: active ? state.until : null,
        blocks: active ? ['checkout'] : [],
      },
    };
  }

  async update(input: Partial<Pick<MaintenanceState, 'enabled' | 'message' | 'reason' | 'until'>>, actorId: number) {
    const current = await this.get();
    const next: MaintenanceState = {
      ...current,
      enabled: input.enabled ?? current.enabled,
      message: (input.message ?? current.message).trim().slice(0, MAX_MESSAGE),
      reason: (input.reason ?? current.reason).trim().slice(0, MAX_REASON),
      until: input.until === undefined ? current.until : input.until,
    };
    if (next.until !== null) {
      const until = Date.parse(next.until);
      if (!Number.isFinite(until)) throw new BadRequestException('Waktu selesai tidak valid.');
      if (next.enabled && until <= Date.now()) {
        throw new BadRequestException('Waktu selesai harus di masa depan.');
      }
      next.until = new Date(until).toISOString();
    }
    if (next.enabled && !next.reason) {
      throw new BadRequestException('Alasan perawatan wajib diisi agar admin lain tahu konteksnya.');
    }
    if (!next.message) throw new BadRequestException('Pesan untuk pengunjung tidak boleh kosong.');
    const { updatedAt: _a, updatedById: _b, ...value } = next;
    await this.repo.save({ key: KEY, value, updatedById: actorId });
    this.cache = null;
    return this.get();
  }
}
