export type ImageModel = "dall-e-2" | "dall-e-3" | "gpt-image-1" | (string & {});

export type ImageSize = "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792" | "1536x1024" | "1024x1536" | "auto";

export type ImageQuality = "standard" | "hd" | "low" | "medium" | "high" | "auto";

export type ImageStyle = "vivid" | "natural";

export type ImageResponseFormat = "url" | "b64_json";

export interface Image {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ImageGenerateParams {
  prompt: string;
  model?: ImageModel;
  n?: number;
  quality?: ImageQuality;
  response_format?: ImageResponseFormat;
  size?: ImageSize;
  style?: ImageStyle;
  user?: string;
}

export interface ImageEditParams {
  image: File | Blob;
  prompt: string;
  mask?: File | Blob;
  model?: ImageModel;
  n?: number;
  response_format?: ImageResponseFormat;
  size?: ImageSize;
  user?: string;
}

export interface ImageVariationParams {
  image: File | Blob;
  model?: ImageModel;
  n?: number;
  response_format?: ImageResponseFormat;
  size?: ImageSize;
  user?: string;
}

export interface ImagesResponse {
  created: number;
  data: Image[];
}
