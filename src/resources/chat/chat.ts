import { NeuroApi } from "../../client";
import { ChatCompletions } from "./completions";

export class Chat {
  public completions: ChatCompletions;

  constructor(client: NeuroApi) {
    this.completions = new ChatCompletions(client);
  }
}
