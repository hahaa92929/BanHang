import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStoreAppointmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  service?: string;

  @Type(() => Date)
  @IsDate()
  scheduledFor!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
