import { useEffect, useState } from "react";

const ABORTED_MESSAGE = "aborted";
const ABORTED_DISMISS_DELAY_MS = 5000;

export function useTransientRunError() {
  const [runError, setRunError] = useState("");

  useEffect(() => {
    if (runError.trim().toLowerCase() !== ABORTED_MESSAGE) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRunError("");
    }, ABORTED_DISMISS_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [runError]);

  return { runError, setRunError };
}
