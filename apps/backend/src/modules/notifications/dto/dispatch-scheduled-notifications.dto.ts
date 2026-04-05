import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DispatchScheduledNotificationsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
