import { NeuroApi, APIError, APIConnectionError, APITimeoutError, APIUserAbortError } from "../src/index";

const client = new NeuroApi({
  apiKey: process.env.NEUROAPI_KEY || "invalid-key",
  baseURL: "https://neuroapi.host/v1",
  timeout: 5000, // Короткий таймаут для демонстрации
});

async function basicErrorHandling() {
  console.log("🚨 Пример базовой обработки ошибок\n");

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Привет!" }],
    });

    console.log("✅ Успешный ответ:", response.choices[0].message.content);
  } catch (error) {
    if (error instanceof APIError) {
      console.log("❌ API Ошибка:");
      console.log(`   Статус: ${error.status}`);
      console.log(`   Сообщение: ${error.message}`);
      console.log(`   Детали:`, error.body);
    } else if (error instanceof APIConnectionError) {
      console.log("🌐 Ошибка соединения:", error.message);
    } else if (error instanceof APITimeoutError) {
      console.log("⏱️ Таймаут:", error.message);
    } else {
      console.log("🔴 Неизвестная ошибка:", error);
    }
  }
}

async function validationErrorsDemo() {
  console.log("\n📋 Демонстрация ошибок валидации\n");

  const invalidCases = [
    {
      name: "Пустая модель",
      params: { model: "", messages: [{ role: "user" as const, content: "test" }] },
    },
    {
      name: "Пустые сообщения",
      params: { model: "gpt-3.5-turbo", messages: [] },
    },
    {
      name: "Невалидная температура",
      params: {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user" as const, content: "test" }],
        temperature: 3.0,
      },
    },
    {
      name: "Невалидный top_p",
      params: {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user" as const, content: "test" }],
        top_p: 1.5,
      },
    },
    {
      name: "Невалидный max_tokens",
      params: {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user" as const, content: "test" }],
        max_tokens: 0,
      },
    },
  ];

  for (const testCase of invalidCases) {
    try {
      await client.chat.completions.create(testCase.params as any);
      console.log(`❌ ${testCase.name}: Ошибка НЕ произошла (должна была)`);
    } catch (error) {
      console.log(`✅ ${testCase.name}: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`);
    }
  }
}

async function retryDemo() {
  console.log("\n🔄 Демонстрация retry логики\n");

  // Клиент с настройками retry
  const retryClient = new NeuroApi({
    apiKey: "invalid-key", // Намеренно невалидный ключ
    baseURL: "https://httpstat.us/500", // URL который всегда возвращает 500
  });

  try {
    const response = await retryClient.makeRequest("/test", {});
    console.log("Неожиданный успех:", response);
  } catch (error) {
    if (error instanceof APIError) {
      console.log(`🔄 После нескольких попыток retry получили ошибку: ${error.status} ${error.message}`);
    } else {
      console.log("🔄 Retry не помог:", error instanceof Error ? error.message : error);
    }
  }
}

async function abortDemo() {
  console.log("\n⏹️ Демонстрация отмены запроса\n");

  const controller = new AbortController();

  // Отменяем запрос через 1 секунду
  setTimeout(() => {
    console.log("⏹️ Отменяем запрос...");
    controller.abort();
  }, 1000);

  try {
    const response = await client.makeRequest(
      "/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Долгий запрос..." }],
      },
      {
        signal: controller.signal,
      }
    );

    console.log("Неожиданный успех:", response);
  } catch (error) {
    if (error instanceof APIUserAbortError) {
      console.log("✅ Запрос был успешно отменен пользователем");
    } else if (error instanceof APITimeoutError) {
      console.log("⏱️ Запрос был отменен по таймауту");
    } else {
      console.log("❌ Другая ошибка при отмене:", error instanceof Error ? error.message : error);
    }
  }
}

async function withResponseDemo() {
  console.log("\n📊 Демонстрация withResponse для получения метаданных\n");

  try {
    const response = await client.chat.completions.withResponse({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Привет!" }],
    });

    console.log("✅ Успешный ответ с метаданными:");
    console.log(`   Request ID: ${response.requestId || "не найден"}`);
    console.log(`   Статус: ${response.response.status}`);
    console.log(`   Заголовки:`, Object.fromEntries(response.response.headers.entries()));
    console.log(`   Данные:`, response.data.choices[0].message.content);
  } catch (error) {
    if (error instanceof APIError) {
      console.log("❌ API ошибка в withResponse:");
      console.log(`   Статус: ${error.status}`);
      console.log(`   Детали:`, error.body);
    } else {
      console.log("❌ Другая ошибка:", error instanceof Error ? error.message : error);
    }
  }
}

async function streamingErrorDemo() {
  console.log("\n🌊 Демонстрация ошибок в streaming\n");

  try {
    const stream = await client.chat.completions.stream({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Расскажи длинную историю" }],
    });

    stream.on("error", (error) => {
      console.log("❌ Ошибка в stream:", error.message);
    });

    stream.on("abort", () => {
      console.log("⏹️ Stream был прерван");
    });

    stream.on("content.delta", (event) => {
      process.stdout.write(event.delta);
    });

    stream.on("end", () => {
      console.log("\n✅ Stream завершен успешно");
    });

    // Прерываем stream через 2 секунды
    setTimeout(() => {
      console.log("\n⏹️ Прерываем stream...");
      stream.abort();
    }, 2000);
  } catch (error) {
    console.log("❌ Ошибка при создании stream:", error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log("🔧 NeuroApi Error Handling Examples\n");
  console.log("=".repeat(50));

  await basicErrorHandling();
  await validationErrorsDemo();
  await retryDemo();
  await abortDemo();
  await withResponseDemo();
  await streamingErrorDemo();

  console.log("\n" + "=".repeat(50));
  console.log("✅ Все примеры обработки ошибок завершены");
}

main().catch(console.error);
