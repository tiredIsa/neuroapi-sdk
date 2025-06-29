import { Completion, CompletionCreateParams } from "../types/completions";
import { APIResponse } from "../types/common";
import { NeuroApi } from "../client";
import { CompletionStreamingRunner } from "./completions/streaming";

export class Completions {
  private client: NeuroApi;

  constructor(client: NeuroApi) {
    this.client = client;
  }

  async create(params: CompletionCreateParams): Promise<Completion> {
    this.validateParams(params);

    if (params.stream) {
      throw new Error("Use stream() method for streaming requests");
    }

    const response = await this.client.makeRequest<Completion>("/completions", params);

    return response;
  }

  async withResponse(params: CompletionCreateParams): Promise<APIResponse<Completion>> {
    this.validateParams(params);

    if (params.stream) {
      throw new Error("Use stream() method for streaming requests");
    }

    const response = await this.client.makeRequestWithResponse<Completion>("/completions", params);

    return response;
  }

  async stream(params: Omit<CompletionCreateParams, "stream">): Promise<CompletionStreamingRunner> {
    const streamParams = { ...params, stream: true };
    this.validateParams(streamParams);

    return await this.createStreamingRequest(streamParams);
  }

  private async createStreamingRequest(params: CompletionCreateParams): Promise<CompletionStreamingRunner> {
    const url = `${(this.client as any).baseURL}/completions`;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(this.client as any).apiKey}`,
      ...(this.client as any).defaultHeaders,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      throw new Error(`HTTP error! status: ${response.status}, body: ${JSON.stringify(errorBody)}`);
    }

    return new CompletionStreamingRunner(response);
  }

  private validateParams(params: CompletionCreateParams): void {
    if (!params.model) {
      throw new Error("model is required");
    }

    if (!params.prompt) {
      throw new Error("prompt is required");
    }

    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 2)) {
      throw new Error("temperature must be between 0 and 2");
    }

    if (params.top_p !== undefined && (params.top_p < 0 || params.top_p > 1)) {
      throw new Error("top_p must be between 0 and 1");
    }

    if (params.max_tokens !== undefined && params.max_tokens < 1) {
      throw new Error("max_tokens must be greater than 0");
    }
  }
}
