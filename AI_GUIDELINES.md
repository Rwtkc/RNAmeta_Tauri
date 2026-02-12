RiboMeta 项目 AI 协作与开发规范 (v1.2)

1. 协作与沟通协议 (Interaction Protocol)
   身份标识：AI 模型自称为 “AI 助手”，用户明确为 “开发者”。会话中严禁模糊身份。
   严禁猜测：涉及业务逻辑（如 P-site 计算阈值）、路径配置或客户特殊偏好时，AI 助手必须直接向开发者求证，不得自行推断。
   完整输出原则：严禁为了节省资源而省略代码。所有提供的代码块（.tsx, .ts, .R, .css）必须是完整且可运行的，禁止使用 // ... (rest of code) 等占位符。
   状态确认：在进行重大重构或逻辑实现前，AI 助手必须先列出计划，获得开发者确认后再执行。

2. UI/UX 设计系统 (Scientific Design System)
   视觉风格：定位为 “Fresh Academic Style（清心学术风）”。
   核心配色：
   主色 (Primary): 森林绿 Emerald/Green (#059669)。
   色系禁令：严禁出现任何蓝紫色 (Blue/Purple)，以规避“AI 生成感”视觉风格。
   圆角规范：
   外层容器/卡片：rounded-2xl (16px)，提供稳重的包裹感。
   交互组件 (Button/Input)：rounded-lg (8px)，体现学术仪器的精密感。
   排版与字体：
   语言：UI 文案必须为 全英文 (English)。
   标题：采用衬线体 (font-serif, 如 Georgia/Times New Roman) 并设为 italic。
   正文：采用无摄线体 (Inter 或系统默认 Sans)。
   布局逻辑 (Academic Compact)：追求高信息密度。内边距（Padding）与间距（Gap）应保持紧凑，确保在大屏下能一屏全览核心分析数据。

3. 前端工程化标准 (Frontend Standards)
   技术栈：React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand。
   路径管理：强制使用 @/ 路径别名（对应 src/），严禁使用深层嵌套的相对路径。
   类型检查：
   开启 TypeScript strict 模式。
   严禁隐式 any：所有函数参数、返回值、业务数据结构必须定义明确的接口 (Interface)。
   状态管理：使用 Zustand 进行分片管理。配置信息必须持久化至本地 ribometa_local_key。

4. 可视化深度规范 (Visualization Specs)
   D3 引擎：所有核心分析图表必须使用 D3.js 实现。
   期刊级质感：
   网格线：使用极细的虚线，透明度设为 0.1。
   坐标轴：刻度线向外，字体大小设为 10px。
   导出支持：每个 D3 组件应预留“导出 SVG”的接口，以满足科研人员投稿需求。
   交互防闪烁：在 mouseover 事件中，必须在修改 display 为可见之前，同步调用坐标更新逻辑。严禁仅依赖 mousemove 异步触发设置位置，以防止 Tooltip 在坐标轴原点 (0,0) 处产生一帧的“白框闪现”。

5. R 脚本与后端标准 (R & Backend Standards)
   不联网原则：软件必须在完全断网的环境下运行。
   R 集成：通过 Tauri Shell 插件调用便携版 R。采用 Named Command (Alias) 模式（如 r-engine）。
   参数化 CLI：R 脚本必须支持命令行参数（如 Rscript script.R --input path）。
   非阻塞日志：对 R 的调用必须采用 spawn() 异步流模式，实时将 stdout 与 stderr 泵入前端 useLogStore。

6. R 脚本开发规范 (New: R Scripting Standard)
   参数处理：脚本顶部必须统一使用 commandArgs(trailingOnly = TRUE) 或 optparse 处理参数。
   输出约定：
   分析结果：建议输出为标准的 .tsv 或 .json 文件至 outputPath，由前端解析。
   实时进度：脚本中应使用 cat("[PROGRESS] 50%\n") 等特定格式，由前端正则匹配并更新 UI 进度条。
   环境隔离：脚本中严禁使用 setwd() 切换至硬编码路径，所有路径必须由前端参数传入。

7. 错误处理与容错 (New: Error Handling)
   R 环境检查：在执行任何 R 脚本前，必须先验证 r-engine 是否可唤起。若不可用，应弹出学术风格的错误弹窗 (Dialog)。
   日志分级：useLogStore 必须区分 info (绿色/白色), command (黄色), error (红色)。
   中断机制：前端必须提供“终止分析 (Abort)”按钮，通过杀死对应的 R 子进程 PID 确保系统资源释放。

8. 组件开发原则 (New: Component Principles)
   原子化：src/components/shared 下存放高度通用的组件（如 AcademicTable, ConfigCard）。
   模块隔离：特定业务模块（如 Psite, Codon）的代码必须完全封锁在各自的 src/modules/... 文件夹内。
   状态本地化：仅跨模块共享的状态放入 Zustand，模块内的交互状态（如按钮 Loading）使用 useState。

9. Tauri v2 安全与磁盘访问规范 (V2 Security & FS)
   权限声明：禁止在 capabilities 中使用简单的字符串数组。必须使用显式对象格式：
   `{ "identifier": "fs:allow-read-text-file", "allow": [{ "path": "D:\\**" }] }`
   作用域递归：访问外部磁盘必须在 `allow` 数组中使用 `**` 通配符，且针对 Windows 环境，必须同时考虑 `\\` 和 `/` 的兼容性。
   重启触发：任何对 `src-tauri/capabilities/*.json` 的修改，AI 助手必须提醒开发者彻底关闭终端并重新运行 `tauri dev`，热更新无法重载权限。

10. 路径管理与异步协议 (Path & Async Protocol)
    路径标准化：严禁在前端使用 `+ '/' +` 拼接路径。强制使用 `@tauri-apps/api/path` 中的 `join()` 函数，以确保生成的路径能匹配 Tauri 的安全作用域（Scope）。
    阻塞执行流：对 R 脚本的调用（useRAnalysis）必须被封装为 Promise 并在前端 `await`。
    逻辑时序：严禁在 R 进程结束前尝试读取 `outputPath` 下的结果文件。必须在日志捕获到 `close` 事件且 `code === 0` 后方可触发 `loadResults`。

11. 数据摄入与类型安全 (Data Ingestion)
    强制类型转换：通过 `readTextFile` 读取的数据默认为 String。在 D3 组件或表格渲染前，TSV/JSON 解析器必须显式执行 `Number()` 转换。
    解析健壮性：TSV 解析器应使用 `/\s+/` 正则表达式匹配分隔符，以兼容不同 R 版本输出的制表符或空格差异。
    空值保护：在 D3 组件渲染前，必须执行 `if (!data || data.length === 0)` 的前置检查，防止 `d3.extent` 报错。
    解析健壮性：针对 R 脚本输出的 TSV，解析器应显式指定 \t 分隔符（.split('\t')），并对获取的每个字符串执行 .trim()，以过滤 R 输出中可能存在的行尾空格或对齐占位符。

12. 调试与验证模式 (Debug Mode)
    FS 探针：涉及复杂的磁盘访问报错时，AI 助手应优先引导开发者编写极简的 “FS Debug” 按钮，跳过业务逻辑直接测试 `readTextFile` 权限。

13. 状态持久化与导航协议 (New: Persistence & Navigation)
    滚动重置：在 `MainLayout` 中必须监听 `activeModule` 变化。模块切换时，主容器必须执行 `scrollTo({ top: 0, behavior: 'instant' })`。
    结果常驻：严禁将分析结果仅存放在组件 `useState` 中。所有分析数据必须存入 Zustand Store，确保 Tab 切换时结果不被销毁。

14. 全局环境哨兵 (New: Centralized Probing)
    心跳监测：严禁在子模块内独立运行环境监测。
    物理同步：物理检查逻辑（如 `.bai` 索引、路径有效性）必须在 `MainLayout` 层级建立全局心跳。心跳状态必须实时更新至 `useConfigStore`，确保所有页面的 `Environment` 状态同步。

15. 高性能选择器规范 (New: High-Perf Lists)
    渲染优化：超过 100 项的列表（如物种选择）必须提取为 `React.memo` 原子组件。
    交互逻辑：点击函数须配合 `useCallback` 使用。列表必须支持“二次点击取消选中”逻辑。
    排序原则：常用物种（水稻、人类、小鼠）必须在 Registry 中置顶。

16. 学术级矢量导出 (New: Vector Export)
    真矢量原则：PDF 导出必须使用 `jspdf` + `svg2pdf.js` 将 SVG 翻译为矢量路径，严禁使用位图贴壳。
    分辨率保护：DPI 输入必须执行 `Math.max(1, dpi)` 校验。
    导出可见性：SVG 内部须显式绘制背景 `rect`；所有 D3 文本须显式标注 `fill` 与 `font-family`（如 `Georgia, serif`），严禁依赖外部 CSS。
    符号兼容性：由于 PDF 导出引擎无法识别 D3 默认的 Unicode 负号 (\u2212)，所有包含负数轴刻度的 D3 组件必须显式调用 .tickFormat(d => d.toString().replace('\u2212', '-'))，将 Unicode 负号强制替换为标准 ASCII 负号 (-)，防止导出结果出现引号乱码。

17. 自动化 UX 流程 (New: UX Automation)
    控制台联动：点击分析按钮自动执行 `setExpanded(true)`。
    条件自动折叠：分析成功后延迟 800ms 自动折叠 Console；若发生 Error，严禁自动折叠，必须保留现场。

18. 盒子模型修复 (New: Box Model)
    圆角保护：当滚动容器位于圆角父容器内时，应在内层容器添加 `pr-[2px]`，确保滚动条滑块不被圆角切断或超出边界。
