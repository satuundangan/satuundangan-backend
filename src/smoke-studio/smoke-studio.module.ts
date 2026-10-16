import { Module } from '@nestjs/common';
import { SmokeStudioController } from './smoke-studio.controller';

@Module({
  controllers: [SmokeStudioController],
})
export class SmokeStudioModule {}
