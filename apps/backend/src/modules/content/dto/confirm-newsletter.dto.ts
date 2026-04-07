import { IsString, MinLength } from 'class-validator';

export class ConfirmNewsletterDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
