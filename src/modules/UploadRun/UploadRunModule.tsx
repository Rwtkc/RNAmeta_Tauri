import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { BadgeCheck, Clock3, Rows3, Upload } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { PreviewTable } from "@/types/native";

export function UploadRunModule() {
  const [activePreviewFile, setActivePreviewFile] = useState("");
  const [previewError, setPreviewError] = useState("");
  const { selectedFiles, preview, previewFile, setSelectedFiles, setPreview } = useAppStore();

  function basename(path: string) {
    return path.split(/[/\\]/).pop() || path;
  }

  async function chooseBedFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "BED files",
          extensions: ["bed"]
        }
      ]
    });

    if (!selected) {
      return;
    }

    const files = Array.isArray(selected) ? selected : [selected];
    const nextFiles = files.filter(
      (file): file is string => typeof file === "string" && file.length > 0
    );

    if (nextFiles.length === 0) {
      setSelectedFiles([]);
      return;
    }

    try {
      const normalizedFiles = await invoke<string[]>("normalize_uploaded_bed_files", {
        paths: nextFiles
      });
      setSelectedFiles(nextFiles, normalizedFiles);
      setPreviewError("");
    } catch (error) {
      setSelectedFiles([]);
      setPreview(null, "");
      setPreviewError(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (selectedFiles.length === 0) {
      if (activePreviewFile) {
        setActivePreviewFile("");
      }
      return;
    }

    if (!activePreviewFile || !selectedFiles.includes(activePreviewFile)) {
      setActivePreviewFile(selectedFiles[0]);
    }
  }, [activePreviewFile, selectedFiles]);

  useEffect(() => {
    const activeFile = activePreviewFile;

    if (!activeFile) {
      setPreview(null, "");
      setPreviewError("");
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      try {
        const result = await invoke<PreviewTable>("read_delimited_preview", {
          path: activeFile,
          maxLines: 10
        });

        if (!cancelled) {
          setPreview(result, activeFile);
          setPreviewError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null, activeFile);
          setPreviewError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [activePreviewFile, setPreview]);

  return (
    <section className="module-page">
      <div className="module-page__hero">
        <h1>Upload / Run</h1>
        <p>
          Stage shared BED inputs for the RNAmeta desktop session.
        </p>
      </div>

      <div className="upload-panel-stack">
        <UploadFieldCard
          title="BED Collection"
          description="Attach the BED files that will seed this desktop session."
          filename={activePreviewFile || "No BED file selected yet"}
          status={selectedFiles.length > 0 ? "ready" : "waiting"}
          actionLabel={selectedFiles.length > 0 ? "Replace BED files" : "Choose BED files"}
          onAction={() => void chooseBedFiles()}
        >
          {selectedFiles.length > 0 ? (
            <div className="selected-files-panel">
              <div className="selected-files-panel__head">
                <span>{`Selected files (${selectedFiles.length})`}</span>
              </div>

              <div className="selected-files-list">
                {selectedFiles.map((filePath) => {
                  const isActive = filePath === activePreviewFile;

                  return (
                    <button
                      key={filePath}
                      type="button"
                      className={`selected-file-chip${isActive ? " is-active" : ""}`}
                      onClick={() => setActivePreviewFile(filePath)}
                    >
                      <span>{basename(filePath)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </UploadFieldCard>

        <section className="config-card">
          <div className="config-card__head">
            <div className="config-card__icon">
              <Rows3 size={18} />
            </div>
            <div>
              <h3>Preview Table</h3>
              <p>Show the first 10 rows of the currently selected BED file.</p>
            </div>
          </div>

          <div className="table-shell">
            {previewError ? (
              <div className="table-shell__empty">Failed to read preview: {previewError}</div>
            ) : preview && preview.rows.length > 0 ? (
              <div className="preview-table-wrap">
                <div className="preview-table-wrap__meta">
                  <span>Source</span>
                  <strong>{previewFile || preview.sourcePath}</strong>
                </div>

                <div className="preview-table-scroll">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {preview.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIndex) => (
                        <tr key={`${preview.sourcePath}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${preview.sourcePath}-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="table-shell__empty">Select a BED file to preview the first 10 rows.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function UploadFieldCard({
  title,
  description,
  filename,
  status,
  actionLabel,
  onAction,
  children
}: {
  title: string;
  description: string;
  filename: string;
  status: "waiting" | "ready";
  actionLabel: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  const isReady = status === "ready";

  return (
    <section className="config-card upload-panel-card">
      <div className="upload-panel-card__head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`upload-status-badge ${isReady ? "is-ready" : ""}`}>
          {isReady ? <BadgeCheck size={12} /> : <Clock3 size={12} />}
          {isReady ? "Ready" : "Waiting"}
        </span>
      </div>

      <div className="upload-file-shell">
        <div className="upload-file-shell__main">
          <span className="upload-file-shell__label">Selected file</span>
          <strong>{filename}</strong>
        </div>

        <button
          type="button"
          className="path-row__button upload-secondary-button"
          onClick={onAction}
        >
          <Upload size={14} />
          {actionLabel}
        </button>
      </div>

      {children}
    </section>
  );
}
