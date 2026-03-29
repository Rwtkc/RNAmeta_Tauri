const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "r-lang");
const targetRoot = path.join(projectRoot, "src-tauri", "target");
const sourceExe = path.join(sourceDir, "bin", "Rscript.exe");
const forceSync = process.env.FORCE_R_RUNTIME_SYNC === "1";

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: false,
    preserveTimestamps: true
  });
}

function runtimeFingerprint(filePath) {
  const stats = fs.statSync(filePath);
  return JSON.stringify({
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  });
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[sync-r-runtime] source runtime not found: ${sourceDir}`);
  process.exit(1);
}

if (!fs.existsSync(sourceExe)) {
  console.error(`[sync-r-runtime] source executable not found: ${sourceExe}`);
  process.exit(1);
}

const sourceFingerprint = runtimeFingerprint(sourceExe);

for (const kind of ["debug", "release"]) {
  const resourceRoot = path.join(targetRoot, kind, "resources");
  fs.mkdirSync(resourceRoot, { recursive: true });
  const destDir = path.join(resourceRoot, "r-lang");
  const destExe = path.join(destDir, "bin", "Rscript.exe");
  const markerFile = path.join(destDir, ".runtime-sync.json");

  if (!forceSync && fs.existsSync(destExe)) {
    try {
      const destFingerprint = runtimeFingerprint(destExe);
      if (destFingerprint === sourceFingerprint) {
        if (!fs.existsSync(markerFile)) {
          fs.writeFileSync(markerFile, sourceFingerprint, "utf8");
        } else {
          const marker = fs.readFileSync(markerFile, "utf8");
          if (marker !== sourceFingerprint) {
            fs.writeFileSync(markerFile, sourceFingerprint, "utf8");
          }
        }
        console.log(`[sync-r-runtime] ${kind} runtime already synced, skipping.`);
        continue;
      }
    } catch {
      // Fall through to full sync when validation cannot be completed.
    }
  }

  try {
    copyDirSync(sourceDir, destDir);
    fs.writeFileSync(markerFile, sourceFingerprint, "utf8");
    console.log(`[sync-r-runtime] synced -> ${destDir}`);
  } catch (error) {
    if (error && (error.code === "EBUSY" || error.code === "EPERM")) {
      console.error(
        "[sync-r-runtime] target runtime is locked. Stop the running desktop process and retry."
      );
      process.exit(1);
    }
    throw error;
  }
}
