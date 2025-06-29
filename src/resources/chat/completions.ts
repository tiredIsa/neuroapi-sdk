import { ChatCompletion, ChatCompletionCreateParams, ChatCompletionMessageParam } from "../../types/chat";
import { APIResponse } from "../../types/common";
import { NeuroApi } from "../../client";
import { ChatCompletionStreamingRunner } from "./streaming";

/**
 * Ресурс для работы с Chat Completions API
 * Предоставляет методы для создания чат-комплишнов с поддержкой streaming
 */
export class ChatCompletions {
  private client: NeuroApi;

  constructor(client: NeuroApi) {
    this.client = client;
  }

  /**
   * Создает новый chat completion
   * @param params - Параметры для создания чат-комплишна
   * @returns Promise с объектом ChatCompletion
   * @throws {Error} При невалидных параметрах или если указан stream: true
   */
  async create(params: ChatCompletionCreateParams): Promise<ChatCompletion> {
    this.validateParams(params);

    if (params.stream) {
      throw new Error("Use stream() method for streaming requests");
    }

    const response = await this.client.makeRequest<ChatCompletion>("/chat/completions", params);

    return response;
  }

  /**
   * Создает chat completion с доступом к полному HTTP response
   * @param params - Параметры для создания чат-комплишна
   * @returns Promise с объектом APIResponse<ChatCompletion>
   * @throws {Error} При невалидных параметрах или если указан stream: true
   */
  async withResponse(params: ChatCompletionCreateParams): Promise<APIResponse<ChatCompletion>> {
    this.validateParams(params);

    if (params.stream) {
      throw new Error("Use stream() method for streaming requests");
    }

    const response = await this.client.makeRequestWithResponse<ChatCompletion>("/chat/completions", params);

    return response;
  }

  /**
   * Создает streaming chat completion
   * @param params - Параметры для создания чат-комплишна (без stream флага)
   * @returns Promise с ChatCompletionStreamingRunner для обработки stream
   * @throws {Error} При невалидных параметрах
   */
  async stream(params: Omit<ChatCompletionCreateParams, "stream">): Promise<ChatCompletionStreamingRunner> {
    const streamParams = { ...params, stream: true };
    this.validateParams(streamParams);

    return await this.createStreamingRequest(streamParams);
  }

  private async createStreamingRequest(params: ChatCompletionCreateParams): Promise<ChatCompletionStreamingRunner> {
    const url = `${(this.client as any).baseURL}/chat/completions`;

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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return new ChatCompletionStreamingRunner(response);
  }

  private validateParams(params: ChatCompletionCreateParams): void {
    if (!params.model) {
      throw new Error("model is required");
    }

    if (!params.messages || params.messages.length === 0) {
      throw new Error("messages is required and must not be empty");
    }

    this.validateMessages(params.messages);

    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 2)) {
      throw new Error("temperature must be between 0 and 2");
    }

    if (params.top_p !== undefined && (params.top_p < 0 || params.top_p > 1)) {
      throw new Error("top_p must be between 0 and 1");
    }

    if (params.max_tokens !== undefined && params.max_tokens < 1) {
      throw new Error("max_tokens must be greater than 0");
    }

    if (params.tools) {
      this.validateTools(params.tools);
    }

    if (params.tool_choice) {
      this.validateToolChoice(params.tool_choice, params.tools);
    }

    if (params.response_format) {
      this.validateResponseFormat(params.response_format);
    }

    if (params.logprobs !== undefined || params.top_logprobs !== undefined) {
      this.validateLogProbs(params.logprobs, params.top_logprobs);
    }
  }

  private validateMessages(messages: ChatCompletionMessageParam[]): void {
    for (const message of messages) {
      if (!message.role) {
        throw new Error("Each message must have a role");
      }

      if (!["user", "assistant", "system", "tool"].includes(message.role)) {
        throw new Error("Invalid message role");
      }

      if (message.role === "tool" && !message.tool_call_id) {
        throw new Error("Tool messages must have tool_call_id");
      }
    }
  }

  private validateTools(tools: any[]): void {
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error("tools must be a non-empty array");
    }

    for (const tool of tools) {
      if (!tool.type || tool.type !== "function") {
        throw new Error("All tools must have type 'function'");
      }

      if (!tool.function || !tool.function.name) {
        throw new Error("All tools must have a function with a name");
      }

      if (tool.function.parameters) {
        try {
          if (typeof tool.function.parameters !== "object") {
            throw new Error("Tool function parameters must be a valid JSON schema object");
          }
        } catch (error) {
          throw new Error("Tool function parameters must be a valid JSON schema object");
        }
      }
    }
  }

  private validateToolChoice(toolChoice: any, tools?: any[]): void {
    if (typeof toolChoice === "string") {
      if (!["none", "auto", "required"].includes(toolChoice)) {
        throw new Error("tool_choice must be 'none', 'auto', 'required', or a specific tool");
      }
    } else if (typeof toolChoice === "object" && toolChoice !== null) {
      if (!toolChoice.type || toolChoice.type !== "function") {
        throw new Error("Named tool choice must have type 'function'");
      }
      if (!toolChoice.function || !toolChoice.function.name) {
        throw new Error("Named tool choice must specify function name");
      }

      if (tools) {
        const toolExists = tools.some((tool) => tool.function?.name === toolChoice.function.name);
        if (!toolExists) {
          throw new Error(`Tool '${toolChoice.function.name}' not found in tools array`);
        }
      }
    } else {
      throw new Error("tool_choice must be a string or object");
    }
  }

  private validateResponseFormat(responseFormat: any): void {
    if (!responseFormat.type) {
      throw new Error("response_format must have a type");
    }

    if (!["text", "json_object"].includes(responseFormat.type)) {
      throw new Error("response_format type must be 'text' or 'json_object'");
    }
  }

  private validateLogProbs(logprobs?: boolean, topLogprobs?: number): void {
    if (topLogprobs !== undefined && !logprobs) {
      throw new Error("top_logprobs requires logprobs to be true");
    }

    if (topLogprobs !== undefined && (topLogprobs < 0 || topLogprobs > 20)) {
      throw new Error("top_logprobs must be between 0 and 20");
    }
  }
}
