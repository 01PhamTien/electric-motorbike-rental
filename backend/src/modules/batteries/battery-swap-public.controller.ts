import { Controller, Get } from '@nestjs/common';
import { BatteriesService } from './batteries.service';

@Controller('battery-swap')
export class BatterySwapPublicController {
  constructor(private readonly service:BatteriesService){}
  @Get('availability')
  availability(){return this.service.publicAvailability();}
}
