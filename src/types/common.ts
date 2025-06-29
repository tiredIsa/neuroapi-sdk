export interface APIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface APIResponse<T> {
  data: T;
  response: Response;
  requestId?: string;
}

export interface RetryOptions {
  maxRetries?: number;
  exponentialBase?: number;
  maxRetryDelay?: number;
  jitter?: boolean;
}

export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retry?: RetryOptions | false;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export type FinishReason = "stop" | "length" | "content_filter" | "tool_calls";
