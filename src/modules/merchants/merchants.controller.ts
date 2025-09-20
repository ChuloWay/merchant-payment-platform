import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';

@ApiTags('merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new merchant',
    description:
      'Creates a new merchant account with auto-generated API key for Nigerian businesses',
  })
  @ApiResponse({
    status: 201,
    description: 'Merchant created successfully',
    type: MerchantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 409,
    description: 'Merchant with email already exists',
  })
  async create(
    @Body() createMerchantDto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.merchantsService.create(createMerchantDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all active merchants',
    description: 'Retrieves a list of all active merchants in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'Merchants retrieved successfully',
    type: [MerchantResponseDto],
  })
  async findAll(): Promise<MerchantResponseDto[]> {
    return this.merchantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get merchant by ID',
    description: 'Retrieves a specific merchant by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Merchant UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Merchant retrieved successfully',
    type: MerchantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async findOne(@Param('id') id: string): Promise<MerchantResponseDto> {
    return this.merchantsService.findById(id);
  }
}
