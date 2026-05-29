import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import type { AddressValidateRequest } from './addresses.types';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get('suggest')
  suggest(
    @Query('q') query?: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    return this.addresses.suggest(query ?? '', sessionToken);
  }

  @Post('validate')
  validate(@Body() body: AddressValidateRequest) {
    return this.addresses.validate(body ?? {});
  }

  @Get('usage')
  usage() {
    return this.addresses.getUsage();
  }
}
