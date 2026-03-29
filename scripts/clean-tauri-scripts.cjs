const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const targetRoot = path.join(projectRoot, "src-tauri", "target");

for (const kind of ["debug", "release"]) {
  const scriptsDir = path.join(targetRoot, kind, "resources", "scripts");
  fs.rmSync(scriptsDir, { recursive: true, force: true });
  console.log(`[clean-tauri-scripts] removed -> ${scriptsDir}`);
}
