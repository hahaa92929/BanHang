import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTrackingEventDto {
  @IsIn(['pending', 'packed', 'in_transit', 'delivered', 'returned', 'canceled'])
  status!: 'pending' | 'packed' | 'in_transit' | 'delivered' | 'returned' | 'canceled';

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['ghn', 'ghtk', 'jt', 'viettel_post', 'grab_express', 'internal'])
  carrier?: 'ghn' | 'ghtk' | 'jt' | 'viettel_post' | 'grab_express' | 'internal';
}
