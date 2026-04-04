import { IsString, MinLength } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @MinLength(3)
  code!: string;
}
