import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const orderNoteVisibilities = ['internal', 'customer'] as const;

export class CreateOrderNoteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsIn(orderNoteVisibilities)
  visibility?: (typeof orderNoteVisibilities)[number];
}
