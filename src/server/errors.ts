export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public message_key?: string,
    public params?: Record<string, string | number>,
  ) {
    super(message);
  }
}
export function requireThat(
  condition: unknown,
  message: string,
  status = 400,
  code = "VALIDATION",
): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export function text(value: unknown, label: string, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new AppError(400, 'VALIDATION', `${label}: укажите текст до ${max} символов`, 'error.text', { max });
  return value.trim();
}
