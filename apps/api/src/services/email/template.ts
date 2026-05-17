// Story 10.2b: Email template loader + strict Mustache-style renderer.
// Templates live under `apps/api/src/services/email/templates/<slug>/`:
//   subject.tpl  — single-line subject
//   html.tpl     — HTML body
//   text.tpl     — plain-text fallback
// All three files are required at load time; missing files throw on load,
// not on first send.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

export interface LoadedTemplate {
  slug: string;
  subject: string;
  html: string;
  text: string;
}

export interface TemplateVars {
  [key: string]: string | number | boolean;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function loadTemplate(slug: string): LoadedTemplate {
  const base = join(TEMPLATES_DIR, slug);
  try {
    return {
      slug,
      subject: readFileSync(join(base, 'subject.tpl'), 'utf8').trim(),
      html: readFileSync(join(base, 'html.tpl'), 'utf8'),
      text: readFileSync(join(base, 'text.tpl'), 'utf8'),
    };
  } catch (err) {
    throw new Error(
      `Failed to load email template '${slug}' from ${base}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Strict interpolation: every `{{var}}` placeholder must have a matching key
 * in `vars`, otherwise the renderer throws. This catches drift between
 * templates and call sites at send time rather than producing broken email
 * bodies in production.
 */
export function renderTemplate(template: LoadedTemplate, vars: TemplateVars): {
  subject: string;
  html: string;
  text: string;
} {
  function interpolate(input: string, field: 'subject' | 'html' | 'text'): string {
    return input.replace(PLACEHOLDER_RE, (_, key: string) => {
      if (!(key in vars)) {
        throw new Error(
          `Template '${template.slug}' ${field}: placeholder {{${key}}} has no value.`,
        );
      }
      return String(vars[key]);
    });
  }

  return {
    subject: interpolate(template.subject, 'subject'),
    html: interpolate(template.html, 'html'),
    text: interpolate(template.text, 'text'),
  };
}
