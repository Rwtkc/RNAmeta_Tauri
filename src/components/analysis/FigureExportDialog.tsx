import type { Dispatch, ReactNode, SetStateAction } from "react";
import { X } from "lucide-react";

export type FigureExportFormat = "png" | "pdf";

export interface FigureExportState {
  format: FigureExportFormat;
  width: string;
  height: string;
  dpi: string;
}

interface FigureExportDialogProps {
  ariaLabel: string;
  badgeIcon: ReactNode;
  description: string;
  onClose: () => void;
  onStateChange: Dispatch<SetStateAction<FigureExportState>>;
  onSubmit: () => void;
  state: FigureExportState;
  submitLabel?: string;
  title?: string;
}

export function FigureExportDialog({
  ariaLabel,
  badgeIcon,
  description,
  onClose,
  onStateChange,
  onSubmit,
  state,
  submitLabel = "Download Figure",
  title = "Figure Export"
}: FigureExportDialogProps) {
  return (
    <div className="export-modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="export-modal__backdrop" onClick={onClose} />
      <div className="export-modal__panel">
        <div className="export-modal__head">
          <div className="export-modal__title-row">
            <div className="export-modal__badge">{badgeIcon}</div>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </div>
          <button
            type="button"
            className="export-modal__close"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="export-modal__body">
          <div className="export-menu__field export-menu__field--full">
            <span>Format</span>
            <div className="export-modal__format-grid">
              {(["png", "pdf"] as FigureExportFormat[]).map((formatOption) => (
                <button
                  key={formatOption}
                  type="button"
                  className={`export-modal__format-option${
                    state.format === formatOption ? " is-active" : ""
                  }`}
                  onClick={() =>
                    onStateChange((current) => ({
                      ...current,
                      format: formatOption
                    }))
                  }
                >
                  {formatOption.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="export-modal__grid">
            <label className="export-menu__field">
              <span>Width (px)</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={state.width}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    width: event.target.value
                  }))
                }
              />
            </label>

            <label className="export-menu__field">
              <span>Height (px)</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={state.height}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    height: event.target.value
                  }))
                }
              />
            </label>

            <label className="export-menu__field export-menu__field--full">
              <span>DPI</span>
              <input
                className="field-shell__input export-menu__input"
                type="number"
                value={state.dpi}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    dpi: event.target.value
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="export-modal__actions">
          <button type="button" className="export-modal__submit" onClick={onSubmit}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
