import { Module } from '@nestjs/common';
import { OpsUsersService } from './ops-users.service';
import { OpsUsersController } from './ops-users.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [OpsUsersService],
  controllers: [OpsUsersController],
  exports: [OpsUsersService],
})
export class OpsUsersModule {}
