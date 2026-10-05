import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeddingPlanner } from './wedding-planner.entity';
import { WeddingPlannerService } from './wedding-planner.service';
import { WeddingPlannerController } from './wedding-planner.controller';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WeddingPlanner, User])],
  controllers: [WeddingPlannerController],
  providers: [WeddingPlannerService],
  exports: [WeddingPlannerService],
})
export class WeddingPlannerModule {}
