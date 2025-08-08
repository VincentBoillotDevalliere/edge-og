export {};

/**
 * Structured logging utility
 * Emits JSON logs with required keys: event, duration_ms, status, request_id
 */
export interface LogData {
  event: string;
  duration_ms?: number;
  status?: number;
  request_id?: string;
  [key: string]: unknown;
}

export function log(data: LogData): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data,
  }));
}

export function logRequest(
  event: string,
  startTime: number,
  status: number,
  requestId: string,
  additionalData: Record<string, unknown> = {}
): void {
  const duration_ms = Date.now() - startTime;
  
  log({
    event,
    duration_ms,
    status,
    request_id: requestId,
    ...additionalData,
  });
}
