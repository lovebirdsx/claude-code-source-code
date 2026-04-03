这份 `prompts.ts` 文件是 Claude Code（Anthropic 官方 CLI 工具）的**核心系统提示词（System Prompt）生成引擎**。它的主要职责是根据当前的运行环境、加载的工具、用户的配置以及各类特性开关（Feature Flags），动态拼接出用来指导大模型行为的 System Prompt。

为了方便你进行二次开发，我将从**核心架构**、**关键模块分析**、**特殊逻辑（坑点）**以及**二次开发切入点**四个方面为你进行总结和梳理。

---

## 一、 核心架构设计：静态与动态的分离 (Prompt Caching)

这个文件最精妙的设计在于它为了**提示词缓存（Prompt Caching）**做了严格的结构划分。

* **`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` (核心边界标记):** 这是一个极其重要的常量。系统提示词被分为两半：
    * **边界之前（静态）：** 包含基础设定、任务规范、工具说明等跨会话通用的内容。这部分会被全局缓存（`scope: 'global'`），以极大地节省 API Token 成本和降低延迟。
    * **边界之后（动态）：** 包含特定于当前会话的内容（如当前时间、临时目录、特定的 MCP 状态、记忆上下文等），这部分不被缓存。
    * **⚠️ 开发警告：** 在二次开发时，**绝对不要**把带有用户会话状态或经常变动的变量加到这个边界之前，否则会破坏缓存命中率（甚至导致 Hash 爆炸）。

## 二、 关键模块梳理

以下是构建 System Prompt 的核心函数链，它们拼接成了最终传递给大模型的规则集：

1.  **主编排器 (`getSystemPrompt`)**
    * 整个文件的入口。它判断当前模式（Simple 模式、Proactive 自主模式、标准模式），并将所有的字符串片段组合成一个数组返回。
2.  **环境感知模块 (`computeEnvInfo` / `computeSimpleEnvInfo`)**
    * 收集宿主机信息：当前工作目录（CWD）、是否是 Git 仓库、操作系统类型 (`getUnameSR`)、使用的 Shell 环境（对 Windows 做了特殊兼容）。
    * **模型感知：** 注入当前使用的模型版本及知识截止日期（Knowledge Cutoff）。
3.  **行为与安全准则 (`getSimpleDoingTasksSection`, `getActionsSection`)**
    * **防破坏机制：** 明确指示 AI 在执行高风险操作（如 `rm -rf`、删库、强推 Git）前必须询问用户。
    * **代码哲学：** 规定了 AI 写代码的风格（不写废话注释、不过度封装、不引入 OWASP 漏洞、不要用假数据掩盖测试失败）。
4.  **工具使用策略 (`getUsingYourToolsSection`)**
    * 指导 AI 如何选择工具。例如：强制 AI 优先使用内置的 `FileReadTool`、`GlobTool`，而不是直接调用 `BashTool` 去跑 `cat` 或 `find`（因为内置工具更容易被系统解析和监控）。
    * 支持**并发工具调用**（如果没有依赖关系的话）。
5.  **外部生态接入**
    * **MCP (Model Context Protocol):** `getMcpInstructions` 负责拉取动态挂载的 MCP 服务器的自定义指令。
    * **技能树 (Skills):** 针对 `/commit` 这种用户自定义技能命令的解析。

## 三、 特殊逻辑与潜规则（二次开发避坑指南）

代码中包含了许多特定于 Anthropic 内部业务的逻辑，二次开发时建议清理或注意：

* **内部员工特权 (`process.env.USER_TYPE === 'ant'`):**
    你会看到大量针对 `ant`（Anthropic 内部员工）的特殊逻辑。例如更激进的代码风格、长度限制（`numeric_length_anchors` 限制在 25-100 词内）、以及遇到 Bug 时推荐内部 Slack 频道。二次开发时，这些可以直接删掉或替换为你自己的业务逻辑。
* **卧底模式 (`isUndercover()`):**
    为了防止内部未发布的模型名字泄露到开源代码或 PR 中，代码里藏了一个卧底模式，启用时会隐去真实的 Model ID。
* **Kairos / Proactive (自主智能体模式):**
    文件底部有大量的 `getProactiveSection()` 逻辑。这说明该 CLI 正在或已经支持类似 AutoGPT 的“自主运行”模式。它会通过接收 `<tick>` 标签定时唤醒 AI，AI 可以调用 `SleepTool` 控制节奏，并且会根据用户的终端是否聚焦 (`terminalFocus`) 决定是否静默执行任务。

---

## 四、 二次开发切入点建议

如果你要在它的基础上修改或构建你自己的 AI 编码助手，可以从以下几个地方下刀：

1.  **注入你自己的业务规范 (定制化 Tone & Style)**
    * **修改位置：** `getSimpleToneAndStyleSection` 或 `getSimpleDoingTasksSection`。
    * **做法：** 如果你想让 AI 专门为你公司的前端框架（如 Vue/React）服务，可以在这里硬编码加上：“优先使用 React Hooks 编写组件，遵循 xxx 公司的代码规范”。
2.  **添加新的内置工具 (Add New Tools)**
    * 如果你写了一个新的 Tool（比如直接查阅公司内部 Wiki 的工具），你需要在 `getUsingYourToolsSection` 中加入引导语，告诉大模型：“当遇到架构问题时，必须优先使用 `WIKI_SEARCH_TOOL`”。
3.  **调整安全与确认策略 (Security/Permissions)**
    * **修改位置：** `getActionsSection`。
    * **做法：** 如果你希望做一个完全自动化的后台 Bot，可以弱化这里的“询问确认”逻辑；如果你希望它极度安全，可以在这里列出所有的“高危指令黑名单”。
4.  **优化中文体验 (i18n)**
    * 当前代码虽然支持通过 `settings.language` 切换语言（`getLanguageSection`），但大部分硬编码的提示词都是英文的。如果你只做国内市场，可以考虑将关键的 Section（如 `# Doing tasks`）翻译成中文，或者通过 prompt 强制要求大模型“思考用英文，输出用中文”以节省 Token 和保证代码逻辑。