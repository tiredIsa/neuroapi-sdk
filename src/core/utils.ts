import { RetryOptions } from "../types/common";
import { APIError } from "./errors";

export function extractRequestId(response: Response): string | undefined {
  return response.headers.get("x-request-id") || response.headers.get("request-id") || response.headers.get("cf-ray") || undefined;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof APIError) {
    // Retry на rate limits и временных ошибках сервера
    return error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504;
  }

  // Retry на сетевых ошибках
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("fetch") || error.message.includes("network");
  }

  return false;
}

export function calculateRetryDelay(attempt: number, options: RetryOptions = {}): number {
  const { exponentialBase = 2, maxRetryDelay = 60000, jitter = true } = options;

  let delay = Math.min(1000 * Math.pow(exponentialBase, attempt - 1), maxRetryDelay);

  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3 } = options;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries + 1 || !isRetryableError(error)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt, options);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Retry logic failed unexpectedly");
}
