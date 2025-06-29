import { NeuroApi } from "../src";

async function toolCallingExample() {
  const client = new NeuroApi({
    apiKey: "api-key",
  });

  // Определяем доступные инструменты
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "get_weather",
        description: "Get current weather in a given location",
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
    {
      type: "function" as const,
      function: {
        name: "calculate_math",
        description: "Calculate mathematical expressions",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Mathematical expression to evaluate",
            },
          },
          required: ["expression"],
        },
      },
    },
  ];

  try {
    // Обычный запрос с tool calling
    console.log("=== Non-streaming Tool Calling ===");
    const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: "What's the weather like in San Francisco and what's 15 + 27?",
        },
      ],
      tools: tools,
      tool_choice: "auto",
    });

    console.log("Response:", response);
    if (response.choices[0].message.tool_calls) {
      console.log("Tool calls:", response.choices[0].message.tool_calls);
    }

    // Streaming запрос с tool calling
    console.log("\n=== Streaming Tool Calling ===");
    const stream = await client.chat.completions.stream({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: "Calculate 100 * 25 and tell me the weather in New York",
        },
      ],
      tools: tools,
      tool_choice: "auto",
    });

    stream.on("content.delta", (event) => {
      console.log("Content delta:", event.delta);
    });

    stream.on("tool_calls.function.arguments.delta", (event) => {
      console.log(`Tool call ${event.index} delta:`, event.toolCall);
    });

    stream.on("tool_calls.function.arguments.done", (event) => {
      console.log(`Tool call ${event.index} completed:`, event.toolCall);
    });

    stream.on("end", () => {
      console.log("Stream completed");
    });

    // Ждем завершения
    await stream.done();
    const finalContent = await stream.finalContent();
    const finalToolCalls = await stream.finalToolCalls();

    console.log("Final content:", finalContent);
    console.log("Final tool calls:", finalToolCalls);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function completionsStreamingExample() {
  const client = new NeuroApi({
    apiKey: "api-key",
  });

  try {
    console.log("\n=== Completions Streaming ===");
    const stream = await client.completions.stream({
      model: "gpt-4.1-nano",
      prompt: "Write a short story about a robot learning to paint:",
      max_tokens: 200,
      temperature: 0.7,
    });

    stream.on("text.delta", (event) => {
      process.stdout.write(event.delta);
    });

    stream.on("text.done", (event) => {
      console.log("\n\nFinal text:", event.text);
    });

    stream.on("end", () => {
      console.log("Stream completed");
    });

    await stream.done();
  } catch (error) {
    console.error("Error:", error);
  }
}

async function logProbsExample() {
  const client = new NeuroApi({
    apiKey: "api-key",
  });

  try {
    console.log("\n=== Log Probabilities Example ===");
    const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: "Complete this: The weather today is",
        },
      ],
      logprobs: true,
      top_logprobs: 3,
    });

    console.log("Response with logprobs:", response);
    if (response.choices[0].logprobs) {
      console.log("Log probabilities:", response.choices[0].logprobs);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Uncomment to run examples
// toolCallingExample();
// completionsStreamingExample();
// logProbsExample();
