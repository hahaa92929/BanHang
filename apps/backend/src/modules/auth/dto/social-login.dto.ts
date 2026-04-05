import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @MinLength(2)
  providerUserId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  guestAccessToken?: string;
}
