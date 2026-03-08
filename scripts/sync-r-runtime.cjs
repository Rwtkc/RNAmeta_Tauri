const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "src-tauri", "resources", "r-lang");
const targetRoot = path.join(projectRoot, "src-tauri", "target");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: false,
    preserveTimestamps: true,
  });
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[sync-r-runtime] source runtime not found: ${sourceDir}`);
  process.exit(1);
}

const buildKinds = ["debug", "release"];
let synced = 0;

try {
  for (const kind of buildKinds) {
    const resourceRoot = path.join(targetRoot, kind, "resources");
    fs.mkdirSync(resourceRoot, { recursive: true });

    const destDir = path.join(resourceRoot, "r-lang");
    copyDirSync(sourceDir, destDir);
    synced += 1;
    console.log(`[sync-r-runtime] synced -> ${destDir}`);
  }
} catch (error) {
  if (error && (error.code === "EBUSY" || error.code === "EPERM")) {
    console.error(
      "[sync-r-runtime] target runtime is locked. Stop `pnpm tauri dev` first, then rerun `pnpm sync:r-runtime`."
    );
    process.exit(1);
  }
  throw error;
}

if (synced === 0) {
  console.log("[sync-r-runtime] no target resources directory found yet; nothing to sync.");
}
