import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  question!: string;
}
