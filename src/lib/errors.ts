export class AppError extends Error {
  constructor(message: string, readonly code = "INVALID_OPERATION") {
    super(message);
    this.name = "AppError";
  }
}
