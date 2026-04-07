import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class SetPriceAlertDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetPrice?: number;
}
