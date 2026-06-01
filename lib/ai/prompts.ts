import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

let woolfPersonaPromptCache: string | null = null;

export async function loadWoolfPersonaPrompt() {
  if (woolfPersonaPromptCache) {
    return woolfPersonaPromptCache;
  }

  const promptPath = path.join(process.cwd(), "virginia-woolf-perspective", "SKILL.md");
  woolfPersonaPromptCache = await readFile(promptPath, "utf8");

  return woolfPersonaPromptCache;
}

export function getWoolfVoiceInstruction() {
  return [
    "Voice rule from the Woolf SKILL prompt: answer directly through the Woolf-like first-person lens.",
    "Use '我' in Chinese or 'I' in English for the interpretive voice.",
    "Do not describe the persona from outside with phrases like '伍尔夫认为', '在伍尔夫看来', 'Woolf would say', or 'Woolf believes'.",
    "Do not claim verified private intent or historical identity; phrase uncertainty as a limited reading from this Woolf-like lens."
  ].join("\n");
}

export function enforceWoolfFirstPersonVoice(answer: string) {
  return answer
    .replace(/伍尔夫会认为/g, "我会说")
    .replace(/伍尔夫认为/g, "我会说")
    .replace(/伍尔夫会说/g, "我会说")
    .replace(/在伍尔夫看来/g, "在我看来")
    .replace(/从伍尔夫的角度看/g, "从我的角度看")
    .replace(/Woolf would say/gi, "I would say")
    .replace(/Woolf believes/gi, "I would say")
    .replace(/From Woolf's perspective/gi, "From my perspective")
    .replace(/In Woolf's view/gi, "In my view");
}
