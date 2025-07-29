export {};

/**
 * Custom error for Worker responses with HTTP status codes
 * As per coding instructions: use WorkerError helper
 */
export class WorkerError extends Error {
  public readonly statusCode: number;
  public readonly requestId?: string;

  constructor(message: string, statusCode: number = 500, requestId?: string) {
    super(message);
    this.name = 'WorkerError';
    this.statusCode = statusCode;
    this.requestId = requestId;
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: this.message,
        status: this.statusCode,
        ...(this.requestId && { request_id: this.requestId }),
      }),
      {
        status: this.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
