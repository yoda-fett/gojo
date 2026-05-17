// Negative fixture for mogojo/services-subscription-gate.
// Lives under fixtures/ so the rule's own scope filter excludes it from
// being linted as a real service file. Consumers may opt-in by running
// ESLint against this file with a virtual scope override.

export async function missingGate(actor: { propertyId: string }, db: any): Promise<void> {
  await db.reservation.create({ data: { propertyId: actor.propertyId } });
}
