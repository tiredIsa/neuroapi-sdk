import { ImagesResponse, ImageGenerateParams, ImageEditParams, ImageVariationParams } from "../types/images";
import { APIResponse } from "../types/common";
import { NeuroApi } from "../client";

export class Images {
  private client: NeuroApi;

  constructor(client: NeuroApi) {
    this.client = client;
  }

  async generate(params: ImageGenerateParams): Promise<ImagesResponse> {
    this.validateGenerateParams(params);

    const response = await this.client.makeRequest<ImagesResponse>("/images/generations", params);
    return response;
  }

  async withResponse(params: ImageGenerateParams): Promise<APIResponse<ImagesResponse>> {
    this.validateGenerateParams(params);

    const response = await this.client.makeRequestWithResponse<ImagesResponse>("/images/generations", params);
    return response;
  }

  async edit(params: ImageEditParams): Promise<ImagesResponse> {
    this.validateEditParams(params);

    const formData = this.createFormData(params);
    const response = await this.client.makeRequest<ImagesResponse>("/images/edits", formData);
    return response;
  }

  async createVariation(params: ImageVariationParams): Promise<ImagesResponse> {
    this.validateVariationParams(params);

    const formData = this.createFormData(params);
    const response = await this.client.makeRequest<ImagesResponse>("/images/variations", formData);
    return response;
  }

  private validateGenerateParams(params: ImageGenerateParams): void {
    if (!params.prompt || params.prompt.trim() === "") {
      throw new Error("prompt is required");
    }

    if (params.n !== undefined && (params.n < 1 || params.n > 10)) {
      throw new Error("n must be between 1 and 10");
    }

    if (params.model === "dall-e-3" && params.n !== undefined && params.n > 1) {
      throw new Error("dall-e-3 only supports n=1");
    }
  }

  private validateEditParams(params: ImageEditParams): void {
    if (!params.image) {
      throw new Error("image is required");
    }

    if (!params.prompt || params.prompt.trim() === "") {
      throw new Error("prompt is required");
    }

    if (params.n !== undefined && (params.n < 1 || params.n > 10)) {
      throw new Error("n must be between 1 and 10");
    }
  }

  private validateVariationParams(params: ImageVariationParams): void {
    if (!params.image) {
      throw new Error("image is required");
    }

    if (params.n !== undefined && (params.n < 1 || params.n > 10)) {
      throw new Error("n must be between 1 and 10");
    }
  }

  private createFormData(params: ImageEditParams | ImageVariationParams): FormData {
    const formData = new FormData();

    formData.append("image", params.image);

    if ("prompt" in params) {
      formData.append("prompt", params.prompt);
    }

    if ("mask" in params && params.mask) {
      formData.append("mask", params.mask);
    }

    if (params.model) {
      formData.append("model", params.model);
    }

    if (params.n) {
      formData.append("n", params.n.toString());
    }

    if (params.response_format) {
      formData.append("response_format", params.response_format);
    }

    if (params.size) {
      formData.append("size", params.size);
    }

    if (params.user) {
      formData.append("user", params.user);
    }

    return formData;
  }
}
