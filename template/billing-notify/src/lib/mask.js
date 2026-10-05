// Recipients are customer PII. Log them only through maskRecipient().
//   asha.k@example.com → as****@example.com
//   +919812345678      → +91******5678
//   device tokens      → first 4 chars + ****
export function maskRecipient(value) {
  if (typeof value !== 'string' || value.length === 0) return '****';
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}****@${domain}`;
  }
  if (/^\+\d{8,15}$/.test(value)) {
    return `${value.slice(0, 3)}${'*'.repeat(value.length - 7)}${value.slice(-4)}`;
  }
  return `${value.slice(0, 4)}****`;
}
