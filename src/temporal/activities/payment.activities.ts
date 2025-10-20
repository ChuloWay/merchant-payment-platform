export interface PaymentData {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  merchantId: string;
  paymentMethodId: string;
  metadata?: any;
}

export interface PaymentValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  gatewayResponse?: any;
  errorMessage?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  lastError?: string;
}

function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [PaymentActivity] ${message}`, JSON.stringify(data));
  } else {
    console.log(`[${timestamp}] [PaymentActivity] ${message}`);
  }
}

async function simulateGatewayCall(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 100 + Math.random() * 200);
  });
}

async function simulateWebhookDelivery(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 50 + Math.random() * 100);
  });
}

export async function validatePayment(paymentData: PaymentData): Promise<PaymentValidationResult> {
  log(`Validating payment: ${paymentData.paymentId}`);

  if (!paymentData.paymentId || !paymentData.amount || !paymentData.merchantId) {
    return {
      isValid: false,
      reason: 'Missing required payment fields',
    };
  }

  if (paymentData.amount <= 0) {
    return {
      isValid: false,
      reason: 'Payment amount must be greater than zero',
    };
  }

  log(`Payment validated successfully: ${paymentData.paymentId}`);
  return { isValid: true };
}

export async function processPaymentWithGateway(paymentData: PaymentData): Promise<PaymentProcessingResult> {
  log(`Processing payment with gateway: ${paymentData.paymentId}`);

  try {
    await simulateGatewayCall();

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    log(`Payment processed successfully: ${paymentData.paymentId} -> ${transactionId}`);
    
    return {
      success: true,
      transactionId,
      gatewayResponse: {
        status: 'approved',
        authCode: `AUTH_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    log(`Payment processing failed: ${paymentData.paymentId}`, { error: error.message });
    return {
      success: false,
      errorMessage: error.message || 'Gateway processing failed',
    };
  }
}

export async function updatePaymentStatus(
  paymentId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  transactionId?: string,
): Promise<void> {
  log(`Updating payment status: ${paymentId} -> ${status}`, { transactionId });
  log(`Payment status updated in database: ${paymentId}`);
}

export async function sendWebhookNotification(paymentData: PaymentData, status: string): Promise<WebhookDeliveryResult> {
  log(`Sending webhook for payment: ${paymentData.paymentId} (${status})`);

  try {
    await simulateWebhookDelivery();
    log(`Webhook delivered successfully: ${paymentData.paymentId}`);
    
    return {
      success: true,
      attempts: 1,
    };
  } catch (error: any) {
    log(`Webhook delivery failed: ${paymentData.paymentId}`, { error: error.message });
    return {
      success: false,
      attempts: 1,
      lastError: error.message,
    };
  }
}

export async function compensatePayment(paymentId: string, reason: string): Promise<void> {
  log(`Compensating payment: ${paymentId} - Reason: ${reason}`);
  await updatePaymentStatus(paymentId, 'failed');
  log(`Payment compensation completed: ${paymentId}`);
}

