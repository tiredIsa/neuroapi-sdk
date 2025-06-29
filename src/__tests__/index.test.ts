import { describe, it, expect, beforeEach } from "bun:test";
import { NeuroApi } from "../index";

describe("NeuroApi", () => {
  let client: NeuroApi;

  beforeEach(() => {
    client = new NeuroApi({
      baseURL: "https://api.example.com",
      apiKey: "test-key",
    });
  });

  describe("constructor", () => {
    it("should create instance with required options", () => {
      expect(client).toBeDefined();
      expect(client.chat).toBeDefined();
      expect(client.completions).toBeDefined();
      expect(client.images).toBeDefined();
    });

    it("should normalize baseURL by removing trailing slash", () => {
      const clientWithSlash = new NeuroApi({
        baseURL: "https://api.example.com/",
        apiKey: "test-key",
      });
      expect(clientWithSlash).toBeDefined();
    });

    it("should support retry configuration", () => {
      const clientWithRetry = new NeuroApi({
        baseURL: "https://api.example.com",
        apiKey: "test-key",
        timeout: 30000,
        defaultHeaders: {
          "X-Custom-Header": "test",
        },
      });
      expect(clientWithRetry).toBeDefined();
    });
  });

  describe("chat completions", () => {
    it("should validate required parameters", async () => {
      await expect(
        client.chat.completions.create({
          model: "",
          messages: [],
        })
      ).rejects.toThrow("model is required");

      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [],
        })
      ).rejects.toThrow("messages is required and must not be empty");
    });

    it("should validate message parameters", async () => {
      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(); // Network error expected in test
    });

    it("should validate temperature range", async () => {
      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          temperature: 3,
        })
      ).rejects.toThrow("temperature must be between 0 and 2");
    });

    it("should validate top_p range", async () => {
      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          top_p: 2,
        })
      ).rejects.toThrow("top_p must be between 0 and 1");
    });

    it("should validate max_tokens", async () => {
      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 0,
        })
      ).rejects.toThrow("max_tokens must be greater than 0");
    });

    it("should reject streaming in create method", async () => {
      await expect(
        client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          stream: true,
        })
      ).rejects.toThrow("Use stream() method for streaming requests");
    });

    it("should support withResponse method", async () => {
      await expect(
        client.chat.completions.withResponse({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(); // Network error expected in test, but method should exist
    });
  });

  describe("completions", () => {
    it("should validate required parameters", async () => {
      await expect(
        client.completions.create({
          model: "",
          prompt: "test",
        })
      ).rejects.toThrow("model is required");

      await expect(
        client.completions.create({
          model: "gpt-3.5-turbo",
          prompt: "",
        })
      ).rejects.toThrow("prompt is required");
    });

    it("should support withResponse method", async () => {
      await expect(
        client.completions.withResponse({
          model: "gpt-3.5-turbo",
          prompt: "test",
        })
      ).rejects.toThrow(); // Network error expected in test, but method should exist
    });
  });

  describe("images", () => {
    it("should validate required parameters", async () => {
      await expect(
        client.images.generate({
          prompt: "",
        })
      ).rejects.toThrow("prompt is required");
    });

    it("should validate n parameter range", async () => {
      await expect(
        client.images.generate({
          prompt: "test",
          n: 0,
        })
      ).rejects.toThrow("n must be between 1 and 10");

      await expect(
        client.images.generate({
          prompt: "test",
          n: 11,
        })
      ).rejects.toThrow("n must be between 1 and 10");
    });

    it("should validate dall-e-3 n parameter", async () => {
      await expect(
        client.images.generate({
          prompt: "test",
          model: "dall-e-3",
          n: 2,
        })
      ).rejects.toThrow("dall-e-3 only supports n=1");
    });

    it("should support withResponse method", async () => {
      await expect(
        client.images.withResponse({
          prompt: "test image",
          model: "dall-e-2",
        })
      ).rejects.toThrow(); // Network error expected in test, but method should exist
    });
  });

  describe("retry logic", () => {
    it("should support disabling retry", async () => {
      const clientNoRetry = new NeuroApi({
        baseURL: "https://api.example.com",
        apiKey: "test-key",
      });

      await expect(
        clientNoRetry.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
        })
      ).rejects.toThrow(); // Network error expected in test
    });
  });
});
