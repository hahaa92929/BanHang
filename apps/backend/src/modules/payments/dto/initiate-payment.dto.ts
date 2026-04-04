import { IsIn, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsIn(['cod', 'vnpay', 'momo', 'zalopay', 'stripe', 'paypal', 'bank_transfer'])
  method?:
    | 'cod'
    | 'vnpay'
    | 'momo'
    | 'zalopay'
    | 'stripe'
    | 'paypal'
    | 'bank_transfer';
}
