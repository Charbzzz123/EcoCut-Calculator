import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesUsageRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';

@Module({
  controllers: [AddressesController],
  providers: [AddressesService, AddressesUsageRepository],
  exports: [AddressesService],
})
export class AddressesModule {}
