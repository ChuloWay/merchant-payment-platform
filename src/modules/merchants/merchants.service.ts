import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Merchant } from './entities/merchant.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  async create(
    createMerchantDto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    const { email } = createMerchantDto;

    const existingMerchant = await this.merchantRepository.findOne({
      where: { email },
    });

    if (existingMerchant) {
      throw new ConflictException('Merchant with this email already exists');
    }

    const apiKey = this.generateApiKey();

    const merchant = this.merchantRepository.create({
      ...createMerchantDto,
      apiKey,
    });

    const savedMerchant = await this.merchantRepository.save(merchant);

    this.logger.log(
      `Created merchant: ${savedMerchant.id} - ${savedMerchant.name}`,
    );

    return this.mapToResponseDto(savedMerchant);
  }

  async findById(id: string): Promise<MerchantResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return this.mapToResponseDto(merchant);
  }

  async findByApiKey(apiKey: string): Promise<Merchant | null> {
    return this.merchantRepository.findOne({
      where: { apiKey, isActive: true },
    });
  }

  async findAll(): Promise<MerchantResponseDto[]> {
    const merchants = await this.merchantRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });

    return merchants.map((merchant) => this.mapToResponseDto(merchant));
  }

  async deactivate(id: string): Promise<void> {
    await this.findById(id);
    
    await this.merchantRepository.update(id, { isActive: false });
    
    this.logger.log(`Deactivated merchant: ${id}`);
  }

  private generateApiKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = uuidv4().replace(/-/g, '');
    return `pk_${timestamp}_${randomPart}`;
  }

  private mapToResponseDto(merchant: Merchant): MerchantResponseDto {
    return {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      apiKey: merchant.apiKey,
      webhookUrl: merchant.webhookUrl,
      isActive: merchant.isActive,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    };
  }
}
