import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
