// Every AppError code the service can raise, with the HTTP status it maps to.
// Add a code here before using it.
export const ERROR_CODES = Object.freeze({
  UNAUTHORIZED:         { status: 401 },
  VALIDATION_FAILED:    { status: 400 },
  UNKNOWN_CHANNEL:      { status: 400 },
  UNKNOWN_TEMPLATE:     { status: 400 },
  INVALID_RECIPIENT:    { status: 400 },
  NOT_FOUND:            { status: 404 },
  DUPLICATE_DISPATCH:   { status: 409 },
  RATE_LIMITED:         { status: 429 },
  PROVIDER_UNAVAILABLE: { status: 502 },
  PROVIDER_REJECTED:    { status: 502 },
  INTERNAL:             { status: 500 },
});
