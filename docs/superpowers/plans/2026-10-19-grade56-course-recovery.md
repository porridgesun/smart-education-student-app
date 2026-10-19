# 智芽 5–6 年级完整课程恢复与全学段奖励闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 5–6 年级《AI 探索实验室》从九张摘要卡恢复为可完整学习的九章读本，并验证 1–2、3–4、5–6 年级的知识、挑战、积分和勋章闭环。

**Architecture:** 保持 CoursePart 负责目录、关卡与测试的轻量字段；新增按 CoursePartId 索引的 Grade56LessonDetail 数据层，承载每章的适龄正文、图解、实验、安全、小挑战和可选视频。CourseContentPage 只消费该详情数据并复用既有的完成学习、通过测试和积分账本机制，不恢复任何中学端路由、主题或状态。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、React Testing Library、lucide-react。

**Spec:** docs/superpowers/specs/2026-10-19-grade56-course-recovery-design.md

## Global Constraints

- 项目名称固定为“智芽”，产品仅面向小学 1–6 年级；不得恢复中学端入口、主题、商城物品或账号状态。
- 5–6 年级的原始资料只能取自历史提交 a9bd930:src/features/knowledge/content/lab/course.html；不得直接嵌入旧初中 HTML，也不得保留“初中”“7–9 年级”等文案。
- 九章均按“生活问题 → 图解知识 → 动手实验 → 安全提醒 → 小挑战 → 章节测试”顺序呈现；视频可选，不影响完成学习、挑战或奖励。
- 适龄化使用校园/生活情境和可在老师、家长或课堂协助下完成的纸面、观察或安全物品实验；不得要求学生采集人脸、姓名、地址、声音、精确位置等个人信息。
- 继续使用本地演示状态，不接入真实账号、云同步、外部视频 API 或新依赖；视频使用现有 Bilibili 嵌入/新窗口链接方式。
- 同一章节知识、测试、章节徽章和课程终章奖励只能结算一次；刷新、返回、切换同段年级和重复点击均不可重复加分。
- 5–6 年级第 9 章的知识和测试都完成后，显示“AI 探索小导师”终章勋章。
- 不修改 .worktrees/ai-companion-redesign 中用户暂停的 AI 伙伴 2.5D 工作。

---

## File structure

- src/features/knowledge/content/grade56Content.ts：保留九个 CoursePart 目录项，新增 Grade56LessonDetail、Grade56Video、GRADE56_LESSON_DETAILS 与详情查询函数；这是 5–6 年级唯一的正文内容源。
- src/features/knowledge/CourseContentPage.tsx：以详情对象渲染固定学习节奏、概念小卡、可选视频和测试入口，不改变 1–2、3–4 年级渲染路径。
- src/features/knowledge/course-content.css：只增加 5–6 年级读本组件所需样式，保证小屏纵向阅读、播放器降级与按钮可触达。
- src/features/knowledge/CourseContentPage.test.tsx：覆盖完整章节块、适龄内容、视频可选性和知识完成一次性。
- src/features/knowledge/courseCatalog.test.ts：断言九章仍与目录、测试、徽章同 ID 对齐，且每章详情完整、无退役中学文案。
- src/app/learningState.actions.test.tsx、src/app/points.test.ts：覆盖每个年级段知识/测试/徽章/终章积分的首次结算与幂等性。
- src/features/profile/rewards.test.tsx：从“我的勋章”“积分账户”验证三个年级段的课程徽章、终章徽章和账本同步。
- vite.config.ts：仅在确认现有全量测试会扫描 .worktrees/** 时排除它，避免暂停工作树被 Vitest 误当成源码套件。

### Task 1: 建立 5–6 年级完整、适龄的章节详情数据

**Files:**
- Modify: src/features/knowledge/content/grade56Content.ts
- Modify: src/features/knowledge/courseCatalog.test.ts

**Interfaces:**
- Consumes: CoursePart、CoursePartId 和历史读本 a9bd930:src/features/knowledge/content/lab/course.html。
- Produces: Grade56LessonDetail、Grade56Video、GRADE56_LESSON_DETAILS: Record<CoursePartId, Grade56LessonDetail>、getGrade56LessonDetail(partId: CoursePartId): Grade56LessonDetail | undefined。
- Preserves: GRADE56_PARTS: CoursePart[] 及 ael-1 至 ael-9 的标题、顺序、测试和勋章 ID。

- [ ] **Step 1: 写出详情完整性的失败测试**

在 courseCatalog.test.ts 新增下列测试；先只导入未来接口，确保当前测试因接口不存在而失败。

~~~ts
import { GRADE56_LESSON_DETAILS } from './content/grade56Content'

it('gives every AI exploration chapter a complete primary-school lesson detail', () => {
  const course = COURSE_PACKAGES['grade5-6']
  const details = course.parts.map((part) => GRADE56_LESSON_DETAILS[part.id])

  expect(details).toHaveLength(9)
  expect(details.every((detail) => detail)).toBe(true)
  expect(details.every((detail) => (
    detail.intro.trim().length >= 80
    && detail.visualSteps.length >= 3
    && detail.experiment.steps.length >= 3
    && detail.safetyChecklist.length >= 2
    && detail.challenge.instructions.length >= 2
    && detail.challenge.successHint.trim().length > 0
  ))).toBe(true)
  expect(JSON.stringify(details)).not.toMatch(retiredCopy)
})
~~~

- [ ] **Step 2: 运行失败测试**

Run: npm test -- src/features/knowledge/courseCatalog.test.ts --run  
Expected: FAIL，提示 GRADE56_LESSON_DETAILS 不是已导出的成员或上述完整性断言不满足。

- [ ] **Step 3: 定义稳定、单一职责的详情模型**

在 grade56Content.ts 的 GRADE56_PARTS 后新增如下类型与查询接口；CoursePart 保持不变，避免目录、地图和题库承担长正文。

~~~ts
export type Grade56Video = {
  title: string
  bvid: string
  watchPrompt: string
}

export type Grade56LessonDetail = {
  intro: string
  visualTitle: string
  visualSteps: Array<{ label: string; explanation: string }>
  experiment: { title: string; materials: string[]; steps: string[]; recordPrompt: string }
  safetyChecklist: string[]
  challenge: { title: string; instructions: string[]; successHint: string }
  video?: Grade56Video
}

export const GRADE56_LESSON_DETAILS: Record<CoursePartId, Grade56LessonDetail> = {
  'ael-1': systemLesson,
  'ael-2': dataLesson,
  'ael-3': algorithmLesson,
  'ael-4': experimentLesson,
  'ael-5': reviewLesson,
  'ael-6': generativeLesson,
  'ael-7': productLesson,
  'ael-8': safetyLesson,
  'ael-9': projectLesson,
}

export function getGrade56LessonDetail(partId: CoursePartId) {
  return GRADE56_LESSON_DETAILS[partId]
}
~~~

- [ ] **Step 4: 把历史读本逐章改写成小学高年级可执行内容**

从历史 HTML 逐章提取“真实问题、实验、案例、可选视频、项目”信息，但按下列九个明确主题和边界写入 GRADE56_LESSON_DETAILS。每章至少 80 字 intro、3 条 visualSteps、3 步实验、2 条安全提醒、2 条挑战说明。

~~~text
ael-1  校园植物识别器：数据、算法、模型、算力、应用的分工图；画五位队员系统图。
ael-2  校园植物照片卡：收集、标注、整理、训练、测试；找模糊、重复、贴错标签的样本。
ael-3  校园问题工具箱：分类、预测、分组、推荐；为借阅、天气、失物、社团活动配工具。
ael-4  教室物品识别实验：安全物品照片的采集—训练—测试—改进；不得拍人或收集隐私。
ael-5  识别器成绩单：十次测试、准确率、错误案例；写有证据的改进建议。
ael-6  提示词与核验：比较两条提示，课本/可靠来源核对事实，并标注 AI 参与。
ael-7  校园节能助手：明确使用者、需求、功能、纸面原型和试用反馈；不以便利换隐私。
ael-8  AI 安全红黄绿灯：深度伪造、信息茧房、版权、陌生链接与向可信成年人求助。
ael-9  我的 AI 小项目：目标、输入、输出、测试、风险、改进六格项目画布；不收集敏感信息。
~~~

仅为能帮助理解的章节保留短视频：ael-1、ael-3、ael-4、ael-6、ael-9。视频 BVID 从历史读本对应章节抄录，并把 watchPrompt 改写成 2–3 个高年级学生可回答的问题。ael-2、ael-5、ael-7、ael-8 不设 video，以防“每章硬塞视频”。

- [ ] **Step 5: 运行数据与课程对齐测试**

Run: npm test -- src/features/knowledge/courseCatalog.test.ts --run  
Expected: PASS，且既有九章标题、题库 ID、徽章 ID、术语首次解释等断言全部仍通过。

- [ ] **Step 6: 提交数据层变更**

~~~bash
git add src/features/knowledge/content/grade56Content.ts src/features/knowledge/courseCatalog.test.ts
git commit -m "feat: restore detailed grade 5-6 AI lessons"
~~~

### Task 2: 用完整学习节奏重做 5–6 年级读本渲染

**Files:**
- Modify: src/features/knowledge/CourseContentPage.tsx
- Modify: src/features/knowledge/course-content.css
- Modify: src/features/knowledge/CourseContentPage.test.tsx

**Interfaces:**
- Consumes: getGrade56LessonDetail(part.id): Grade56LessonDetail | undefined、useAppState().completeKnowledge(partId, title)。
- Produces: 固定顺序的 5–6 年级章节视图及“去第 N 章测试”按钮；按钮只走现有页面返回/测试路由，不直接把测试标记为通过。
- Preserves: QMX 漫画和 CXD Markdown 路径、完成本部分知识按钮、30 分知识奖励提示。

- [ ] **Step 1: 写出读本块与可选视频的失败测试**

在 CourseContentPage.test.tsx 新增两个用例：第 4 章应出现所有固定块和视频，第 8 章应没有视频卡但仍能完成知识。

~~~tsx
it('renders the full primary-school lab sequence for chapter four', () => {
  render(<AppStateProvider><CourseContentPage courseId="ael" chapterNum={4} onBack={vi.fn()} /></AppStateProvider>)
  expect(screen.getByRole('heading', { name: '生活问题' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '图解知识' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '动手实验' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '安全提醒' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '小挑战' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '选看视频' })).toBeInTheDocument()
  expect(screen.getByText('去第 4 章测试')).toBeInTheDocument()
})

it('does not require a video for the safety chapter', () => {
  render(<AppStateProvider><CourseContentPage courseId="ael" chapterNum={8} onBack={vi.fn()} /></AppStateProvider>)
  expect(screen.queryByRole('heading', { name: '选看视频' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '完成本部分知识' })).toBeInTheDocument()
})
~~~

- [ ] **Step 2: 运行失败测试**

Run: npm test -- src/features/knowledge/CourseContentPage.test.tsx --run  
Expected: FAIL，因为现有 Grade56Content 只有“核心知识/小实验”等摘要文本卡。

- [ ] **Step 3: 让 5–6 年级渲染器使用详情模型**

将 Grade56Content 的 props 改为 part 和 detail；在 CourseContentPage 的 ael 分支中先取详情，只有详情存在时渲染。不要在 UI 中重复拼接课程文案。

~~~tsx
const grade56Detail = courseId === 'ael' && part
  ? getGrade56LessonDetail(part.id)
  : undefined

{courseId === 'ael' && part && grade56Detail && (
  <Grade56Content part={part} detail={grade56Detail} />
)}
~~~

Grade56Content 严格按以下顺序输出带可访问标题的 section：

~~~tsx
<section><h2>生活问题</h2><p>{detail.intro}</p></section>
<section><h2>图解知识</h2>{detail.visualSteps.map((step) => <dl key={step.label}><dt>{step.label}</dt><dd>{step.explanation}</dd></dl>)}</section>
<section><h2>动手实验</h2><p>准备：{detail.experiment.materials.join('、')}</p><ol>{detail.experiment.steps.map((step) => <li key={step}>{step}</li>)}</ol><p>{detail.experiment.recordPrompt}</p></section>
<section><h2>安全提醒</h2><ul>{detail.safetyChecklist.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
<section><h2>小挑战</h2><ol>{detail.challenge.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol><p>{detail.challenge.successHint}</p></section>
{detail.video && <LessonVideoCard video={detail.video} />}
<aside><p>完成阅读后，可到测试页挑战本章。</p><button type="button">去第 {part.number} 章测试</button></aside>
~~~

创建同文件私有 LessonVideoCard：iframe 使用 Bilibili player 地址和 video.bvid；同卡提供 target="_blank"、rel="noopener noreferrer" 的“在视频平台打开”链接及 watchPrompt，并加 title={video.title}。不可自动播放。

- [ ] **Step 4: 增加移动端安全布局样式**

在 course-content.css 为 .grade56-* 添加独立样式：正文卡 max-width 720px、概念/图解网格在 max-width 520px 下单列、步骤序号使用 CSS counter、检查项高对比、视频用 aspect-ratio: 16 / 9、iframe 宽度 100% 且无边框。测试入口在窄屏占满行并保留至少 44px 高触控区域；不要修改 QMX 和 CXD 选择器。

- [ ] **Step 5: 运行内容页面测试**

Run: npm test -- src/features/knowledge/CourseContentPage.test.tsx --run  
Expected: PASS，包含已有的“完成一次仅得一次 30 分”用例、新增完整块顺序和无视频章节用例。

- [ ] **Step 6: 手动验收 5–6 年级三个代表章节**

Run: npm run dev  
Check: 以五年级账号依次打开第 1、4、8、9 章；确认第 4 章视频可嵌入或跳转、第 8 章无空视频占位、第 9 章有项目六格挑战，页面最底部的完成知识和测试入口均可滚动触达。

- [ ] **Step 7: 提交读本界面变更**

~~~bash
git add src/features/knowledge/CourseContentPage.tsx src/features/knowledge/course-content.css src/features/knowledge/CourseContentPage.test.tsx
git commit -m "feat: render full grade 5-6 learning chapters"
~~~

### Task 3: 验证并补齐三个年级段的奖励结算幂等性

**Files:**
- Modify: src/app/points.test.ts
- Modify: src/app/learningState.actions.test.tsx
- Modify: src/features/profile/rewards.test.tsx
- Modify: src/features/profile/medalsData.ts（仅当测试揭示课程终章状态或提示文案无法按当前段正确派生时）

**Interfaces:**
- Consumes: buildProgressRewardTransactions(before, after, band, partIds, occurredAt)、AppStateProvider.completeKnowledge、AppStateProvider.passTest、getMedalSummary(course, progress)。
- Produces: 对 qmx、cxd、ael 一致的知识 +30、测试 +50、章节徽章 +20、全部章节完成 +100 的一次性账本记录，以及“我的”中正确的章节/终章勋章状态。
- Preserves: 现有奖励数值、processedRewardIds、默认 2000 积分及商城扣分机制。

- [ ] **Step 1: 为三段奖励函数写参数化失败测试**

在 points.test.ts 增加参数化测试，使用各段首章 ID 和完整课程 partIds；每次只把一章从未完成推进到“知识 + 测试”完成。

~~~ts
it.each([
  ['grade1-2', ['qmx-1']],
  ['grade3-4', ['cxd-1']],
  ['grade5-6', ['ael-1']],
] as const)('awards the same chapter ledger for %s', (band, [partId]) => {
  const before = { knowledgeCompleted: [], testsPassed: [] }
  const after = { knowledgeCompleted: [partId], testsPassed: [partId] }
  const txs = buildProgressRewardTransactions(before, after, band, [partId], '2026-10-19')
  expect(txs.map((tx) => [tx.eventId, tx.amount])).toEqual([
    ['knowledge:' + partId, 30], ['test:' + partId, 50], ['medal:' + partId, 20], ['band:' + band, 100],
  ])
})
~~~

再增加完整段的最终一步测试：先设置除最后一章外均完成，完成最后一章后必须仅产生该章的知识/测试/徽章及一次 band 事件；第二次相同推进不得产生交易。

- [ ] **Step 2: 运行奖励函数测试**

Run: npm test -- src/app/points.test.ts --run  
Expected: 若当前实现已满足，PASS；若失败，只修复 buildProgressRewardTransactions 或 getPartIdsForBand 的逻辑，禁止为通过测试硬编码某个年级段。

- [ ] **Step 3: 为 AppState 三段进度增加交互级测试**

把 learningState.actions.test.tsx 中只写死 ael-4 的 Harness 改为接收 { grade, partId, title } 参数；新增下列参数化断言。

~~~tsx
it.each([
  ['grade1', 'qmx-1', '启明星岛'],
  ['grade3', 'cxd-1', 'AI 超能力图鉴'],
  ['grade5', 'ael-1', 'AI 系统拆解站'],
] as const)('persists a one-time knowledge/test/medal reward for %s', async (grade, partId, title) => {
  const user = userEvent.setup()
  render(<AppStateProvider><Harness grade={grade} partId={partId} title={title} /></AppStateProvider>)
  await user.click(screen.getByRole('button', { name: '完成知识' }))
  await user.click(screen.getByRole('button', { name: '完成知识' }))
  await user.click(screen.getByRole('button', { name: '通过测试' }))
  await user.click(screen.getByRole('button', { name: '通过测试' }))
  const saved = JSON.parse(localStorage.getItem('student-app-state') ?? '{}')
  expect(saved.transactions.filter((tx) => tx.eventId === 'knowledge:' + partId)).toHaveLength(1)
  expect(saved.transactions.filter((tx) => tx.eventId === 'test:' + partId)).toHaveLength(1)
  expect(saved.transactions.filter((tx) => tx.eventId === 'medal:' + partId)).toHaveLength(1)
})
~~~

同时保留“未学知识不能通过测试”的用例，分别至少在 qmx-2、cxd-2、ael-2 之一覆盖，确保同一保护路径未被课程详情改动绕过。

- [ ] **Step 4: 运行 AppState 奖励测试**

Run: npm test -- src/app/learningState.actions.test.tsx --run  
Expected: PASS；重复点击后状态数组不重复，积分明细中每个 knowledge、test、medal 事件恰好一条。

- [ ] **Step 5: 为“我的”写三段同步验收测试**

在 rewards.test.tsx 使用 createDefaultState() 加载每一段已完成首章的 progress 和对应三笔交易，参数化渲染 MedalsPage 和 PointsPage。断言课程徽章显示“已点亮”，积分明细包含“完成知识：章节标题”和“通过测试：章节标题”。

额外保留/扩展 ael 全通关用例，断言“AI 探索小导师”显示“已点亮”；qmx/cxd 全通关分别断言“启明星守护者”和“创想大陆之星”。如果这些测试发现 getMedalSummary 无法根据 course 与 progress 正确派生，才修改 medalsData.ts，接口保持 getMedalSummary(course, progress) 不变。

- [ ] **Step 6: 运行奖励与资料页测试**

Run: npm test -- src/app/points.test.ts src/app/learningState.actions.test.tsx src/features/profile/rewards.test.tsx --run  
Expected: PASS，三个学段的积分、章节徽章、终章徽章和重复结算保护均被覆盖。

- [ ] **Step 7: 提交奖励验证变更**

~~~bash
git add src/app/points.test.ts src/app/learningState.actions.test.tsx src/features/profile/rewards.test.tsx src/features/profile/medalsData.ts
git commit -m "test: cover primary learning rewards across grade bands"
~~~

### Task 4: 执行全量回归并处理暂停工作树对 Vitest 的影响

**Files:**
- Modify: vite.config.ts（仅当第一次全量测试证实扫描 .worktrees 导致错误时）
- Modify: docs/superpowers/plans/2026-10-19-grade56-course-recovery.md（若测试命令或解决方式需要记录）

**Interfaces:**
- Consumes: Vite/Vitest 当前配置和本计划前三项实现。
- Produces: 可重复运行、不会触碰暂停 AI 伙伴工作树的测试命令。
- Preserves: server.proxy['/api/companion']、现有 jsdom 配置与正常源代码测试发现规则。

- [ ] **Step 1: 执行全量测试并记录第一个失败点**

Run: npm test -- --run  
Expected: 所有主项目测试通过；如果失败路径位于 .worktrees/ai-companion-redesign/，这是测试发现范围问题，不是 AI 伙伴实现失败。

- [ ] **Step 2: 仅在确认误扫工作树时作最小配置修复**

若且仅若 Step 1 的失败来自 .worktrees/**，在 vite.config.ts 的 test 配置加入明确排除项：

~~~ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: true,
  exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
},
~~~

不要删除 .worktrees 目录、不要修改其文件、不要用宽泛 glob 排除 src/**。

- [ ] **Step 3: 重跑全量测试**

Run: npm test -- --run  
Expected: PASS；所有课程、测试、奖励、认证与商城测试仍被发现。

- [ ] **Step 4: 生产构建验证**

Run: npm run build  
Expected: PASS，TypeScript 与 Vite 均无错误。

- [ ] **Step 5: 完整手动验收**

Run: npm run dev  
Check:

~~~text
1. 五年级：知识页有 9 章；第 1、4、8、9 章不是摘要空壳，底部按钮均可触达。
2. 五年级：完成未完成章节知识，再通过相同测试；“我的勋章”和“积分账户”各只增加一次。
3. 一、三、五年级各验证一章的“完成知识 → 通过测试”同步链路。
4. 六年级与五年级共享 grade5-6 进度；切换到三年级不会混入 ael 章节奖励。
5. 全部完成 5–6 九章时出现“AI 探索小导师”；重复打开或点击不再加分。
6. 不存在中学端导航、初中/7–9 年级文案，且暂停的 AI 伙伴工作树没有变更。
~~~

- [ ] **Step 6: 提交回归配置（如有）与最终实现**

~~~bash
git add vite.config.ts docs/superpowers/plans/2026-10-19-grade56-course-recovery.md
git commit -m "test: isolate primary course regression suite"
git status --short
~~~

如果 vite.config.ts 未修改，提交时只暂存确有改动的文件；提交前 git status --short 必须不包含 .worktrees/ai-companion-redesign 的任何路径。

## Self-review

### 1. Spec coverage

- 九章原完整课程的适龄重写、完整正文、实验与项目：Task 1。
- 固定学习节奏、可选视频与无视频章节不受阻：Task 2。
- 1–2、3–4、5–6 的知识 + 测试 + 积分 + 章节徽章同步：Task 3。
- 5–6 第 9 章完成后“AI 探索小导师”总徽章：Task 3 的资料页全通关用例。
- 幂等性：Task 3 的函数级、状态级与资料页测试。
- 不恢复中学端/不碰暂停 AI 工作树：全局约束与 Task 4。
- 构建、全量测试及手动回归：Task 4。

### 2. Placeholder scan

已检查本计划：没有 TBD、TODO、“稍后实现”、“写适当测试”等无执行细节占位；所有测试步骤均给出目标文件、断言或命令。

### 3. Type consistency

- Task 1 定义并导出 Grade56LessonDetail、Grade56Video、GRADE56_LESSON_DETAILS、getGrade56LessonDetail。
- Task 2 消费相同函数返回的 Grade56LessonDetail，不新增第二份内容模型。
- Task 3 保持既有 buildProgressRewardTransactions、completeKnowledge、passTest、getMedalSummary 的类型与签名。


