## 项目说明
本项目为 `woolf_room`，产品名为「一间属于自己的房间」。
这是一个围绕阅读、AI 辅助理解、伍尔夫人格陪伴、个人书架与阅读感悟沉淀展开的阅读应用。

具体产品范围、 需求和阶段规划请查看：
- `docs/product/product-lines.md`
- `docs/product/p0-scope.md`
- `openspec/project.md`

## 技术栈
前端：
- Next.js 14
- App Router
样式：
- Tailwind CSS
- shadcn/ui 组件库
数据库与鉴权：
- Supabase
- Postgres
- Supabase Auth
- RLS 策略
部署：
- 阿里云服务器

## 目录规范
页面文件放在：
- `app/`
通用组件放在：
- `components/`
业务组件可以根据功能模块放在对应目录中，但应保持结构清晰，避免把无关组件堆在同一个文件里。
与 Supabase 相关的客户端、服务端工具函数应集中管理，避免在页面中重复写数据库连接逻辑。

## AI 架构约束
涉及 AI 对话编排、多轮上下文管理、选区问询、章节结束互动、工具调用或节点式工作流时，默认优先采用 LangGraph 架构设计。
不要把所有 AI 能力都堆成单个长 prompt + 单次调用；优先拆成可观察、可测试的节点与状态流。
如果某个 change 因场景简单或复杂度原因不适合使用 LangGraph，必须在对应的 OpenSpec `proposal.md` 或 `design.md` 中明确说明原因和替代方案。
LangGraph 在本项目中主要承担 AI 编排职责，不等于整站所有业务都必须 agent 化。

## OpenSpec 工作规范
所有功能开发必须遵循 OpenSpec 流程。
不要直接根据聊天记录开始写代码。开始开发前，必须先确认对应的 OpenSpec change 已存在，或先创建对应 change。
每个 change 只处理一个明确的功能单元，不要把多个无关功能混在一次开发里。
P0 阶段按 `docs/product/P0_PRD.md` 中的功能顺序分模块推进开发，不要跳序并行开启多个未验收需求。
每个需求必须进入单独的 change，不要把两个需求合并到同一个 change 中。
change 命名默认参考 `docs/product/P0_PRD.md` 末尾给出的 OpenSpec change 建议列表。

开发前需要阅读：
- `openspec/project.md`
- 当前 change 下的 `proposal.md`
- 当前 change 下的 `tasks.md`
- 当前 change 下的 spec 文件
开发时必须严格按照当前 spec 范围实现，不得擅自扩大功能范围。
如果发现当前 spec 不完整，应先补充或修改 spec，再继续开发。

## 验收规则
只有满足以下条件时，一个功能才算真正完成：

- 实现内容与 spec 保持一致；
- 主要用户流程可以正常走通；
- 关键边界情况已经测试过；
- 涉及数据保存的功能，已验证数据能够正确持久化；
- 涉及 PC 端和移动端的功能，已分别检查两端表现；
- 涉及 AI 的功能，已使用真实案例测试 AI 表现；
- 用户已经手动测试并确认验收通过。

未通过人工验收前，不要开启下一个 spec。

## Git 工作规范

每完成一个功能模块，并通过测试与人工验收后，立即提交 commit。
commit message 格式为：
```bash
feat: 描述
fix: 描述
refactor: 描述
```
