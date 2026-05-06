export interface OtaWebhookJobPayload {
  propertyId: string;
  eventId: string;
  provider: string;
}

export interface NotificationJobPayload {
  propertyId: string;
  reservationId: string;
  channel: 'email' | 'whatsapp' | 'sms';
}
