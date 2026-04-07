import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateStoreAppointmentDto } from './dto/create-store-appointment.dto';
import { QueryNearestStoresDto } from './dto/query-nearest-stores.dto';
import { QueryStoresDto } from './dto/query-stores.dto';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly service: StoresService) {}

  @Get()
  list(@Query() query: QueryStoresDto) {
    return this.service.list(query);
  }

  @Get('nearest')
  nearest(@Query() query: QueryNearestStoresDto) {
    return this.service.nearest(query);
  }

  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.service.detail(idOrSlug);
  }

  @Post(':idOrSlug/appointments')
  createAppointment(
    @Param('idOrSlug') idOrSlug: string,
    @Body() body: CreateStoreAppointmentDto,
  ) {
    return this.service.createAppointment(idOrSlug, body);
  }
}
