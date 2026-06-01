import type { AuthorStatusCardText, TimeMood, TimeMoodPeriod } from "@/types/author-status";

const TIME_MOODS: Record<TimeMoodPeriod, TimeMood> = {
  清晨: {
    period: "清晨",
    mood: "清醒、克制、重新开始",
    scene: "窗边、薄光、刚打开的书页",
    cta: "开始今日阅读"
  },
  上午: {
    period: "上午",
    mood: "专注、理性、适合进入文本",
    scene: "书桌、笔记、逐渐展开的问题",
    cta: "继续阅读"
  },
  中午: {
    period: "中午",
    mood: "短暂停顿、从现实事务中抽身",
    scene: "午后的间隙、半页书、未完成的思考",
    cta: "读一小段"
  },
  下午: {
    period: "下午",
    mood: "缓慢、沉入、适合细读",
    scene: "斜照的光、纸面阴影、逐渐深入的句子",
    cta: "进入阅读"
  },
  夜晚: {
    period: "夜晚",
    mood: "回望、自省、适合对话",
    scene: "灯光、房间、一天之后重新面对自己",
    cta: "Ask Woolf"
  },
  深夜: {
    period: "深夜",
    mood: "敏感、安静、诚实、适合写下想法",
    scene: "安静的房间、未眠的意识、压低声音的思考",
    cta: "记录感想"
  }
};

const FALLBACK_CARDS: Record<TimeMoodPeriod, AuthorStatusCardText> = {
  清晨: {
    woolf_status: "她似乎刚在薄光里打开书页，等待一个问题从安静处开始。",
    thought_title: "今日思绪",
    thought_body:
      "我喜欢清晨，因为它还没有被太多声音占据。不必急着理解所有内容，只要先把自己放回这间房间，让一句话慢慢变得清楚。",
    cta_hint: "开始今日阅读"
  },
  上午: {
    woolf_status: "她坐在书桌旁，像是在整理一个即将展开的问题。",
    thought_title: "今日思绪",
    thought_body:
      "我常觉得，上午适合把思想放在桌面上。它们未必已经清楚，却可以被耐心地摊开、辨认、重新排列。",
    cta_hint: "继续阅读"
  },
  中午: {
    woolf_status: "她似乎从现实事务的间隙里抬起头，想起自由也需要一点安静。",
    thought_title: "今日思绪",
    thought_body:
      "我知道中午常被琐事切开，但思想有时正是在这样的缝隙里回来。哪怕只是几页，也足够让人重新听见自己的声音。",
    cta_hint: "读一小段"
  },
  下午: {
    woolf_status: "她停在一页纸的阴影里，等待一个问题慢慢显形。",
    thought_title: "今日思绪",
    thought_body:
      "我喜欢下午的缓慢。它允许一句话停留得久一些，也允许一个问题暂时没有答案。阅读有时并不是前进，而是沉下去。",
    cta_hint: "进入阅读"
  },
  夜晚: {
    woolf_status: "她把白天的喧声关在门外，重新回到那间属于自己的房间。",
    thought_title: "今日思绪",
    thought_body:
      "到了夜晚，我总会重新想起白天无法安放的念头。也许阅读并不是逃离现实，而是在一天之后，重新整理自己与世界的距离。",
    cta_hint: "Ask Woolf"
  },
  深夜: {
    woolf_status: "她似乎还没有睡，只是在更低的灯光里辨认那些白天难以说出口的问题。",
    thought_title: "今日思绪",
    thought_body:
      "深夜让许多想法变得诚实。我不急着把它们解释清楚，只想先承认它们存在。那些未完成的句子，也许正是思想开始的地方。",
    cta_hint: "记录感想"
  }
};

export function getTimeMood(hour: number): TimeMood {
  const normalizedHour = Number.isFinite(hour) ? Math.floor(hour) : new Date().getHours();

  if (normalizedHour >= 5 && normalizedHour <= 8) {
    return TIME_MOODS.清晨;
  }

  if (normalizedHour >= 9 && normalizedHour <= 11) {
    return TIME_MOODS.上午;
  }

  if (normalizedHour >= 12 && normalizedHour <= 13) {
    return TIME_MOODS.中午;
  }

  if (normalizedHour >= 14 && normalizedHour <= 17) {
    return TIME_MOODS.下午;
  }

  if (normalizedHour >= 18 && normalizedHour <= 21) {
    return TIME_MOODS.夜晚;
  }

  return TIME_MOODS.深夜;
}

export function getFallbackAuthorStatusCard(period: TimeMoodPeriod): AuthorStatusCardText {
  return FALLBACK_CARDS[period];
}

export function getDefaultAuthorStatusCard(hour = new Date().getHours()): AuthorStatusCardText {
  return getFallbackAuthorStatusCard(getTimeMood(hour).period);
}

export function getTimeMoodForDate(date: Date, timezone?: string | null) {
  if (!timezone) {
    const timeMood = getTimeMood(date.getHours());

    return {
      cardDate: date.toISOString().slice(0, 10),
      hour: date.getHours(),
      timeMood
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const hour = Number.parseInt(getPart("hour"), 10);
    const cardDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

    return {
      cardDate,
      hour,
      timeMood: getTimeMood(hour)
    };
  } catch {
    return getTimeMoodForDate(date, null);
  }
}

export function sanitizeGeneratedJson(raw: string) {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  return fencedMatch?.[1]?.trim() ?? trimmed;
}

function normalizeInlineText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function hasDirectUserCommand(value: string) {
  return /(你应该|你需要|请你|继续阅读这一章|应该继续|打开|点击)/.test(value);
}

export function validateAuthorStatusCardText(value: unknown, fallbackCta: string): AuthorStatusCardText | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<AuthorStatusCardText>;
  const woolf_status = normalizeInlineText(raw.woolf_status, 90);
  const thought_title = normalizeInlineText(raw.thought_title, 16);
  const thought_body = normalizeInlineText(raw.thought_body, 180);
  const rawCta = normalizeInlineText(raw.cta_hint, 24);
  const cta_hint = rawCta || fallbackCta;

  if (!woolf_status || !thought_title || !thought_body || !cta_hint) {
    return null;
  }

  if (!woolf_status.startsWith("她") || woolf_status.includes("我") || hasDirectUserCommand(woolf_status)) {
    return null;
  }

  if (/^(她|伍尔夫|Virginia Woolf|Woolf)/i.test(thought_body) || /作为\s*AI|AI\s*助手/.test(thought_body)) {
    return null;
  }

  if (!thought_body.includes("我")) {
    return null;
  }

  return {
    woolf_status,
    thought_title,
    thought_body,
    cta_hint
  };
}

export function parseAuthorStatusCardJson(raw: string, fallbackCta: string): AuthorStatusCardText | null {
  try {
    return validateAuthorStatusCardText(JSON.parse(sanitizeGeneratedJson(raw)), fallbackCta);
  } catch {
    return null;
  }
}
