import { FinishReason, Usage } from "./common";

export interface CompletionChoice {
  text: string;
  index: number;
  finish_reason: FinishReason | null;
}

export interface Completion {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage?: Usage;
}

export interface CompletionCreateParams {
  model: string;
  prompt: string | string[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  user?: string;
}

export interface CompletionChunk {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: CompletionChunkChoice[];
  usage?: Usage;
}

export interface CompletionChunkChoice {
  text: string;
  index: number;
  finish_reason: FinishReason | null;
}

export interface CompletionStreamEventMap {
  "text.delta": { delta: string; snapshot: string };
  "text.done": { text: string };
  chunk: CompletionChunk;
  error: Error;
  end: void;
  abort: void;
}
