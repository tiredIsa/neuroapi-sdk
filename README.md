# NeuroApi - OpenAI-compatible API Client

TypeScript/JavaScript клиент для OpenAI-совместимых API, разработанный с использованием Bun runtime.

## Особенности

- ✅ **OpenAI-совместимый** - полная совместимость с Chat Completions API
- ✅ **Streaming поддержка** - реальное время с Server-Sent Events
- ✅ **TypeScript-first** - полная типизация
- ✅ **Zero dependencies** - использует встроенный fetch API
- ✅ **Event-driven архитектура** - для streaming ответов
- ✅ **Обработка ошибок** - детальные классы ошибок
- ✅ **Retry логика** - автоматические повторы с экспоненциальным backoff
- ✅ **Request ID трекинг** - для debugging и мониторинга
- ✅ **Function calling** - поддержка инструментов
- ✅ **Bun оптимизирован** - быстрая разработка и тестирование

## Установка

```bash
npm install neuro-api
# или
yarn add neuro-api
# или
bun add neuro-api
```

## Быстрый старт

```typescript
import { NeuroApi } from "neuro-api";

const client = new NeuroApi({
  baseURL: "https://api.your-service.com",
  apiKey: "your-api-key",
});

// Chat Completions
const response = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
  ],
});

console.log(response.choices[0].message.content);
```

## withResponse - Доступ к метаданным

Получите полный HTTP response с headers и request ID:

```typescript
const response = await client.chat.completions.withResponse({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log("Request ID:", response.requestId);
console.log("HTTP Status:", response.response.status);
console.log("Headers:", response.response.headers);
console.log("Data:", response.data.choices[0].message.content);
```

## Retry логика

Автоматические повторы при временных ошибках:

```typescript
const client = new NeuroApi({
  apiKey: "your-api-key",
  baseURL: "https://api.your-service.com",
});

// Retry будет автоматически применен при 429, 500, 502, 503, 504 ошибках
const response = await client.chat.completions.create({...});

// Отключение retry для конкретного запроса
const response2 = await client.makeRequest("/endpoint", data, {
  retry: false
});

// Кастомные настройки retry
const response3 = await client.makeRequest("/endpoint", data, {
  retry: {
    maxRetries: 5,
    exponentialBase: 2,
    maxRetryDelay: 60000,
    jitter: true
  }
});
```

## Function Calling

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
    },
  },
];

const response = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "What's the weather in Moscow?" }],
  tools,
  tool_choice: "auto",
});

if (response.choices[0].message.tool_calls) {
  // Обработка вызовов функций
  for (const toolCall of response.choices[0].message.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await handleFunction(toolCall.function.name, args);

    // Отправка результата обратно в модель
    const followUp = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: "What's the weather in Moscow?" },
        response.choices[0].message,
        {
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        },
      ],
    });
  }
}
```

## Streaming

```typescript
// Создание streaming запроса
const stream = await client.chat.completions.stream({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Tell me a story." }],
});

// Обработка событий
stream.on("content.delta", (event) => {
  process.stdout.write(event.delta);
});

stream.on("content.done", (event) => {
  console.log("\nFinal content:", event.content);
});

stream.on("tool_calls.function.arguments.delta", (event) => {
  console.log("Tool call progress:", event.toolCall);
});

stream.on("error", (error) => {
  console.error("Error:", error);
});

// Прерывание stream
setTimeout(() => stream.abort(), 5000);

// Ожидание завершения
await stream.done();

// Получение финального контента
const finalContent = await stream.finalContent();
```

## API Reference

### Client Options

```typescript
interface NeuroApiOptions {
  baseURL?: string; // API endpoint URL (по умолчанию: https://neuroapi.host/v1)
  apiKey: string; // API ключ
  timeout?: number; // Timeout в мс (по умолчанию 60000)
  defaultHeaders?: Record<string, string>; // Дополнительные заголовки
}
```

### Request Options

```typescript
interface RequestOptions {
  timeout?: number; // Кастомный timeout для запроса
  headers?: Record<string, string>; // Дополнительные headers
  signal?: AbortSignal; // AbortController signal
  retry?: RetryOptions | false; // Настройки retry или отключение
}

interface RetryOptions {
  maxRetries?: number; // Максимум попыток (по умолчанию 3)
  exponentialBase?: number; // База для экспоненциального backoff (по умолчанию 2)
  maxRetryDelay?: number; // Максимальная задержка в мс (по умолчанию 60000)
  jitter?: boolean; // Случайный jitter (по умолчанию true)
}
```

### Chat Completions

```typescript
// Создание completion
await client.chat.completions.create(params);

// С доступом к response метаданным
await client.chat.completions.withResponse(params);

// Streaming completion
await client.chat.completions.stream(params);
```

### Legacy Completions

```typescript
// Поддержка legacy API
await client.completions.create({
  model: "gpt-3.5-turbo",
  prompt: "Complete this text...",
});

// С метаданными
await client.completions.withResponse({...});
```

## Обработка ошибок

```typescript
import { APIError, APIConnectionError, APITimeoutError, APIUserAbortError } from 'neuro-api';

try {
  const response = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof APIError) {
    console.log('HTTP Error:', error.status, error.statusText);
    console.log('Error body:', error.body);
  } else if (error instanceof APIConnectionError) {
    console.log('Connection failed:', error.message);
  } else if (error instanceof APITimeoutError) {
    console.log('Request timed out:', error.message);
  } else if (error instanceof APIUserAbortError) {
    console.log('Request was aborted by user');
  }
}
```

## Streaming Events

| Event                                 | Description                          |
| ------------------------------------- | ------------------------------------ |
| `content.delta`                       | Новый кусок контента получен         |
| `content.done`                        | Весь контент получен                 |
| `tool_calls.function.arguments.delta` | Аргументы функции получаются частями |
| `tool_calls.function.arguments.done`  | Аргументы функции полностью получены |
| `logprobs.content.delta`              | Log probabilities получаются частями |
| `logprobs.content.done`               | Log probabilities полностью получены |
| `chunk`                               | Сырой chunk от API                   |
| `error`                               | Ошибка в процессе streaming          |
| `end`                                 | Streaming завершен                   |
| `abort`                               | Streaming прерван                    |

## Примеры

Посмотрите полные примеры в папке `/examples`:

- [`basic-usage.ts`](./examples/basic-usage.ts) - Базовое использование с streaming
- [`function-calling-example.ts`](./examples/function-calling-example.ts) - Function calling с инструментами
- [`tool-calling-example.ts`](./examples/tool-calling-example.ts) - Tool calling примеры
- [`error-handling-example.ts`](./examples/error-handling-example.ts) - Обработка ошибок и retry

Запуск примеров:

```bash
# С Bun
bun run examples/basic-usage.ts

# С Node.js (после сборки)
npm run build
node dist/examples/basic-usage.js
```

## Утилиты

```typescript
import { extractRequestId, isRetryableError, withRetry } from "neuro-api";

// Извлечение Request ID из response
const requestId = extractRequestId(response);

// Проверка возможности retry для ошибки
const canRetry = isRetryableError(error);

// Ручная обертка функции в retry логику
const result = await withRetry(
  async () => {
    return await someAPICall();
  },
  { maxRetries: 3 }
);
```

## Разработка

```bash
# Установка зависимостей
bun install

# Разработка с watch
bun run dev

# Тестирование
bun test

# Сборка
bun run build

# Публикация
npm publish
```

## Совместимость

- **Node.js** 16+
- **Bun** 1.0+
- **Browsers** (с полифиллом fetch при необходимости)

## Лицензия

MIT
