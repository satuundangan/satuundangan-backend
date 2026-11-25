import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftRegistryItem } from './entities/gift-registry-item.entity';
import { Invitation } from '../invitation/invitation.entity';
import { GiftRegistryService } from './gift-registry.service';
import { GiftRegistryController } from './gift-registry.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GiftRegistryItem, Invitation])],
  controllers: [GiftRegistryController],
  providers: [GiftRegistryService],
  exports: [GiftRegistryService],
})
export class GiftRegistryModule {}
