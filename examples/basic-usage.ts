import { NeuroApi } from "../src/index";

async function main() {
  const client = new NeuroApi({
    apiKey: "api-key",
  });

  try {
    // Chat Completions example
    const chatResponse = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello! How are you today?" },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    console.log("Chat response:", chatResponse.choices[0].message.content);

    // Streaming example
    console.log("\nStreaming example:");
    const stream = await client.chat.completions.stream({
      model: "gpt-4.1-nano",
      messages: [{ role: "user", content: "Tell me a short story about a robot." }],
    });

    // Listen to streaming events
    stream.on("content.delta", (event) => {
      process.stdout.write(event.delta);
    });

    stream.on("content.done", (event) => {
      console.log("\n\nFinal content:", event.content);
    });

    stream.on("error", (error) => {
      console.error("Stream error:", error);
    });

    // Wait for stream to complete
    await stream.done();

    // Get final content
    const finalContent = await stream.finalContent();
    console.log("Retrieved final content:", finalContent);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
