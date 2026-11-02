import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { Station } from './station.entity';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Station]), AuthModule],
  controllers: [StationsController],
  providers: [StationsService, RolesGuard],
  exports: [StationsService, TypeOrmModule],
})
export class StationsModule {}
