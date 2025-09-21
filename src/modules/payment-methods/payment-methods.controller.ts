import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('payment-methods')
@Controller('payment-methods')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('api-key')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new payment method',
    description:
      'Creates a new payment method for the authenticated merchant. Supports cards, bank transfers, USSD, and bank accounts for Nigerian market.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
    @Req() request: Request,
  ): Promise<PaymentMethodResponseDto> {
    const merchant = (request as any).merchant;
    return this.paymentMethodsService.create(
      merchant.id,
      createPaymentMethodDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get merchant payment methods',
    description:
      'Retrieves all active payment methods for the authenticated merchant',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
    type: [PaymentMethodResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Req() request: Request): Promise<PaymentMethodResponseDto[]> {
    const merchant = (request as any).merchant;
    return this.paymentMethodsService.findByMerchant(merchant.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment method by ID',
    description: 'Retrieves a specific payment method by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async findOne(@Param('id') id: string): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodsService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate payment method',
    description: 'Deactivates a payment method for the authenticated merchant',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Payment method deactivated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async remove(@Param('id') id: string, @Req() request: Request): Promise<void> {
    const merchant = (request as any).merchant;
    return this.paymentMethodsService.deactivate(id, merchant.id);
  }
}
