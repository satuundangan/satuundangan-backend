import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeddingPlanner } from './wedding-planner.entity';
import { User } from '../user/user.entity';
import {
  DEFAULT_BUDGET_ITEMS,
  DEFAULT_CHECKLISTS,
  DEFAULT_RUNDOWN,
} from './wedding-planner.defaults';

@Injectable()
export class WeddingPlannerService {
  constructor(
    @InjectRepository(WeddingPlanner)
    private readonly plannerRepo: Repository<WeddingPlanner>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Unlock wedding planner access for a user.
   * If instagramHandle is provided, save it.
   */
  async unlockAccess(
    userId: number,
    payload: { instagramHandle?: string; platform?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!payload.instagramHandle || !payload.instagramHandle.trim()) {
      throw new BadRequestException('Username Instagram wajib diisi untuk membuka akses Wedding Planner');
    }

    let handle = payload.instagramHandle.trim();
    if (!handle.startsWith('@')) {
      handle = `@${handle}`;
    }
    if (handle.length < 3) {
      throw new BadRequestException('Format username Instagram tidak valid (minimal 2 karakter)');
    }

    user.hasWeddingPlannerAccess = true;
    user.instagramHandle = handle;
    await this.userRepo.save(user);

    // Ensure initial wedding planner record exists
    const planner = await this.getOrCreatePlanner(userId);

    return {
      success: true,
      message: 'Akses Wedding Planner berhasil dibuka gratis!',
      hasWeddingPlannerAccess: true,
      instagramHandle: user.instagramHandle,
      planner,
    };
  }

  /**
   * Get or create initial planner record for user.
   */
  async getOrCreatePlanner(userId: number): Promise<WeddingPlanner> {
    let planner = await this.plannerRepo.findOne({ where: { userId } });
    if (!planner) {
      planner = this.plannerRepo.create({
        userId,
        budgetTotal: 70000000,
        budgetItems: DEFAULT_BUDGET_ITEMS,
        checklists: DEFAULT_CHECKLISTS,
        vendors: [],
        rundown: DEFAULT_RUNDOWN,
      });
      planner = await this.plannerRepo.save(planner);
    }
    return planner;
  }

  /**
   * Get planner details for current user.
   */
  async getPlanner(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'hasWeddingPlannerAccess', 'instagramHandle'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const planner = await this.getOrCreatePlanner(userId);

    return {
      hasWeddingPlannerAccess: user.hasWeddingPlannerAccess,
      instagramHandle: user.instagramHandle,
      planner,
    };
  }

  /**
   * Update planner details (budget, checklist, vendors, rundown).
   */
  async updatePlanner(userId: number, payload: Partial<WeddingPlanner>) {
    let planner = await this.plannerRepo.findOne({ where: { userId } });
    if (!planner) {
      planner = await this.getOrCreatePlanner(userId);
    }

    if (payload.budgetTotal !== undefined) planner.budgetTotal = payload.budgetTotal;
    if (payload.weddingDate !== undefined) planner.weddingDate = payload.weddingDate;
    if (payload.weddingConcept !== undefined) planner.weddingConcept = payload.weddingConcept;
    if (payload.estimatedGuests !== undefined) planner.estimatedGuests = payload.estimatedGuests;
    if (payload.budgetItems !== undefined) planner.budgetItems = payload.budgetItems;
    if (payload.checklists !== undefined) planner.checklists = payload.checklists;
    if (payload.vendors !== undefined) planner.vendors = payload.vendors;
    if (payload.rundown !== undefined) planner.rundown = payload.rundown;

    return await this.plannerRepo.save(planner);
  }

  /**
   * Reset planner to defaults.
   */
  async resetToDefaults(userId: number) {
    let planner = await this.plannerRepo.findOne({ where: { userId } });
    if (!planner) {
      planner = this.plannerRepo.create({ userId });
    }

    planner.budgetTotal = 70000000;
    planner.budgetItems = DEFAULT_BUDGET_ITEMS;
    planner.checklists = DEFAULT_CHECKLISTS;
    planner.vendors = [];
    planner.rundown = DEFAULT_RUNDOWN;

    return await this.plannerRepo.save(planner);
  }
}
