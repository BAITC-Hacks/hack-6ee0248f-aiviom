export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
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
  requireThat(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    `${label}: укажите текст до ${max} символов`,
  );
  return value.trim();
}
