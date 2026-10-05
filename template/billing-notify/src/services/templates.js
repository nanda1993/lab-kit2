import { AppError } from '../lib/app-error.js';

// Billing notice templates. `subject` is used by channels that have one (email, push title).
const TEMPLATES = {
  'bill-ready': d => ({
    subject: 'Your Kestrel Mobile bill is ready',
    body: `Your bill of ${d.amount} is ready. It is due on ${d.dueDate}.`,
  }),
  'payment-due': d => ({
    subject: 'Payment reminder',
    body: `A payment of ${d.amount} is due on ${d.dueDate}. Pay in the Kestrel app to avoid a late fee.`,
  }),
  'payment-failed': d => ({
    subject: 'Your payment did not go through',
    body: `We could not collect ${d.amount}. Please update your payment method by ${d.dueDate} to keep your service active.`,
  }),
};

export function renderTemplate(name, data = {}) {
  const tpl = TEMPLATES[name];
  if (!tpl) throw new AppError('UNKNOWN_TEMPLATE', `Unknown template "${name}"`);
  for (const field of ['amount', 'dueDate']) {
    if (data[field] === undefined) throw new AppError('VALIDATION_FAILED', `Template "${name}" needs data.${field}`);
  }
  return tpl(data);
}

export const templateNames = Object.keys(TEMPLATES);
