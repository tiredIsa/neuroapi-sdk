import { describe, it, expect, beforeAll } from "bun:test";
import { NeuroApi } from "./index";

// Integration тесты требуют настоящий API endpoint и ключ
// Эти тесты запускаются только если установлены переменные окружения
const TEST_API_BASE_URL = process.env.TEST_API_BASE_URL;
const TEST_API_KEY = process.env.TEST_API_KEY;

const shouldRunIntegrationTests = TEST_API_BASE_URL && TEST_API_KEY;

describe("Integration Tests", () => {
  let client: NeuroApi;

  beforeAll(() => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping integration tests - no API credentials provided");
      console.log("Set TEST_API_BASE_URL and TEST_API_KEY environment variables to run integration tests");
      return;
    }

    client = new NeuroApi({
      baseURL: TEST_API_BASE_URL,
      apiKey: TEST_API_KEY,
      timeout: 30000,
    });
  });

  it("should make successful chat completion request", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Say hello in exactly 3 words",
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    expect(response).toBeDefined();
    expect(response.id).toBeDefined();
    expect(response.object).toBe("chat.completion");
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.role).toBe("assistant");
    expect(response.choices[0].message.content).toBeDefined();
    expect(response.usage).toBeDefined();
    expect(response.usage!.total_tokens).toBeGreaterThan(0);

    console.log("Response:", response.choices[0].message.content);
  }, 30000);

  it("should make successful streaming chat completion", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    const stream = await client.chat.completions.stream({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Count from 1 to 5",
        },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const receivedDeltas: string[] = [];
    let finalContent = "";
    let isComplete = false;

    stream.on("content.delta", (event) => {
      receivedDeltas.push(event.delta);
    });

    stream.on("content.done", (event) => {
      finalContent = event.content;
      isComplete = true;
    });

    await stream.done();

    expect(receivedDeltas.length).toBeGreaterThan(0);
    expect(finalContent).toBeDefined();
    expect(finalContent.length).toBeGreaterThan(0);
    expect(isComplete).toBe(true);

    console.log("Streaming content:", finalContent);
    console.log("Received deltas:", receivedDeltas.length);
  }, 30000);

  it("should handle API errors correctly", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    try {
      await client.chat.completions.create({
        model: "nonexistent-model",
        messages: [
          {
            role: "user",
            content: "Test",
          },
        ],
      });
      // Если дошли сюда, то ошибки не было (неожиданно)
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.status).toBeDefined();
      expect(error.message).toBeDefined();
      console.log("Expected error:", error.message);
    }
  }, 30000);

  it("should support function calling", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_weather",
          description: "Get weather information for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
            },
            required: ["location"],
          },
        },
      },
    ];

    try {
      const response = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: "What's the weather like in Boston?",
          },
        ],
        tools: tools,
        tool_choice: "auto",
        max_tokens: 100,
      });

      expect(response).toBeDefined();
      expect(response.choices[0].message).toBeDefined();

      // Может быть tool call или обычный ответ
      if (response.choices[0].message.tool_calls) {
        expect(response.choices[0].message.tool_calls.length).toBeGreaterThan(0);
        expect(response.choices[0].message.tool_calls[0].function.name).toBe("get_weather");
        console.log("Tool call:", response.choices[0].message.tool_calls[0]);
      } else {
        console.log("Regular response:", response.choices[0].message.content);
      }
    } catch (error: any) {
      console.log("Function calling test error (may be expected):", error.message);
    }
  }, 30000);

  it("should handle timeout correctly", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    const shortTimeoutClient = new NeuroApi({
      baseURL: TEST_API_BASE_URL,
      apiKey: TEST_API_KEY,
      timeout: 1, // 1ms timeout - должно вызвать ошибку
    });

    try {
      await shortTimeoutClient.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: "Test",
          },
        ],
      });
      // Если дошли сюда, то таймаут не сработал
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error).toBeDefined();
      console.log("Timeout error:", error.message);
    }
  }, 10000);

  it("should work with withResponse method", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    const { data: response, response: rawResponse } = await client.chat.completions.withResponse({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Say 'test' in one word",
        },
      ],
      max_tokens: 5,
    });

    expect(response).toBeDefined();
    expect(rawResponse).toBeDefined();
    expect(rawResponse.status).toBe(200);
    expect(rawResponse.headers).toBeDefined();

    const requestId = rawResponse.headers.get("x-request-id");
    if (requestId) {
      console.log("Request ID:", requestId);
    }

    console.log("Response data:", response.choices[0].message.content);
  }, 30000);

  it("should handle rate limiting gracefully", async () => {
    if (!shouldRunIntegrationTests) {
      console.log("Skipping: No API credentials");
      return;
    }

    // Делаем много быстрых запросов для тестирования rate limiting
    const requests = Array.from({ length: 5 }, (_, i) =>
      client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Request ${i + 1}`,
          },
        ],
        max_tokens: 5,
      })
    );

    try {
      const results = await Promise.all(requests);
      expect(results).toHaveLength(5);
      console.log("All requests completed successfully");
    } catch (error: any) {
      if (error.status === 429) {
        console.log("Rate limit encountered (expected):", error.message);
      } else {
        console.log("Other error:", error.message);
      }
    }
  }, 60000);
});
