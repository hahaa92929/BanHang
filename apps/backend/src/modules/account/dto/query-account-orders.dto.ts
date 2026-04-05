import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryAccountOrdersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['created', 'confirmed', 'shipping', 'completed', 'canceled', 'returned'])
  status?: 'created' | 'confirmed' | 'shipping' | 'completed' | 'canceled' | 'returned';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
