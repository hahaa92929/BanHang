import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const abandonedCartChannels = ['in_app', 'email'] as const;

export class DispatchAbandonedCartRemindersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(60 * 24 * 30)
  idleMinutes?: number;

  @IsOptional()
  @IsIn(abandonedCartChannels)
  channel?: (typeof abandonedCartChannels)[number];
}
