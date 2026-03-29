const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "src-tauri", "resources", "scripts");
const targetRoot = path.join(projectRoot, "src-tauri", "target");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: false,
    preserveTimestamps: true
  });
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[sync-tauri-resources] source scripts not found: ${sourceDir}`);
  process.exit(1);
}

for (const kind of ["debug", "release"]) {
  const destDir = path.join(targetRoot, kind, "resources", "scripts");
  copyDirSync(sourceDir, destDir);
  console.log(`[sync-tauri-resources] synced -> ${destDir}`);
}
