import { useState, type ReactNode } from "react";
import { ChevronDown, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { MetaPlotControls } from "@/store/useAppStore";
import {
  curveSettings,
  lengthFilters,
  samplingSettings,
  transcriptSettings
} from "./metaPlotModuleConfig";

type OnMetaPlotControlChange = <K extends keyof MetaPlotControls>(
  key: K,
  value: MetaPlotControls[K]
) => void;

interface MetaPlotControlsCardProps {
  canRunAnalysis: boolean;
  controls: MetaPlotControls;
  isRunning: boolean;
  onControlChange: OnMetaPlotControlChange;
  onReset: () => void;
  onRun: () => void;
}

export function MetaPlotControlsCard({
  canRunAnalysis,
  controls,
  isRunning,
  onControlChange,
  onReset,
  onRun
}: MetaPlotControlsCardProps) {
  return (
    <section className="config-card">
      <div className="config-card__head">
        <div className="config-card__icon">
          <SlidersHorizontal size={18} />
        </div>
        <div>
          <h3>Analysis Parameters</h3>
          <p>Adjust transcript selection, sampling, and curve settings before running the analysis.</p>
        </div>
      </div>

      <div className="meta-plot-controls">
        <ControlSection title="Transcript Settings">
          {transcriptSettings.map((field) => (
            <FieldRow
              key={field.key}
              label={field.label}
              type={field.type}
              value={controls[field.key]}
              options={field.options}
              onChange={(value) =>
                onControlChange(field.key, value as MetaPlotControls[typeof field.key])
              }
            />
          ))}
        </ControlSection>

        <ControlSection title="Sampling Settings">
          {samplingSettings.map((field) => (
            <FieldRow
              key={field.key}
              label={field.label}
              type={field.type}
              value={controls[field.key]}
              options={field.options}
              onChange={(value) =>
                onControlChange(field.key, value as MetaPlotControls[typeof field.key])
              }
            />
          ))}
        </ControlSection>

        <ControlSection title="Length Filters">
          {lengthFilters.map((field) => (
            <FieldRow
              key={field.key}
              label={field.label}
              type="number"
              value={controls[field.key]}
              onChange={(value) =>
                onControlChange(field.key, value as MetaPlotControls[typeof field.key])
              }
            />
          ))}
        </ControlSection>

        <ControlSection title="Curve Settings">
          {curveSettings.map((field) => (
            <FieldRow
              key={field.key}
              label={field.label}
              type="number"
              value={controls[field.key]}
              onChange={(value) =>
                onControlChange(field.key, value as MetaPlotControls[typeof field.key])
              }
            />
          ))}
        </ControlSection>
      </div>

      <div className="action-row">
        <button
          type="button"
          className="action-button action-button--primary"
          disabled={!canRunAnalysis || isRunning}
          onClick={onRun}
        >
          <Play size={14} />
          Run Meta Plot
        </button>
        <button type="button" className="action-button" onClick={onReset}>
          <RotateCcw size={14} />
          Reset Defaults
        </button>
      </div>

      {!canRunAnalysis ? (
        <div className="inline-alert inline-alert--warning">
          <span>
            Complete Project Status validation and upload at least one BED file in Upload / Run
            to enable analysis.
          </span>
        </div>
      ) : null}
    </section>
  );
}

function ControlSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={`control-section${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="control-section__head"
        onClick={() => setIsOpen((current) => !current)}
      >
        <h4>{title}</h4>
        <ChevronDown size={16} />
      </button>
      {isOpen ? <div className="control-section__grid">{children}</div> : null}
    </section>
  );
}

function FieldRow({
  label,
  type,
  value,
  options,
  onChange
}: {
  label: string;
  type: "select" | "binary" | "number";
  value: string | number;
  options?: Array<{ label: string; value: string }>;
  onChange: (value: string | number) => void;
}) {
  return (
    <label className="field-shell">
      <span>{label}</span>
      {type === "number" ? (
        <input
          className="field-shell__input"
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : (
        <select
          className="field-shell__input"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
