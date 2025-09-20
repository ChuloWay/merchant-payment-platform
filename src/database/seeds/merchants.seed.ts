import { DataSource } from 'typeorm';
import { Merchant } from '../../modules/merchants/entities/merchant.entity';
import {
  PaymentMethod,
  PaymentMethodType,
} from '../../modules/payment-methods/entities/payment-method.entity';

export class MerchantsSeed {
  public async run(dataSource: DataSource): Promise<void> {
    const merchantRepository = dataSource.getRepository(Merchant);
    const paymentMethodRepository = dataSource.getRepository(PaymentMethod);

    const merchants = [
      {
        name: 'Lagos Tech Solutions Ltd',
        email: 'contact@lagostech.com.ng',
        webhookUrl: 'https://api.lagostech.com.ng/webhooks/payments',
      },
      {
        name: 'Abuja Digital Services',
        email: 'payments@abujadigital.ng',
        webhookUrl: 'https://api.abujadigital.ng/webhooks/payments',
      },
      {
        name: 'Kano E-Commerce Hub',
        email: 'support@kanohub.com.ng',
        webhookUrl: 'https://api.kanohub.com.ng/webhooks/payments',
      },
      {
        name: 'Port Harcourt FinTech',
        email: 'api@phfintech.com.ng',
        webhookUrl: 'https://api.phfintech.com.ng/webhooks/payments',
      },
      {
        name: 'Ibadan Payment Gateway',
        email: 'admin@ibadanpay.com.ng',
        webhookUrl: 'https://api.ibadanpay.com.ng/webhooks/payments',
      },
    ];

    const createdMerchants: Merchant[] = [];

    for (const merchantData of merchants) {
      const existingMerchant = await merchantRepository.findOne({
        where: { email: merchantData.email },
      });

      if (!existingMerchant) {
        const merchant = merchantRepository.create({
          ...merchantData,
          apiKey: this.generateApiKey(),
        });

        const savedMerchant = await merchantRepository.save(merchant);
        createdMerchants.push(savedMerchant);
      } else {
        createdMerchants.push(existingMerchant);
      }
    }

    const paymentMethods = [
      {
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
        merchantId: createdMerchants[0].id,
        metadata: { cardType: 'visa', expiryMonth: '12', expiryYear: '2025' },
      },
      {
        type: PaymentMethodType.BANK_TRANSFER,
        provider: 'Flutterwave',
        bankCode: '058',
        bankName: 'GTBank',
        merchantId: createdMerchants[0].id,
        metadata: { accountName: 'Lagos Tech Solutions Ltd' },
      },
      {
        type: PaymentMethodType.USSD,
        provider: 'Paystack',
        merchantId: createdMerchants[1].id,
        metadata: { ussdCode: '*723*123#' },
      },
      {
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Flutterwave',
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
        merchantId: createdMerchants[1].id,
        metadata: { accountName: 'Abuja Digital Services' },
      },
      {
        type: PaymentMethodType.WALLET,
        provider: 'Opay',
        merchantId: createdMerchants[2].id,
        metadata: { walletType: 'mobile_money' },
      },
    ];

    for (const paymentMethodData of paymentMethods) {
      const existingPaymentMethod = await paymentMethodRepository.findOne({
        where: {
          merchantId: paymentMethodData.merchantId,
          type: paymentMethodData.type,
        },
      });

      if (!existingPaymentMethod) {
        const paymentMethod = paymentMethodRepository.create(paymentMethodData);
        await paymentMethodRepository.save(paymentMethod);
      }
    }
  }

  private generateApiKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `pk_${timestamp}_${randomPart}`;
  }
}
