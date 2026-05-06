// @ts-nocheck
import {
  prisma,
  encryptSecret,
  generateRandomSecret,
  writeAuditLog,
} from '@gojo/db';
import { AppError } from '@gojo/types';

const VALID_CHANNEL_TYPES = ['MMT', 'BOOKING_COM', 'AGODA', 'GOIBIBO', 'OTHER'] as const;

const CHANNEL_NAMES: Record<(typeof VALID_CHANNEL_TYPES)[number], string> = {
  MMT: 'MakeMyTrip',
  BOOKING_COM: 'Booking.com',
  AGODA: 'Agoda',
  GOIBIBO: 'Goibibo',
  OTHER: 'Other',
};

export async function listChannels(propertyId: string) {
  const channels = await prisma.channel.findMany({
    where: { propertyId, deletedAt: null },
    orderBy: { connectedAt: 'desc' },
  });
  const secrets = await prisma.webhookSecret.findMany({
    where: { propertyId, channelId: { in: channels.map((c) => c.id) } },
  });
  const byChannel = new Map<string, typeof secrets>();
  for (const s of secrets) {
    if (!s.channelId) continue;
    const arr = byChannel.get(s.channelId) ?? [];
    arr.push(s);
    byChannel.set(s.channelId, arr);
  }
  return channels.map((c) => {
    const list = byChannel.get(c.id) ?? [];
    const hasRotating = list.some((s) => s.status === 'ROTATING');
    const hasActive = list.some((s) => s.status === 'ACTIVE');
    let status: 'CONNECTED' | 'ROTATING' | 'DISCONNECTED' = 'DISCONNECTED';
    if (hasActive && hasRotating) status = 'ROTATING';
    else if (hasActive) status = 'CONNECTED';
    return {
      id: c.id,
      channelType: c.channelType,
      channelName: c.channelName,
      webhookEndpoint: c.webhookEndpoint,
      status,
      connectedAt: c.connectedAt,
    };
  });
}

export async function connectChannel({
  actor,
  channelType,
}: {
  actor: { userId: string; propertyId: string; role: string };
  channelType: (typeof VALID_CHANNEL_TYPES)[number];
}) {
  if (!VALID_CHANNEL_TYPES.includes(channelType)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid channel type', 400);
  }
  const existing = await prisma.channel.findFirst({
    where: { propertyId: actor.propertyId, channelType, deletedAt: null },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Channel already connected', 409);
  }

  return prisma.$transaction(async (tx) => {
    const channel = await tx.channel.create({
      data: {
        propertyId: actor.propertyId,
        channelType,
        channelName: CHANNEL_NAMES[channelType],
        webhookEndpoint: '',
        connectedBy: actor.userId,
      },
    });
    await tx.channel.update({
      where: { id: channel.id },
      data: { webhookEndpoint: `/api/webhooks/ota/${channel.id}` },
    });

    const plaintextSecret = generateRandomSecret();
    await tx.webhookSecret.create({
      data: {
        propertyId: actor.propertyId,
        channelId: channel.id,
        provider: channelType,
        secret: encryptSecret(plaintextSecret),
        status: 'ACTIVE',
        isActive: true,
      },
    });

    await writeAuditLog(tx, actor as never, {
      action: 'CHANNEL_CONNECTED',
      entityType: 'CHANNEL',
      entityId: channel.id,
      metadata: { channelType, channelName: CHANNEL_NAMES[channelType] },
    });

    return {
      id: channel.id,
      channelType,
      channelName: CHANNEL_NAMES[channelType],
      webhookEndpoint: `/api/webhooks/ota/${channel.id}`,
      secret: plaintextSecret,
    };
  });
}

export async function rotateSecret({
  actor,
  channelId,
}: {
  actor: { userId: string; propertyId: string; role: string };
  channelId: string;
}) {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!channel) throw new AppError('NOT_FOUND', 'Channel not found', 404);

  return prisma.$transaction(async (tx) => {
    await tx.webhookSecret.updateMany({
      where: { channelId, status: 'ACTIVE' },
      data: { status: 'ROTATING', rotatedAt: new Date() },
    });

    const plaintextSecret = generateRandomSecret();
    await tx.webhookSecret.create({
      data: {
        propertyId: actor.propertyId,
        channelId,
        provider: channel.channelType,
        secret: encryptSecret(plaintextSecret),
        status: 'ACTIVE',
        isActive: true,
      },
    });

    await writeAuditLog(tx, actor as never, {
      action: 'CHANNEL_CONNECTED',
      entityType: 'CHANNEL',
      entityId: channelId,
      metadata: { rotated: true, channelType: channel.channelType },
    });

    return { secret: plaintextSecret };
  });
}

export async function disconnectChannel({
  actor,
  channelId,
}: {
  actor: { userId: string; propertyId: string; role: string };
  channelId: string;
}) {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!channel) throw new AppError('NOT_FOUND', 'Channel not found', 404);

  return prisma.$transaction(async (tx) => {
    await tx.channel.update({
      where: { id: channelId },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });
    await tx.webhookSecret.updateMany({
      where: { channelId },
      data: { status: 'EXPIRED', expiredAt: new Date(), isActive: false },
    });

    await writeAuditLog(tx, actor as never, {
      action: 'CHANNEL_DISCONNECTED',
      entityType: 'CHANNEL',
      entityId: channelId,
      metadata: { channelType: channel.channelType, channelName: channel.channelName },
    });

    return { ok: true };
  });
}

export async function expireRotatingSecrets() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.webhookSecret.updateMany({
    where: { status: 'ROTATING', rotatedAt: { lt: cutoff } },
    data: { status: 'EXPIRED', expiredAt: new Date(), isActive: false },
  });
  return result.count;
}
