import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsIn(['ghn', 'ghtk', 'jt', 'viettel_post', 'grab_express', 'internal'])
  carrier?: 'ghn' | 'ghtk' | 'jt' | 'viettel_post' | 'grab_express' | 'internal';

  @IsOptional()
  @IsString()
  serviceCode?: string;
}
