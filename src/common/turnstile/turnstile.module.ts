import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';
import { TurnstileGuard } from './turnstile.guard';

@Module({
  imports: [ConfigModule],
  providers: [TurnstileService, TurnstileGuard],
  exports: [TurnstileService, TurnstileGuard],
})
export class TurnstileModule {}
