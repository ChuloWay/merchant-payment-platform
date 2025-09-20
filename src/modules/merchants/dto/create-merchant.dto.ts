import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({
    description: 'Merchant business name',
    example: 'Lagos Tech Solutions Ltd',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Merchant email address',
    example: 'contact@lagostech.com.ng',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Webhook URL for payment notifications',
    example: 'https://api.lagostech.com.ng/webhooks/payments',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}
