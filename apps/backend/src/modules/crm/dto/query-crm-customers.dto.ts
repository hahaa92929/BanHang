import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const crmSegments = ['vip', 'new', 'at_risk', 'inactive', 'active'] as const;
const customerRoles = ['customer', 'guest'] as const;

export class QueryCrmCustomersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(crmSegments)
  segment?: (typeof crmSegments)[number];

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsIn(customerRoles)
  role?: (typeof customerRoles)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
