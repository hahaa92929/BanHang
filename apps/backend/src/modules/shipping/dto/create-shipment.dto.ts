import { IsString } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  orderId!: string;
}
