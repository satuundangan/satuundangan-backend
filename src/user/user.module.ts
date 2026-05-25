import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserConsent } from './user-consent.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserConsent])],
  providers: [UserService, ConsentService],
  controllers: [UserController, ConsentController],
  exports: [UserService, ConsentService],
})
export class UserModule {}
