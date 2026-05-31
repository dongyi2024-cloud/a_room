import type { ReadingSlumpEvaluationResult } from "@/types/reading-slump";

export const RESCUE_PACK_REMINDER_DISABLED_KEY = "woolf-room.rescue-pack-reminders.disabled.v1";

export function isRescuePackReminderEligible(state: ReadingSlumpEvaluationResult | null | undefined) {
  return Boolean(state && state.status !== "steady" && state.isReminderEligible);
}

export function getRescuePackReminderStateKey(bookId: string, state: ReadingSlumpEvaluationResult) {
  return `${bookId}:${state.status}:${state.evaluatedAt}:${state.reminderSuppressedUntil ?? "none"}`;
}

export function getRescuePackReminderCopy(state: ReadingSlumpEvaluationResult) {
  if (state.status === "slump") {
    return "你似乎在这一段停留有一会儿了。要不要打开一份 3 分钟前情提要，先把路重新接上？";
  }

  return "你卡在这一章有一会儿了。要不要看一份轻量救急包，帮自己重新进入文本？";
}

export function supportsBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!supportsBrowserNotifications()) {
    return "unsupported";
  }

  return window.Notification.permission;
}
