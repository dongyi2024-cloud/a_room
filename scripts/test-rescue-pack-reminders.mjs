import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const helperSource = read("lib/reading-slump/rescue-reminder.ts");
const componentSource = read("components/reader/rescue-pack-reminder.tsx");
const readerSource = read("components/reader/reader-shell.tsx");
const dismissRouteSource = read("app/api/reading-events/dismiss/route.ts");
const readingRouteSource = read("app/api/reading-events/route.ts");
const typesSource = read("types/reading-slump.ts");
const cssSource = read("app/globals.css");
const specSource = read("openspec/changes/add-rescue-pack-reminders/specs/rescue-pack-reminders/spec.md");
const tasksSource = read("openspec/changes/add-rescue-pack-reminders/tasks.md");

assert.match(helperSource, /export function isRescuePackReminderEligible/);
assert.match(helperSource, /state\.status !== "steady" && state\.isReminderEligible/);
assert.match(helperSource, /getRescuePackReminderStateKey/);
assert.match(helperSource, /supportsBrowserNotifications/);
assert.match(helperSource, /Notification" in window/);
assert.match(helperSource, /RESCUE_PACK_REMINDER_DISABLED_KEY/);

assert.match(componentSource, /export function RescuePackReminder/);
assert.match(componentSource, /\/api\/reading-events\?book=/);
assert.match(componentSource, /isRescuePackReminderEligible\(state\)/);
assert.match(componentSource, /sentNotificationKeysRef/);
assert.match(componentSource, /sentNotificationKeysRef\.current\.has\(notificationKey\)/);
assert.match(componentSource, /new Notification\("阅读救急包"/);
assert.match(componentSource, /notification\.onclick/);
assert.match(componentSource, /Notification\.requestPermission\(\)/);
assert.match(componentSource, /notificationStatus !== "granted"/);
assert.match(componentSource, /notificationStatus === "default"/);
assert.match(componentSource, /当前浏览器不支持通知，站内提醒仍可使用/);
assert.match(componentSource, /未开启浏览器通知，站内提醒仍可使用/);
assert.match(componentSource, /\/api\/reading-events\/dismiss/);
assert.match(componentSource, /body: JSON\.stringify\(\{ bookId \}\)/);
assert.match(componentSource, /不再提醒/);
assert.match(componentSource, /打开救急包/);
assert.doesNotMatch(componentSource, /requestPermission\(\)[\s\S]*?useEffect\(/);

assert.match(readerSource, /import \{ RescuePackReminder \}/);
assert.match(readerSource, /const \[isRescuePackOpen, setIsRescuePackOpen\]/);
assert.match(readerSource, /const rescuePackRef = useRef/);
assert.match(readerSource, /function openRescuePack/);
assert.match(readerSource, /rescue=1#rescue-pack/);
assert.match(readerSource, /<RescuePackReminder/);
assert.match(readerSource, /id="rescue-pack"/);
assert.match(readerSource, /救急包内容将在 F37 接入/);

assert.match(readingRouteSource, /getLatestReadingSlumpState/);
assert.match(typesSource, /isReminderEligible: boolean/);
assert.match(dismissRouteSource, /dismissReadingSlumpReminder/);

assert.match(cssSource, /\.rescue-pack-reminder/);
assert.match(cssSource, /\.reader-rescue-pack/);
assert.match(cssSource, /\.reader-rescue-pack\.is-open/);

assert.match(specSource, /Browser notifications require explicit user authorization/);
assert.match(specSource, /Reminder frequency is limited/);
assert.match(specSource, /Reminder opens the rescue-pack entry/);
assert.match(tasksSource, /- \[x\] 1\.1/);
assert.match(tasksSource, /- \[x\] 5\.4/);

console.log("rescue pack reminder source checks passed");
