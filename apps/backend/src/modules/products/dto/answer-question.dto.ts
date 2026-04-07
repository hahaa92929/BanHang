import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnswerQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  answer!: string;
}
