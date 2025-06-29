import { FinishReason, Usage } from "./common";
import { SupportedModel } from "./models";

export type ChatCompletionRole = "user" | "assistant" | "system" | "tool";

export interface ChatCompletionMessage {
  role: ChatCompletionRole;
  content: string | null;
  name?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  tool_call_id?: string;
}

export interface ChatCompletionMessageParam {
  role: ChatCompletionRole;
  content: string | ChatCompletionContentPart[];
  name?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  tool_call_id?: string;
}

export interface ChatCompletionContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface ChatCompletionMessageToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  index?: number;
}

export interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export type ChatCompletionToolChoiceOption = "none" | "auto" | "required" | ChatCompletionNamedToolChoice;

export interface ChatCompletionNamedToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

export interface ChatCompletionLogProbs {
  content: ChatCompletionTokenLogprob[] | null;
}

export interface ChatCompletionTokenLogprob {
  token: string;
  logprob: number;
  bytes: number[] | null;
  top_logprobs: ChatCompletionTopLogprob[];
}

export interface ChatCompletionTopLogprob {
  token: string;
  logprob: number;
  bytes: number[] | null;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: FinishReason | null;
  logprobs?: ChatCompletionLogProbs | null;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: SupportedModel;
  choices: ChatCompletionChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface ChatCompletionCreateParams {
  model: SupportedModel;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoiceOption;
  user?: string;
  response_format?: {
    type: "text" | "json_object";
  };
  logprobs?: boolean;
  top_logprobs?: number;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: SupportedModel;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: FinishReason | null;
  logprobs?: ChatCompletionLogProbs | null;
}

export interface ChatCompletionChunkDelta {
  role?: ChatCompletionRole;
  content?: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
}

export interface ChatCompletionStreamOptions {
  include_usage?: boolean;
}

export interface ContentDeltaEvent {
  delta: string;
  snapshot: string;
}

export interface ContentDoneEvent {
  content: string;
}

export interface ToolCallDeltaEvent {
  index: number;
  toolCall: Partial<ChatCompletionMessageToolCall>;
  snapshot: ChatCompletionMessageToolCall;
}

export interface ToolCallDoneEvent {
  index: number;
  toolCall: ChatCompletionMessageToolCall;
}

export interface LogProbsDeltaEvent {
  logprobs: ChatCompletionLogProbs;
}

export interface LogProbsDoneEvent {
  logprobs: ChatCompletionLogProbs;
}

export interface StreamEventMap {
  "content.delta": ContentDeltaEvent;
  "content.done": ContentDoneEvent;
  "tool_calls.function.arguments.delta": ToolCallDeltaEvent;
  "tool_calls.function.arguments.done": ToolCallDoneEvent;
  "logprobs.content.delta": LogProbsDeltaEvent;
  "logprobs.content.done": LogProbsDoneEvent;
  chunk: ChatCompletionChunk;
  error: Error;
  end: void;
  abort: void;
}
