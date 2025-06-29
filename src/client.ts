import { RequestOptions, APIResponse } from "./types/common";
import { APIError, APIConnectionError, APITimeoutError, APIUserAbortError } from "./core/errors";
import { Chat } from "./resources/chat/chat";
import { Completions } from "./resources/completions";
import { withRetry, extractRequestId } from "./core/utils";

/**
 * Опции для инициализации NeuroApi клиента
 */
export interface NeuroApiOptions {
  /** Базовый URL API сервера */
  baseURL?: string;
  /** API ключ для аутентификации */
  apiKey: string;
  /** Таймаут запроса в миллисекундах (по умолчанию 60000) */
  timeout?: number;
  /** Дополнительные заголовки HTTP */
  defaultHeaders?: Record<string, string>;
}

/**
 * Основной клиент для работы с NeuroApi
 * Предоставляет OpenAI-совместимый интерфейс для работы с чат-ботами
 */
export class NeuroApi {
  private baseURL: string;
  private apiKey: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;

  /** Ресурс для работы с чат-комплишнами */
  public chat: Chat;
  /** Ресурс для работы с legacy completions */
  public completions: Completions;

  /**
   * Создает новый экземпляр NeuroApi клиента
   * @param options - Опции конфигурации клиента
   */
  constructor(options: NeuroApiOptions) {
    this.baseURL = options.baseURL?.replace(/\/$/, "") || "https://neuroapi.host/v1";
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 60000;
    this.defaultHeaders = options.defaultHeaders || {};

    this.chat = new Chat(this);
    this.completions = new Completions(this);
  }

  /**
   * Выполняет HTTP запрос к API с автоматическим retry
   * @param endpoint - Конечная точка API
   * @param data - Данные для отправки
   * @param options - Опции запроса
   * @returns Десериализованный ответ API
   */
  public async makeRequest<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
    const requestFn = async (): Promise<T> => {
      return await this._makeRequest<T>(endpoint, data, options);
    };

    if (options.retry === false) {
      return await requestFn();
    }

    return await withRetry(requestFn, options.retry);
  }

  /**
   * Выполняет HTTP запрос с доступом к полному Response объекту
   * @param endpoint - Конечная точка API
   * @param data - Данные для отправки
   * @param options - Опции запроса
   * @returns Объект с данными, Response и request ID
   */
  public async makeRequestWithResponse<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<APIResponse<T>> {
    const requestFn = async (): Promise<APIResponse<T>> => {
      return await this._makeRequestWithResponse<T>(endpoint, data, options);
    };

    if (options.retry === false) {
      return await requestFn();
    }

    return await withRetry(requestFn, options.retry);
  }

  private async _makeRequest<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
    const response = await this._makeRequestWithResponse<T>(endpoint, data, options);
    return response.data;
  }

  private async _makeRequestWithResponse<T>(endpoint: string, data: any, options: RequestOptions = {}): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || this.timeout;

    const controller = new AbortController();
    const signal = options.signal || controller.signal;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...this.defaultHeaders,
        ...options.headers,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }

        throw new APIError(response.status, response.statusText, errorBody);
      }

      const responseData = await response.json();
      const requestId = extractRequestId(response);

      return {
        data: responseData,
        response: response,
        requestId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          if (signal?.aborted && signal !== controller.signal) {
            throw new APIUserAbortError();
          }
          throw new APITimeoutError(`Request timed out after ${timeout}ms`);
        }

        if (error.message.includes("fetch")) {
          throw new APIConnectionError(`Connection failed: ${error.message}`);
        }
      }

      throw error;
    }
  }
}
