import {
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, Permission } from '../../../common/types/domain';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions?: Permission[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
