import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  Length,
} from 'class-validator';
import { PaymentMethodType } from '../entities/payment-method.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    example: PaymentMethodType.CARD,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({
    description: 'Payment provider name',
    example: 'Paystack',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: 'Last four digits of card or account',
    example: '1234',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(4, 4)
  lastFour?: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({
    description: 'Nigerian bank code',
    example: '058',
    required: false,
  })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiProperty({
    description: 'Bank name',
    example: 'GTBank',
    required: false,
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({
    description: 'Additional payment method metadata',
    example: { cardType: 'visa', expiryMonth: '12', expiryYear: '2025' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
