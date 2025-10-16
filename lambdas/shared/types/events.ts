export interface PaymentEvent {
  eventType: string;
  eventId: string;
  timestamp: string;
  correlationId: string;
  payload: PaymentPayload;
}

export interface PaymentPayload {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  merchantId: string;
  paymentMethodId?: string;
  gatewayReference?: string;
  failureReason?: string;
  status?: string;
  metadata?: any;
  initiatedAt?: string;
  completedAt?: string;
}

export interface SNSMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  MessageAttributes?: Record<string, any>;
}

