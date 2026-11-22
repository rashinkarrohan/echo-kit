import type { Receipt } from "@echo/engine";
import type { Stage } from "./env";

/** One finished visit: which kind it was, and its receipt. */
export interface SavedVisit {
  stage: Stage;
  receipt: Receipt;
}
