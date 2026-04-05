import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ModerateReviewDto {
  @IsIn(['pending', 'published', 'rejected'])
  status!: 'pending' | 'published' | 'rejected';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  adminReply?: string;
}
