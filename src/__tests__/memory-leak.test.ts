import { describe, it, expect } from "bun:test";
import { ChatCompletionStreamingRunner } from "../resources/chat/streaming";
import { CompletionStreamingRunner } from "../resources/completions/streaming";

function forceGarbageCollect() {
  if (global.gc) {
    global.gc();
  }
}

function getMemoryUsage() {
  return process.memoryUsage();
}

function createLongRunningStream(durationMs: number = 5000, chunkIntervalMs: number = 10): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      const startTime = Date.now();

      controller.enqueue(
        encoder.encode(
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
        )
      );

      const sendChunk = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= durationMs) {
          controller.enqueue(
            encoder.encode('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n')
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const chunk = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"chunk ${count} "},"finish_reason":null}]}\n\n`;
        controller.enqueue(encoder.encode(chunk));
        count++;

        setTimeout(sendChunk, chunkIntervalMs);
      };

      setTimeout(sendChunk, chunkIntervalMs);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

describe("Memory Leak Tests", () => {
  it("should not leak memory during long-running stream", async () => {
    forceGarbageCollect();
    const initialMemory = getMemoryUsage();

    const mockResponse = createLongRunningStream(3000, 5); // 3 секунды, chunk каждые 5ms
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let chunkCount = 0;
    const memorySnapshots: number[] = [];

    runner.on("content.delta", () => {
      chunkCount++;

      if (chunkCount % 50 === 0) {
        forceGarbageCollect();
        const currentMemory = getMemoryUsage();
        memorySnapshots.push(currentMemory.heapUsed);
      }
    });

    await runner.done();

    forceGarbageCollect();
    const finalMemory = getMemoryUsage();

    expect(chunkCount).toBeGreaterThan(100); // Должно быть много chunks

    // Проверяем рост памяти
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    console.log(`Processed ${chunkCount} chunks`);
    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
    console.log(
      `Memory snapshots:`,
      memorySnapshots.map((m) => `${(m / 1024 / 1024).toFixed(2)}MB`)
    );

    // Memory growth should be reasonable (less than 10MB for this test)
    expect(memoryGrowthMB).toBeLessThan(10);

    // Memory should not keep growing throughout the stream
    if (memorySnapshots.length >= 3) {
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const snapshotGrowthMB = (lastSnapshot - firstSnapshot) / 1024 / 1024;

      expect(snapshotGrowthMB).toBeLessThan(5); // Less than 5MB growth during streaming
    }
  }, 10000);

  it("should release resources when stream is aborted", async () => {
    forceGarbageCollect();
    const initialMemory = getMemoryUsage();

    const mockResponse = createLongRunningStream(10000, 5); // 10 секунд, но мы прервем рано
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let chunkCount = 0;

    runner.on("content.delta", () => {
      chunkCount++;
      if (chunkCount === 100) {
        runner.abort(); // Прерываем после 100 chunks
      }
    });

    try {
      await runner.done();
    } catch (error) {
      // Expected when aborted
    }

    // Даем время на cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    forceGarbageCollect();
    const finalMemory = getMemoryUsage();

    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    console.log(`Aborted after ${chunkCount} chunks`);
    console.log(`Memory growth after abort: ${memoryGrowthMB.toFixed(2)}MB`);

    expect(chunkCount).toBeLessThanOrEqual(120); // Не должно быть много chunks после abort
    expect(memoryGrowthMB).toBeLessThan(5); // Minimal memory growth after abort
  }, 10000);

  it("should handle multiple concurrent streams without excessive memory usage", async () => {
    forceGarbageCollect();
    const initialMemory = getMemoryUsage();

    const streamCount = 5;
    const streamDuration = 2000; // 2 seconds each

    const promises = Array.from({ length: streamCount }, async (_, index) => {
      const mockResponse = createLongRunningStream(streamDuration, 10);
      const runner = new ChatCompletionStreamingRunner(mockResponse);

      let chunkCount = 0;
      runner.on("content.delta", () => {
        chunkCount++;
      });

      await runner.done();
      return chunkCount;
    });

    const results = await Promise.all(promises);

    forceGarbageCollect();
    const finalMemory = getMemoryUsage();

    const totalChunks = results.reduce((sum, count) => sum + count, 0);
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    console.log(`${streamCount} concurrent streams processed ${totalChunks} total chunks`);
    console.log(`Total memory growth: ${memoryGrowthMB.toFixed(2)}MB`);

    expect(results).toHaveLength(streamCount);
    expect(totalChunks).toBeGreaterThan(500); // Should have processed many chunks
    expect(memoryGrowthMB).toBeLessThan(15); // Less than 15MB for 5 concurrent streams
  }, 15000);

  it("should properly clean up event listeners", async () => {
    const mockResponse = createLongRunningStream(1000, 10);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    // Add multiple event listeners
    const listeners = {
      contentDelta: 0,
      contentDone: 0,
      chunk: 0,
      end: 0,
    };

    const contentDeltaListener = () => listeners.contentDelta++;
    const contentDoneListener = () => listeners.contentDone++;
    const chunkListener = () => listeners.chunk++;
    const endListener = () => listeners.end++;

    runner.on("content.delta", contentDeltaListener);
    runner.on("content.done", contentDoneListener);
    runner.on("chunk", chunkListener);
    runner.on("end", endListener);

    await runner.done();

    // Remove all listeners manually (normally done by EventEmitter cleanup)
    runner.off("content.delta", contentDeltaListener);
    runner.off("content.done", contentDoneListener);
    runner.off("chunk", chunkListener);
    runner.off("end", endListener);

    expect(listeners.contentDelta).toBeGreaterThan(50);
    expect(listeners.contentDone).toBe(1);
    expect(listeners.chunk).toBeGreaterThan(50);
    expect(listeners.end).toBe(1);

    console.log("Event listener counts:", listeners);
  }, 5000);

  it("should handle stream with large content without memory explosion", async () => {
    forceGarbageCollect();
    const initialMemory = getMemoryUsage();

    // Create stream with large content chunks
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
          )
        );

        // Send 100 chunks with 1KB each = ~100KB total content
        for (let i = 0; i < 100; i++) {
          const largeContent = "x".repeat(1024); // 1KB of content
          const chunk = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"${largeContent}"},"finish_reason":null}]}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }

        controller.enqueue(
          encoder.encode('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n')
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const mockResponse = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let chunkCount = 0;
    runner.on("content.delta", () => {
      chunkCount++;
    });

    await runner.done();

    const finalContent = await runner.finalContent();

    forceGarbageCollect();
    const finalMemory = getMemoryUsage();

    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    expect(chunkCount).toBe(100);
    expect(finalContent.length).toBe(102400); // 100 * 1024 characters
    expect(memoryGrowthMB).toBeLessThan(5); // Should not use excessive memory

    console.log(`Processed ${finalContent.length} characters in ${chunkCount} chunks`);
    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
  }, 10000);
});
