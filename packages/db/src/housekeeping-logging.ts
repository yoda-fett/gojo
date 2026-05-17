import { AppError } from '@gojo/types';

export function calculateParRestorationQtyUsed(par: number, qtyAddedToReachPar: number) {
  if (!Number.isInteger(par) || par < 0 || !Number.isInteger(qtyAddedToReachPar) || qtyAddedToReachPar < 0 || qtyAddedToReachPar > par) {
    throw new AppError('VALIDATION_ERROR', 'qtyAddedToReachPar must be between zero and par', 422);
  }
  return par - qtyAddedToReachPar;
}

export type FifoOutgoingItem = { id: string; remainingQty: number };

export function distributeLaundryReceiveFifo(outgoing: FifoOutgoingItem[], receivedQty: number) {
  if (!Number.isInteger(receivedQty) || receivedQty < 0) {
    throw new AppError('VALIDATION_ERROR', 'receivedQty must be non-negative', 422);
  }

  let remaining = receivedQty;
  const applied: Array<{ sourceLaundryLogItemId: string; qty: number; remainingQty: number }> = [];
  for (const item of outgoing) {
    if (remaining <= 0) break;
    const qty = Math.min(item.remainingQty, remaining);
    remaining -= qty;
    applied.push({
      sourceLaundryLogItemId: item.id,
      qty,
      remainingQty: item.remainingQty - qty,
    });
  }
  const expected = outgoing.reduce((sum, item) => sum + item.remainingQty, 0);
  return { applied, overReceivedQty: remaining, shortageQty: Math.max(0, expected - receivedQty) };
}

export function evidenceCapsAreValid(input: { note?: string; voiceSeconds?: number }) {
  return (input.note?.length ?? 0) <= 280 && (input.voiceSeconds ?? 0) <= 60;
}
