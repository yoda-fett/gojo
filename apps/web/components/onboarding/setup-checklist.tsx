'use client';

type SetupStatus = {
  roomTypesConfigured: boolean;
  cancellationPoliciesConfigured: boolean;
  teamInvited: boolean;
  minimumSetupComplete: boolean;
};

export function SetupChecklist({ setupStatus }: { setupStatus: SetupStatus }) {
  if (setupStatus.minimumSetupComplete) {
    return null;
  }

  const steps = [
    {
      done: setupStatus.roomTypesConfigured,
      title: 'Add a room type',
      description: 'Define your first room category before taking bookings.',
      href: '/settings/room-types',
    },
    {
      done: setupStatus.cancellationPoliciesConfigured,
      title: 'Add a cancellation policy',
      description: 'Set your booking rules so reservations behave correctly.',
      href: '/settings/cancellation-policies',
    },
  ];

  return (
    <section className="gojo-setup-card">
      <div>
        <p className="gojo-eyebrow">Setup Checklist</p>
        <h2>Finish your property setup</h2>
        <p className="gojo-copy">Complete the minimum setup so Gojo can safely accept reservations.</p>
      </div>
      <ol className="gojo-setup-list">
        {steps.map((step, index) => (
          <li className="gojo-setup-item" key={step.title}>
            <span aria-hidden="true" className={step.done ? 'done' : ''}>
              {step.done ? '✓' : index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
            <a href={step.href}>{step.done ? 'Review' : 'Open'}</a>
          </li>
        ))}
      </ol>
    </section>
  );
}
