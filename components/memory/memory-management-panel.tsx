"use client";

import { useState } from "react";
import type {
  CreateMemoryApiResponse,
  DeleteMemoryApiResponse,
  MemoryManagementApiResponse,
  MemorySettingsApiResponse,
  UserMemory,
  UserMemorySettings
} from "@/types/memory";

type MemoryManagementPanelProps = {
  initialMemories: UserMemory[];
  initialSettings: UserMemorySettings;
};

const MEMORY_LABELS: Record<UserMemory["memoryType"], string> = {
  explanation_style: "解释风格",
  interpretive_interest: "关注视角",
  recurring_question: "反复疑问",
  answer_length: "回答长度",
  reading_assistance: "阅读辅助"
};

async function parseJsonResponse<T>(response: Response) {
  const payload = (await response.json()) as T;

  if (!response.ok || (payload && typeof payload === "object" && "error" in payload)) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to update memory."
    );
  }

  return payload;
}

export function MemoryManagementPanel({ initialMemories, initialSettings }: MemoryManagementPanelProps) {
  const [memories, setMemories] = useState(initialMemories);
  const [settings, setSettings] = useState(initialSettings);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingMemoryId, setPendingMemoryId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [manualMemoryType, setManualMemoryType] = useState<UserMemory["memoryType"]>("reading_assistance");
  const [manualMemoryContent, setManualMemoryContent] = useState("");
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);

  async function refreshMemories() {
    const response = await fetch("/api/memory", { method: "GET" });
    const payload = await parseJsonResponse<MemoryManagementApiResponse>(response);

    if ("ok" in payload) {
      setMemories(payload.memories);
      setSettings(payload.settings);
    }
  }

  async function toggleMemory(nextEnabled: boolean) {
    setIsToggling(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/memory/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ memoryEnabled: nextEnabled })
      });
      const payload = await parseJsonResponse<MemorySettingsApiResponse>(response);

      if ("ok" in payload) {
        setSettings(payload.settings);
        setStatusMessage(nextEnabled ? "长期记忆已开启。" : "长期记忆已关闭，AI 不会读取或新增长期记忆。");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update memory settings.");
    } finally {
      setIsToggling(false);
    }
  }

  async function deleteMemory(memory: UserMemory) {
    const confirmed = window.confirm("删除后，AI 将不再使用这条长期记忆。确认删除？");

    if (!confirmed) {
      return;
    }

    setPendingMemoryId(memory.id);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/memory/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ memoryId: memory.id })
      });
      const payload = await parseJsonResponse<DeleteMemoryApiResponse>(response);

      if ("ok" in payload) {
        setMemories((current) => current.filter((entry) => entry.id !== memory.id));
        setStatusMessage("这条长期记忆已删除。");
        await refreshMemories();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete memory.");
    } finally {
      setPendingMemoryId(null);
    }
  }

  async function createMemory() {
    const content = manualMemoryContent.replace(/\s+/g, " ").trim();

    if (content.length < 4) {
      setErrorMessage("请输入至少 4 个字的长期记忆。");
      setStatusMessage("");
      return;
    }

    setIsCreatingMemory(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/memory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          memoryType: manualMemoryType,
          content
        })
      });
      const payload = await parseJsonResponse<CreateMemoryApiResponse>(response);

      if ("ok" in payload) {
        setManualMemoryContent("");
        setMemories((current) => [payload.memory, ...current.filter((entry) => entry.id !== payload.memory.id)]);
        setStatusMessage("长期记忆已新增。");
        await refreshMemories();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create memory.");
    } finally {
      setIsCreatingMemory(false);
    }
  }

  return (
    <section className="memory-panel">
      <div className="soft-card memory-settings-card">
        <div>
          <p className="page-eyebrow">Memory switch</p>
          <h2 className="memory-section-title">长期记忆</h2>
          <p className="memory-section-copy">
            开启后，AI 可以使用你已启用的阅读偏好和反复疑问；关闭后不会新增或读取长期记忆。
          </p>
        </div>
        <button
          aria-pressed={settings.memoryEnabled}
          className={`memory-toggle button-reset${settings.memoryEnabled ? " is-on" : ""}`}
          disabled={isToggling}
          onClick={() => toggleMemory(!settings.memoryEnabled)}
          type="button"
        >
          {settings.memoryEnabled ? "已开启" : "已关闭"}
        </button>
      </div>

      {statusMessage ? <p className="form-success page-feedback">{statusMessage}</p> : null}
      {errorMessage ? <p className="form-error page-feedback">{errorMessage}</p> : null}

      <div className="soft-card memory-create-card">
        <div>
          <p className="page-eyebrow">Manual memory</p>
          <h2 className="memory-section-title">新增长期记忆</h2>
          <p className="memory-section-copy">手动写下希望 AI 之后记住的阅读偏好、反复疑问或辅助方式。</p>
        </div>
        <div className="memory-create-form">
          <label className="memory-field">
            <span>类型</span>
            <select
              disabled={!settings.memoryEnabled || isCreatingMemory}
              onChange={(event) => setManualMemoryType(event.target.value as UserMemory["memoryType"])}
              value={manualMemoryType}
            >
              {Object.entries(MEMORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="memory-field">
            <span>内容</span>
            <textarea
              disabled={!settings.memoryEnabled || isCreatingMemory}
              maxLength={180}
              onChange={(event) => setManualMemoryContent(event.target.value)}
              placeholder="例如：我希望解释抽象概念时先给一个现实例子。"
              value={manualMemoryContent}
            />
          </label>
          <div className="memory-create-actions">
            <span>{manualMemoryContent.trim().length}/180</span>
            <button
              className="primary-button button-reset"
              disabled={!settings.memoryEnabled || isCreatingMemory || manualMemoryContent.trim().length < 4}
              onClick={createMemory}
              type="button"
            >
              {isCreatingMemory ? "保存中" : "新增记忆"}
            </button>
          </div>
          {!settings.memoryEnabled ? <p className="memory-disabled-note">长期记忆关闭时不能新增记忆。</p> : null}
        </div>
      </div>

      <div className="memory-list">
        {memories.length === 0 ? (
          <div className="soft-card memory-empty">
            <h2 className="state-title">还没有长期记忆</h2>
            <p className="state-text">当你反复表达阅读偏好或关键疑问时，系统会在这里保存可管理的记忆。</p>
          </div>
        ) : (
          memories.map((memory) => (
            <article className="soft-card memory-card" key={memory.id}>
              <div>
                <p className="memory-type">{MEMORY_LABELS[memory.memoryType]}</p>
                <h2 className="memory-content">{memory.content}</h2>
                <p className="memory-meta">
                  强化 {memory.reinforcementCount} 次 · 更新于 {new Date(memory.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                className="secondary-link button-reset"
                disabled={pendingMemoryId === memory.id}
                onClick={() => deleteMemory(memory)}
                type="button"
              >
                {pendingMemoryId === memory.id ? "删除中" : "删除"}
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
