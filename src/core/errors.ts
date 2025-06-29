export class NeuroApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeuroApiError";
  }
}

export class APIError extends NeuroApiError {
  public status: number;
  public statusText: string;
  public body?: any;

  constructor(status: number, statusText: string, body?: any) {
    const message = `HTTP ${status}: ${statusText}`;
    super(message);
    this.name = "APIError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class APIConnectionError extends NeuroApiError {
  constructor(message: string) {
    super(message);
    this.name = "APIConnectionError";
  }
}

export class APITimeoutError extends NeuroApiError {
  constructor(message: string) {
    super(message);
    this.name = "APITimeoutError";
  }
}

export class APIUserAbortError extends NeuroApiError {
  constructor(message: string = "Request was aborted") {
    super(message);
    this.name = "APIUserAbortError";
  }
}
