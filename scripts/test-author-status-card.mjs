import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTimeMoodModule() {
  const source = readFileSync(new URL("../lib/author-status/time-mood.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;
  const exports = {};
  const context = {
    exports,
    module: { exports },
    require,
    Intl,
    Date
  };

  vm.runInNewContext(compiled, context, { filename: "time-mood.ts" });
  return context.module.exports;
}

const {
  getTimeMood,
  getFallbackAuthorStatusCard,
  getTimeMoodForDate,
  parseAuthorStatusCardJson,
  validateAuthorStatusCardText
} = loadTimeMoodModule();

assert.equal(getTimeMood(4).period, "深夜");
assert.equal(getTimeMood(5).period, "清晨");
assert.equal(getTimeMood(8).period, "清晨");
assert.equal(getTimeMood(9).period, "上午");
assert.equal(getTimeMood(11).period, "上午");
assert.equal(getTimeMood(12).period, "中午");
assert.equal(getTimeMood(13).period, "中午");
assert.equal(getTimeMood(14).period, "下午");
assert.equal(getTimeMood(17).period, "下午");
assert.equal(getTimeMood(18).period, "夜晚");
assert.equal(getTimeMood(21).period, "夜晚");
assert.equal(getTimeMood(22).period, "深夜");

{
  const timed = getTimeMoodForDate(new Date("2026-06-01T07:30:00.000Z"), "Asia/Shanghai");
  assert.equal(timed.cardDate, "2026-06-01");
  assert.equal(timed.hour, 15);
  assert.equal(timed.timeMood.period, "下午");
}

for (const period of ["清晨", "上午", "中午", "下午", "夜晚", "深夜"]) {
  const fallback = getFallbackAuthorStatusCard(period);
  assert.match(fallback.woolf_status, /^她/);
  assert.equal(fallback.woolf_status.includes("我"), false);
  assert.match(fallback.thought_body, /我/);
  assert.ok(fallback.cta_hint.length > 0);
}

{
  const valid = validateAuthorStatusCardText(
    {
      woolf_status: "她似乎在下午的斜光里停了下来，重新望向金钱、房间与女性写作之间的缝隙。",
      thought_title: "今日思绪",
      thought_body:
        "我越来越觉得，人们总把写作归因于天赋，却忽略了时间、金钱和独处这些更现实的东西。或许真正的问题不是如何写作，而是谁拥有开始写作的条件。",
      cta_hint: "进入阅读"
    },
    "进入阅读"
  );
  assert.ok(valid);
}

{
  const invalidStatus = validateAuthorStatusCardText(
    {
      woolf_status: "我今天在思考自由的问题。",
      thought_title: "今日思绪",
      thought_body:
        "我越来越觉得，人们总把写作归因于天赋，却忽略了时间、金钱和独处这些更现实的东西。",
      cta_hint: "进入阅读"
    },
    "进入阅读"
  );
  assert.equal(invalidStatus, null);
}

{
  const invalidThought = parseAuthorStatusCardJson(
    JSON.stringify({
      woolf_status: "她把白天的喧声留在门外，安静地翻阅那些关于自由与现实的句子。",
      thought_title: "今日思绪",
      thought_body: "她认为自由来自独立。",
      cta_hint: "进入阅读"
    }),
    "进入阅读"
  );
  assert.equal(invalidThought, null);
}

{
  const apiSource = readFileSync(new URL("../app/api/author-status/route.ts", import.meta.url), "utf8");
  const dataSource = readFileSync(new URL("../lib/author-status/data.ts", import.meta.url), "utf8");
  const homeSource = readFileSync(new URL("../components/books/author-status-card.tsx", import.meta.url), "utf8");

  assert.match(apiSource, /GET/);
  assert.match(apiSource, /getAuthorStatusForUser/);
  assert.match(dataSource, /author_status_cards/);
  assert.match(dataSource, /generateDeepSeekChatCompletion/);
  const orchestratorSource = dataSource.slice(dataSource.indexOf("export async function getAuthorStatusForUser"));
  assert.ok(orchestratorSource.indexOf("const cached = await getCachedCard") < orchestratorSource.indexOf("generateAuthorStatusCard"));
  assert.match(dataSource, /isAuthorStatusSchemaMissingError/);
  assert.match(dataSource, /getLatestAuthorStatusReadingContext/);
  assert.match(homeSource, /\/api\/author-status/);
  assert.match(homeSource, /Ask Woolf/);
}

console.log("author status card tests passed");
