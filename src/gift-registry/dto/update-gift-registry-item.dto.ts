import { PartialType } from '@nestjs/swagger';
import { CreateGiftRegistryItemDto } from './create-gift-registry-item.dto';

export class UpdateGiftRegistryItemDto extends PartialType(CreateGiftRegistryItemDto) {}
