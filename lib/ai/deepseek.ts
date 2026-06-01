import "server-only";

import OpenAI from "openai";
import type { OpenAI as OpenAIClient } from "openai";

type DeepSeekConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  timeout: number;
};

let client: OpenAI | null = null;
let cachedConfig: DeepSeekConfig | null = null;

function getDeepSeekConfig(): DeepSeekConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseURL = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
  const timeout = Number.parseInt(process.env.DEEPSEEK_TIMEOUT_MS?.trim() || "45000", 10);

  if (!apiKey) {
    throw new Error("DeepSeek is not configured. Set DEEPSEEK_API_KEY in .env.local.");
  }

  return {
    apiKey,
    baseURL,
    model,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 45000
  };
}

function getDeepSeekClient() {
  const config = getDeepSeekConfig();

  if (!client || cachedConfig?.apiKey !== config.apiKey || cachedConfig.baseURL !== config.baseURL) {
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
    cachedConfig = config;
  }

  return { client, model: config.model };
}

function extractTextContent(rawContent: unknown) {
  const contentParts = Array.isArray(rawContent) ? (rawContent as Array<unknown>) : null;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  if (!contentParts) {
    return "";
  }

  return contentParts
    .map((part: unknown) => {
      if (typeof part === "string") {
        return part;
      }

      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function extractReasoningContent(choice: OpenAIClient.Chat.Completions.ChatCompletion.Choice | undefined) {
  const rawReasoning = choice?.message && "reasoning_content" in choice.message ? choice.message.reasoning_content : null;

  return typeof rawReasoning === "string" ? rawReasoning.trim() : "";
}

async function requestDeepSeekCompletion(params: {
  client: OpenAI;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}) {
  const { client, model, systemPrompt, userPrompt, temperature, maxTokens, timeout } = params;
  const completion = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    },
    {
      timeout
    }
  );
  const choice = completion.choices[0];

  return {
    answer: extractTextContent(choice?.message?.content),
    reasoningContent: extractReasoningContent(choice),
    finishReason: choice?.finish_reason ?? null
  };
}

export async function generateDeepSeekChatCompletion({
  systemPrompt,
  userPrompt,
  maxTokens,
  temperature,
  timeoutMs
}: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}) {
  const { client: deepSeekClient, model } = getDeepSeekClient();
  const configuredTimeout = cachedConfig?.timeout ?? 45000;
  const timeout =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : configuredTimeout;
  const normalizedTemperature = typeof temperature === "number" ? temperature : 0.45;
  const initialMaxTokens = maxTokens ?? 360;
  const firstAttempt = await requestDeepSeekCompletion({
    client: deepSeekClient,
    model,
    systemPrompt,
    userPrompt,
    temperature: normalizedTemperature,
    maxTokens: initialMaxTokens,
    timeout
  });

  if (firstAttempt.answer) {
    return {
      answer: firstAttempt.answer,
      finishReason: firstAttempt.finishReason
    };
  }

  const shouldRetryForEmptyContent = Boolean(firstAttempt.reasoningContent) || firstAttempt.finishReason === "length";

  if (shouldRetryForEmptyContent) {
    const secondAttempt = await requestDeepSeekCompletion({
      client: deepSeekClient,
      model,
      systemPrompt: `${systemPrompt}\n\nReturn the final answer directly in message.content. Keep the hidden reasoning brief and spend the token budget on the final answer.`,
      userPrompt,
      temperature: normalizedTemperature,
      maxTokens: Math.max(initialMaxTokens * 2, 720),
      timeout
    });

    if (secondAttempt.answer) {
      return {
        answer: secondAttempt.answer,
        finishReason: secondAttempt.finishReason
      };
    }

    console.error("DeepSeek returned empty content twice", {
      model,
      firstFinishReason: firstAttempt.finishReason,
      secondFinishReason: secondAttempt.finishReason,
      firstReasoningChars: firstAttempt.reasoningContent.length,
      secondReasoningChars: secondAttempt.reasoningContent.length
    });
    throw new Error("DeepSeek returned an empty answer after retry.");
  }

  console.error("DeepSeek returned empty content", {
    model,
    finishReason: firstAttempt.finishReason,
    reasoningChars: firstAttempt.reasoningContent.length
  });
  throw new Error("DeepSeek returned an empty answer.");
}
