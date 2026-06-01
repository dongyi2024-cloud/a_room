import "server-only";

import OpenAI from "openai";

export const SILICONFLOW_EMBEDDING_MODEL = "BAAI/bge-m3";
export const SILICONFLOW_EMBEDDING_DIMENSION = 1024;

type SiliconFlowConfig = {
  apiKey: string;
  baseURL: string;
  timeout: number;
};

let client: OpenAI | null = null;
let cachedConfig: SiliconFlowConfig | null = null;

function getSiliconFlowConfig(): SiliconFlowConfig {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  const baseURL = process.env.SILICONFLOW_BASE_URL?.trim() || "https://api.siliconflow.cn/v1";
  const timeout = Number.parseInt(process.env.SILICONFLOW_TIMEOUT_MS?.trim() || "30000", 10);

  if (!apiKey) {
    throw new Error("SiliconFlow is not configured. Set SILICONFLOW_API_KEY in .env.local.");
  }

  return {
    apiKey,
    baseURL,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000
  };
}

function getSiliconFlowClient() {
  const config = getSiliconFlowConfig();

  if (!client || cachedConfig?.apiKey !== config.apiKey || cachedConfig.baseURL !== config.baseURL) {
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    cachedConfig = config;
  }

  return client;
}

export async function generateSiliconFlowEmbeddings(inputs: string[]) {
  if (inputs.length === 0) {
    return [];
  }

  const response = await getSiliconFlowClient().embeddings.create({
    model: SILICONFLOW_EMBEDDING_MODEL,
    input: inputs,
    encoding_format: "float"
  }, {
    timeout: cachedConfig?.timeout ?? 30000
  });

  if (response.data.length !== inputs.length) {
    throw new Error(`SiliconFlow returned ${response.data.length} embeddings for ${inputs.length} inputs.`);
  }

  return response.data
    .slice()
    .sort((left, right) => left.index - right.index)
    .map((item, index) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error(`SiliconFlow returned a non-array embedding for chunk batch item ${index}.`);
      }

      if (item.embedding.length !== SILICONFLOW_EMBEDDING_DIMENSION) {
        throw new Error(
          `SiliconFlow returned ${item.embedding.length} dimensions, expected ${SILICONFLOW_EMBEDDING_DIMENSION}.`
        );
      }

      return item.embedding;
    });
}
