import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod, PaymentMethodType } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async create(
    merchantId: string,
    createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const { type, accountNumber, bankCode } = createPaymentMethodDto;

    if (type === PaymentMethodType.BANK_ACCOUNT && (!accountNumber || !bankCode)) {
      throw new BadRequestException(
        'Bank account number and bank code are required for bank account payment method',
      );
    }

    const paymentMethod = this.paymentMethodRepository.create({
      ...createPaymentMethodDto,
      merchantId,
    });

    const savedPaymentMethod =
      await this.paymentMethodRepository.save(paymentMethod);

    this.logger.log(
      `Created payment method: ${savedPaymentMethod.id} - Type: ${type}`,
    );

    return this.mapToResponseDto(savedPaymentMethod);
  }

  async findById(id: string): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return this.mapToResponseDto(paymentMethod);
  }

  async findByMerchant(
    merchantId: string,
  ): Promise<PaymentMethodResponseDto[]> {
    const paymentMethods = await this.paymentMethodRepository.find({
      where: { merchantId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return paymentMethods.map((paymentMethod) =>
      this.mapToResponseDto(paymentMethod),
    );
  }

  async findByIdAndMerchant(
    id: string,
    merchantId: string,
  ): Promise<PaymentMethod | null> {
    return this.paymentMethodRepository.findOne({
      where: { id, merchantId, isActive: true },
    });
  }

  async deactivate(id: string, merchantId: string): Promise<void> {
    const paymentMethod = await this.findByIdAndMerchant(id, merchantId);

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    await this.paymentMethodRepository.update(id, { isActive: false });

    this.logger.log(`Deactivated payment method: ${id}`);
  }

  private mapToResponseDto(
    paymentMethod: PaymentMethod,
  ): PaymentMethodResponseDto {
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      provider: paymentMethod.provider,
      lastFour: paymentMethod.lastFour,
      bankName: paymentMethod.bankName,
      merchantId: paymentMethod.merchantId,
      isActive: paymentMethod.isActive,
      metadata: paymentMethod.metadata,
      createdAt: paymentMethod.createdAt,
      updatedAt: paymentMethod.updatedAt,
    };
  }
}
