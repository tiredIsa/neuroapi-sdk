# NeuroApi - OpenAI-compatible API Client

TypeScript/JavaScript клиент для OpenAI-совместимых API, разработанный с использованием Bun runtime.

## Особенности

- ✅ **OpenAI-совместимый** - полная совместимость с Chat Completions API
- ✅ **Images API** - генерация, редактирование и вариации изображений
- ✅ **Streaming поддержка** - реальное время с Server-Sent Events
- ✅ **TypeScript-first** - полная типизация
- ✅ **Zero dependencies** - использует встроенный fetch API
- ✅ **Event-driven архитектура** - для streaming ответов
- ✅ **Обработка ошибок** - детальные классы ошибок
- ✅ **Retry логика** - автоматические повторы с экспоненциальным backoff
- ✅ **Request ID трекинг** - для debugging и мониторинга
- ✅ **Function calling** - поддержка инструментов

## Установка

```bash
npm install neuroapi
# или
yarn add neuroapi
# или
bun add neuroapi
```

## Быстрый старт

```typescript
import { NeuroApi } from "neuroapi";

const client = new NeuroApi({
  apiKey: "your-api-key",
});

// Chat Completions
const response = await client.chat.completions.create({
  model: "gpt-4.1-nano",
  messages: [
    { role: "system", content: "Ты девушка ассистент по имени Юна." },
    { role: "user", content: "Привет Юна!" },
  ],
});

console.log(response.choices[0].message.content);
```

## withResponse - Доступ к метаданным

Получите полный HTTP response с headers и request ID:

```typescript
const response = await client.chat.completions.withResponse({
  model: "gpt-4.1-nano",
  messages: [{ role: "user", content: "Привет!" }],
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
  model: "gpt-4.1-nano",
  messages: [{ role: "user", content: "Какая погода в москве?" }],
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
        { role: "user", content: "Какая погода в москве?" },
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
  model: "gpt-4.1-nano",
  messages: [{ role: "user", content: "Перескажи сюжет фильма 'Матрица'." }],
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

## Images API

### Генерация изображений

```typescript
// Генерация изображения DALL-E 3
const imageResponse = await client.images.generate({
  prompt: "A futuristic city with flying cars at sunset",
  model: "dall-e-3",
  size: "1024x1024",
  quality: "hd",
  style: "vivid",
  n: 1,
});

console.log("URL изображения:", imageResponse.data[0].url);
console.log("Доработанный промпт:", imageResponse.data[0].revised_prompt);

// Генерация нескольких изображений DALL-E 2
const multipleImages = await client.images.generate({
  prompt: "A cute cat playing with a ball",
  model: "dall-e-2",
  size: "512x512",
  n: 4,
});

multipleImages.data.forEach((image, index) => {
  console.log(`Изображение ${index + 1}:`, image.url);
});
```

### Получение base64 изображений

```typescript
const base64Response = await client.images.generate({
  prompt: "A simple geometric pattern",
  model: "dall-e-2",
  size: "256x256",
  response_format: "b64_json",
  n: 1,
});

const base64Image = base64Response.data[0].b64_json;
// Сохранение или использование base64 изображения
```

### Редактирование изображений

```typescript
import { readFileSync } from "fs";

// Подготовка файлов
const imageFile = readFileSync("original.png");
const maskFile = readFileSync("mask.png"); // Белые области - редактируемые

const editedImage = await client.images.edit({
  image: new Blob([imageFile]),
  mask: new Blob([maskFile]),
  prompt: "Add a rainbow in the sky",
  model: "dall-e-2",
  size: "1024x1024",
  n: 1,
});

console.log("Отредактированное изображение:", editedImage.data[0].url);
```

### Создание вариаций

```typescript
import { readFileSync } from "fs";

const imageFile = readFileSync("source.png");

const variations = await client.images.createVariation({
  image: new Blob([imageFile]),
  model: "dall-e-2",
  size: "1024x1024",
  n: 3,
});

variations.data.forEach((variation, index) => {
  console.log(`Вариация ${index + 1}:`, variation.url);
});
```

### Использование с метаданными

```typescript
const response = await client.images.withResponse({
  prompt: "A beautiful landscape",
  model: "dall-e-3",
  size: "1024x1024",
});

console.log("Request ID:", response.requestId);
console.log("HTTP Status:", response.response.status);
console.log("Изображение:", response.data.data[0].url);
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
  model: "gpt-4.1-nano",
  prompt: "Complete this text...",
});

// С метаданными
await client.completions.withResponse({...});
```

### Images API

```typescript
// Генерация изображений
await client.images.generate({
  prompt: "A beautiful landscape",
  model: "dall-e-3",
  size: "1024x1024",
  quality: "hd",
  style: "vivid"
});

// С метаданными
await client.images.withResponse({...});

// Редактирование изображений
await client.images.edit({
  image: imageBlob,
  mask: maskBlob,
  prompt: "Add a rainbow"
});

// Создание вариаций
await client.images.createVariation({
  image: imageBlob,
  n: 3
});
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
- [`images-example.ts`](./examples/images-example.ts) - Генерация и редактирование изображений
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
