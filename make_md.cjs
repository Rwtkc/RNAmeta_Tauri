const fs = require("fs");
const path = require("path");

/**
 * RiboMeta 项目代码整理脚本 (v1.2)
 * 排除资源目录，确保生成的 Context 专注于业务逻辑代码
 */
const OUTPUT_FILE = "ribometa_context.md";

// 包含的文件扩展名
const INCLUDE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".css",
  ".json",
  ".R",
  ".toml",
  ".html",
];

// 排除的目录：增加了 "resources" 目录
const EXCLUDE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "target",
  ".vscode",
  "public",
  "icons",
  "gen",
  "r-portable-windows",
  "resources", // 核心修改：防止扫描巨大的 R 环境
];

const rootDir = process.cwd();
let markdownContent = `# RiboMeta Project Context\n\n> Generated at: ${new Date().toLocaleString()}\n\n`;

function walkDir(currentPath) {
  const files = fs.readdirSync(currentPath);
  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    const relativePath = path.relative(rootDir, fullPath);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      // 检查当前文件夹名是否在排除列表中
      if (!EXCLUDE_DIRS.includes(file)) {
        walkDir(fullPath);
      }
    } else {
      const ext = path.extname(file);
      // 检查扩展名，并排除输出文件本身及锁定文件
      if (
        INCLUDE_EXTENSIONS.includes(ext) &&
        file !== OUTPUT_FILE &&
        file !== "pnpm-lock.yaml"
      ) {
        const content = fs.readFileSync(fullPath, "utf8");
        const lang =
          ext.slice(1) === "tsx"
            ? "tsx"
            : ext.slice(1) === "ts"
            ? "typescript"
            : ext.slice(1) === "html"
            ? "html"
            : ext.slice(1);

        markdownContent += `\n---\n\n### 📄 File: ${relativePath}\n\n`;
        markdownContent += `\`\`\`${lang}\n${content}\n\`\`\`\n`;
        console.log(`[Packaged] ${relativePath}`);
      }
    }
  }
}

try {
  console.log("Starting RiboMeta context packaging (excluding resources)...");
  walkDir(rootDir);
  fs.writeFileSync(OUTPUT_FILE, markdownContent);
  console.log(`\nSuccess! Context saved to: ${OUTPUT_FILE}`);
} catch (err) {
  console.error("Error during packaging:", err);
}
