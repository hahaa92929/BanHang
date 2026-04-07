import { IsInt, Min } from 'class-validator';

export class RedeemLoyaltyDto {
  @IsInt()
  @Min(500)
  points!: number;
}
