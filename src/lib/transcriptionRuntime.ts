import type { TranscriptionRunResult } from "@/types/native";

const TRANSCRIPTION_PROGRESS_PATTERN = /\[transcription\]\[(\d+)%\]\s*(.+)$/i;

export function parseTranscriptionProgressLine(line: string) {
  const match = line.match(TRANSCRIPTION_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  return {
    percent: Number(match[1]),
    detail: match[2].trim()
  };
}

export function coerceTranscriptionRunResult(raw: string): TranscriptionRunResult {
  return JSON.parse(raw) as TranscriptionRunResult;
}

export function buildTranscriptionRequest(payload: {
  species: string;
  speciesId: string;
  annotationDir: string;
  filePaths: string[];
}) {
  return {
    species: payload.species,
    speciesId: payload.speciesId,
    annotationDir: payload.annotationDir,
    filePaths: payload.filePaths,
    controls: {}
  };
}
