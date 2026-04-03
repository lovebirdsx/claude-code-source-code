这份代码是某款基于 LLM 的终端工具或 SDK（从命名和特性来看，极大概率是 Anthropic 的 **Claude Code** 或类似的 Agent 框架）的**核心调度引擎（Orchestrator）**。

它实现了一个健壮的、支持多轮对话、工具调用（Tool Use）以及复杂上下文管理（Context Management）的 `AsyncGenerator` 查询循环。

为了帮助你更好地理解这个系统的整体流转， 这里我们可以将整个代码模块拆解。以下是针对该文件的深度架构分析和二次开发指南。

---

### 一、 核心架构解析：`queryLoop` 状态机

整个文件的核心是 `queryLoop` 异步生成器函数。它本质上是一个 **`while (true)` 的无限循环**（状态机），代表了 Agent 与模型交互的生命周期。

每个循环迭代（Iteration）代表一个“回合（Turn）”，包含以下核心步骤：
1. **预处理与上下文压缩**：在发送给模型前，裁剪和压缩历史消息。
2. **模型流式调用**：调用底层的 LLM API，处理返回的流（Stream），解析普通文本和工具调用块（Tool Use Blocks）。
3. **错误拦截与恢复**：拦截由于 Token 超限引发的错误，尝试自动恢复而不是直接报错崩溃。
4. **生命周期钩子（Hooks）**：执行拦截、打断和预算检查。
5. **工具执行（Tool Orchestration）**：并发或流式执行模型请求的工具，收集结果。
6. **上下文合并与下一轮**：将工具执行结果和系统级附件（如后台任务、内存预取）组装进消息流，进入下一次循环。

---

### 二、 关键子系统与二次开发切入点

这份代码具有极高的模块化程度。如果你要做二次开发，可以重点关注以下几个子系统：

#### 1. 上下文与内存管理（Context Management）
这是代码中最复杂的部分，为了防止长对话撑爆 Context Window，作者实现了多层级的防线：
* **Tool Result Budget (`applyToolResultBudget`)**: 限制单一工具返回结果的长度（例如读取了一个超大文件）。
* **History Snip (`snipCompactIfNeeded`)**: 裁剪历史记录。
* **Microcompact (`microcompact`)**: 针对特定工具调用（如反复重试的工具）进行微观清理。
* **Context Collapse (`applyCollapsesIfNeeded`)**: 折叠冗余的上下文。
* **Autocompact (`autocompact`)**: 当触发阈值时，自动将前半段对话总结为一条摘要（Summary）。
> **👨‍💻 二开建议：** 如果你需要开发特定场景的 Agent（如超长代码仓库分析），你可能需要调整 `autocompact` 的阈值，或者在 `applyToolResultBudget` 中添加针对你自定义工具的截断逻辑。

#### 2. 工具执行引擎（Tool Execution）
代码支持两种工具执行模式，受 `config.gates.streamingToolExecution` 控制：
* **StreamingToolExecutor**: 流式执行器，模型一边输出参数，工具一边执行（能极大降低延迟）。
* **runTools (Batch)**: 传统的批处理执行器。
> **👨‍💻 二开建议：** 如果你打算接入新的本地能力（如自定义的数据库查询工具、终端命令工具），你应该在外部配置 `toolUseContext.options.tools` 并确保它能被这里的 `StreamingToolExecutor` 或 `runTools` 正常消费。

#### 3. 错误恢复与容错机制（Resilience & Recovery）
大型 Agent 很容易因为网络、上下文长度、或者模型限制而崩溃。代码中设计了精巧的恢复机制：
* **模型降级 (Fallback)**：捕获 `FallbackTriggeredError` 后，自动切换到 `fallbackModel` 重新尝试。
* **Prompt Too Long 恢复**：如果触发 413 错误（Token 溢出），系统会拦截报错，触发 `contextCollapse` 抽水或 `reactiveCompact` (被动压缩)，然后再试一次。
* **Max Output Tokens 恢复**：如果模型生成的内容达到了最大输出上限，代码会自动注入一条 Prompt (`Output token limit hit. Resume directly...`) 让模型接着刚才的思路继续写。
> **👨‍💻 二开建议：** 这里是非常值得学习的工业级 Agent 容错设计。如果你更换了底层 LLM 供应商（比如接入 OpenAI 或开源模型），需要在此处适配不同厂商的错误码，以触发这些恢复机制。

#### 4. 预算控制（Budget Tracking）
防止 Agent 陷入死循环、过度消耗 API 费用的安全机制。
* **Token Budget (`checkTokenBudget`)**：按百分比监控 Token 消耗。
* **Task Budget**：Beta 级别的功能，监控单个任务生命周期内的 API 消耗。
* **最大回合数 (`maxTurns`)**：硬性限制。

#### 5. 异步/后台增强能力
* **Tool Use Summary (`generateToolUseSummary`)**：调用更小/更快的模型（如 Haiku）在后台异步生成工具调用的总结，优化后续的上下文。
* **Skill Prefetch / Memory Prefetch**：预测模型下一步需要的知识或记忆，并在模型生成回复的同时异步拉取，放入 `Attachment` 中。

---

### 三、 核心状态对象说明

在二次开发时，你需要时刻区分**不可变参数**与**可变状态**：

* `QueryParams`: 传入后不可变的配置（如 `systemPrompt`, `querySource`, `maxTurns`）。
* `State` (位于 178 行): 跨回合（Iterate）流转的核心可变状态。包括当前累积的 `messages`、`turnCount`（回合数）、各种重试计数器等。每次触发 `continue` 或重入循环前，都会重新组装这个 `State`。

---

### 探讨你的开发需求

这份代码包含了非常多实验性的特性（通过 `feature('...')` 门控开关控制）。为了更精准地帮助你进行二次开发，我想了解：

你在二次开发中主要想关注哪个方向？是想接入自定义的外部工具、优化长文本的上下文管理逻辑，还是想调整底层的模型通信协议以适配其他大语言模型？
