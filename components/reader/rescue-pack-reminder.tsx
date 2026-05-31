"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBrowserNotificationPermission,
  getRescuePackReminderCopy,
  getRescuePackReminderStateKey,
  isRescuePackReminderEligible,
  RESCUE_PACK_REMINDER_DISABLED_KEY,
  supportsBrowserNotifications
} from "@/lib/reading-slump/rescue-reminder";
import type { ReadingSlumpEvaluationResult, ReadingSlumpStateApiResponse } from "@/types/reading-slump";

type RescuePackReminderProps = {
  bookId: string;
  bookTitle: string;
  chapterOrder: number;
  onOpenRescuePack: () => void;
};

type NotificationStatus = NotificationPermission | "unsupported";

function readReminderDisabledPreference() {
  try {
    return window.localStorage.getItem(RESCUE_PACK_REMINDER_DISABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeReminderDisabledPreference(disabled: boolean) {
  try {
    window.localStorage.setItem(RESCUE_PACK_REMINDER_DISABLED_KEY, disabled ? "true" : "false");
  } catch {
    // Local preference failure should not break reading.
  }
}

export function RescuePackReminder({ bookId, bookTitle, chapterOrder, onOpenRescuePack }: RescuePackReminderProps) {
  const [state, setState] = useState<ReadingSlumpEvaluationResult | null>(null);
  const [isDismissedLocally, setIsDismissedLocally] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("unsupported");
  const [message, setMessage] = useState("");
  const sentNotificationKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsDisabled(readReminderDisabledPreference());
    setNotificationStatus(getBrowserNotificationPermission());
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSlumpState() {
      try {
        const response = await fetch(`/api/reading-events?book=${encodeURIComponent(bookId)}`);
        const payload = (await response.json()) as ReadingSlumpStateApiResponse;

        if (isCancelled || !response.ok || "error" in payload) {
          return;
        }

        setState(payload.state);
        setIsDismissedLocally(false);
      } catch {
        // Reminder loading must never interrupt reading.
      }
    }

    void loadSlumpState();

    return () => {
      isCancelled = true;
    };
  }, [bookId, chapterOrder]);

  useEffect(() => {
    if (!state || !isRescuePackReminderEligible(state) || notificationStatus !== "granted") {
      return;
    }

    const notificationKey = getRescuePackReminderStateKey(bookId, state);

    if (sentNotificationKeysRef.current.has(notificationKey)) {
      return;
    }

    sentNotificationKeysRef.current.add(notificationKey);
    const notification = new Notification("阅读救急包", {
      body: getRescuePackReminderCopy(state),
      tag: `rescue-pack-${bookId}`,
      data: {
        bookId,
        chapterOrder,
        rescuePack: true
      }
    });

    notification.onclick = () => {
      window.focus();
      onOpenRescuePack();
      notification.close();
    };
  }, [bookId, chapterOrder, notificationStatus, onOpenRescuePack, state]);

  if (!state || !isRescuePackReminderEligible(state) || isDismissedLocally || isDisabled) {
    return null;
  }

  async function dismissReminder(disableFuturePrompts = false) {
    setIsDismissing(true);
    setMessage("");

    if (disableFuturePrompts) {
      writeReminderDisabledPreference(true);
      setIsDisabled(true);
    }

    try {
      const response = await fetch("/api/reading-events/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookId })
      });
      const payload = (await response.json()) as ReadingSlumpStateApiResponse;

      if (response.ok && "ok" in payload) {
        setState(payload.state);
      }
    } catch {
      // Local dismissal still protects the reading surface if the network fails.
    } finally {
      setIsDismissedLocally(true);
      setIsDismissing(false);
    }
  }

  async function requestNotificationPermission() {
    setMessage("");

    if (!supportsBrowserNotifications()) {
      setNotificationStatus("unsupported");
      setMessage("当前浏览器不支持通知，站内提醒仍可使用。");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);

    if (permission === "granted") {
      setMessage("已开启浏览器通知。之后符合条件时会提醒你打开救急包。");
      return;
    }

    setMessage("未开启浏览器通知，站内提醒仍可使用。");
  }

  const canAskNotificationPermission = notificationStatus === "default";

  return (
    <aside className="rescue-pack-reminder" aria-label="阅读救急包提醒">
      <div className="rescue-pack-reminder-copy">
        <p className="page-eyebrow">Rescue pack</p>
        <h3>读不下去时，先接住这一章</h3>
        <p>{getRescuePackReminderCopy(state)}</p>
        <p className="rescue-pack-reminder-meta">
          {bookTitle} · 第 {chapterOrder} 章
        </p>
      </div>
      <div className="rescue-pack-reminder-actions">
        <button className="primary-link button-reset" onClick={onOpenRescuePack} type="button">
          打开救急包
        </button>
        {canAskNotificationPermission ? (
          <button className="secondary-link button-reset" onClick={requestNotificationPermission} type="button">
            开启通知
          </button>
        ) : null}
        <button className="secondary-link button-reset" disabled={isDismissing} onClick={() => dismissReminder(false)} type="button">
          {isDismissing ? "关闭中..." : "稍后再说"}
        </button>
        <button className="button-reset rescue-pack-reminder-muted" disabled={isDismissing} onClick={() => dismissReminder(true)} type="button">
          不再提醒
        </button>
      </div>
      {message ? <p className="rescue-pack-reminder-status">{message}</p> : null}
    </aside>
  );
}
