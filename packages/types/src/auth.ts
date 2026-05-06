export type Role = 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING';

export interface Actor {
  userId: string;
  propertyId: string;
  role: Role;
  sessionId?: string;
  lastActiveAt?: number;
}

export interface SessionWithProperty {
  userId: string;
  defaultPropertyId: string;
}

export interface JwtPayload {
  sub: string;
  propertyId: string;
  role: Role;
  iat: number;
  exp: number;
  lastActiveAt: number;
}
