import { describe, expect, it } from 'vitest';

import { loadTemplate, renderTemplate } from '../services/email/template.js';

describe('loadTemplate', () => {
  it('loads subject, html, text for a real slug', () => {
    const t = loadTemplate('trial-day-107');
    expect(t.subject).toMatch(/days left/);
    expect(t.html).toMatch(/{{ownerName}}/);
    expect(t.text).toMatch(/{{conversionUrl}}/);
  });

  it('throws on a missing slug', () => {
    expect(() => loadTemplate('does-not-exist')).toThrow(
      /Failed to load email template 'does-not-exist'/,
    );
  });
});

describe('renderTemplate', () => {
  const tpl = {
    slug: 'inline-test',
    subject: 'Hi {{ownerName}} — {{daysRemaining}} days left',
    html: '<p>Saved ₹{{savingsAmount}}</p>',
    text: 'Saved {{savingsAmount}}',
  };

  it('interpolates every placeholder', () => {
    const r = renderTemplate(tpl, {
      ownerName: 'Asha',
      daysRemaining: 7,
      savingsAmount: 1240,
    });
    expect(r.subject).toBe('Hi Asha — 7 days left');
    expect(r.html).toBe('<p>Saved ₹1240</p>');
    expect(r.text).toBe('Saved 1240');
  });

  it('throws strictly when a placeholder has no value', () => {
    expect(() =>
      renderTemplate(tpl, { ownerName: 'Asha', daysRemaining: 7 } as never),
    ).toThrow(/placeholder \{\{savingsAmount\}\} has no value/);
  });

  it('ignores extra vars not referenced in the template', () => {
    const r = renderTemplate(tpl, {
      ownerName: 'Asha',
      daysRemaining: 7,
      savingsAmount: 1240,
      unused: 'fine',
    });
    expect(r.subject).toContain('Asha');
  });
});

describe('all seeded trial templates render', () => {
  for (const slug of ['trial-day-107', 'trial-day-117', 'trial-day-118']) {
    it(`${slug} interpolates the standard vars`, () => {
      const t = loadTemplate(slug);
      const r = renderTemplate(t, {
        ownerName: 'Asha',
        daysRemaining: 7,
        savingsAmount: 1240,
        conversionUrl: 'https://app.gojo.in/billing/upgrade',
      });
      expect(r.subject).not.toMatch(/\{\{/);
      expect(r.html).not.toMatch(/\{\{/);
      expect(r.text).not.toMatch(/\{\{/);
    });
  }
});
