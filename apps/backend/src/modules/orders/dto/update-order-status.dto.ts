import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['confirmed', 'shipping', 'completed'])
  status!: 'confirmed' | 'shipping' | 'completed';
}
