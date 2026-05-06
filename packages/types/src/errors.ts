export type ErrorCode =
  | 'LOCK_TIMEOUT'
  | 'CONFLICT'
  | 'ROOM_UNAVAILABLE'
  | 'ALREADY_CHECKED_IN'
  | 'FOLIO_CLOSED'
  | 'ALREADY_VOIDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_MAX_ATTEMPTS'
  | 'OTP_RATE_LIMITED'
  | 'OTP_PROVIDER_ERROR'
  | 'REFRESH_TOKEN_REUSED'
  | 'PROPERTY_ACCESS_DENIED'
  | 'INVALID_RATE_RANGE'
  | 'ROOM_TYPE_HAS_ACTIVE_RESERVATIONS'
  | 'CANCELLATION_POLICY_IN_USE'
  | 'SETUP_INCOMPLETE'
  | 'TEAM_MEMBER_ALREADY_EXISTS'
  | 'CANNOT_INVITE_OWNER'
  | 'CANNOT_REVOKE_SELF'
  | 'INVALID_GST_SLAB'
  | 'INVALID_GST_AMOUNT'
  | 'INVOICE_IMMUTABLE'
  | 'AUDIT_LOG_IMMUTABLE'
  | 'CREDIT_NOTE_ALREADY_EXISTS'
  | 'INVOICE_NOT_FOUND'
  | 'PROPERTY_GSTIN_MISSING'
  | 'DIRECT_BOOKING_DISABLED'
  | 'INVALID_BOOKING_SLUG'
  | 'NO_ROOMS_AVAILABLE'
  | 'HOLD_NOT_FOUND'
  | 'HOLD_EXPIRED'
  | 'PAYMENT_SIGNATURE_INVALID'
  | 'PAYMENT_NOT_FOUND'
  | 'RECONCILIATION_NOT_FOUND'
  | 'RECONCILIATION_ALREADY_ACKNOWLEDGED'
  | 'ROOM_BLOCKED'
  | 'ROOM_BLOCK_NOT_FOUND'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = options?.cause;
    this.details = options?.details;
  }
}
