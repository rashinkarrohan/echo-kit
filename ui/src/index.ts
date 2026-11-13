// @echo/ui: shared React components, design tokens and browser platform modules.
// Styles: import "@echo/ui/styles.css" once in each app.

// Components
export { Skin, StatusMessage, StampBadge, ChecklistStamp, Icon } from "./components/common";
export type {
  ViewStatus,
  StatusText,
  FactStampName,
  ChecklistStampName,
} from "./components/common";
export { FlaggedText } from "./components/FlaggedText";
export { CaptionView } from "./components/CaptionView";
export type { CaptionLine } from "./components/CaptionView";
export { AnchorChip, SLOW_RATE } from "./components/AnchorChip";
export type { PlayAnchor } from "./components/AnchorChip";
export { ReceiptList } from "./components/ReceiptList";
export type { ReceiptListProps } from "./components/ReceiptList";
export { ChecklistView } from "./components/ChecklistView";
export { ComparisonTable } from "./components/ComparisonTable";
export { ReadBackPanel } from "./components/ReadBackPanel";
export { SpeakerCard, SPEAKER_CARDS } from "./components/SpeakerCard";
export type { SpeakerAction } from "./components/SpeakerCard";
export { ConsentSheet } from "./components/ConsentSheet";
export type { ConsentChoices } from "./components/ConsentSheet";

// Copy, tokens, helpers
export {
  FINAL,
  ADDED,
  FACT_LABELS,
  FIELD_LABELS,
  factLabel,
  fieldLabel,
  humanise,
  clock,
} from "./copy";
export { SKINS, SHARED, CONTRAST_PAIRS, contrastRatio } from "./tokens";
export type { SkinName } from "./tokens";
export { highlightParts } from "./highlight";
export type { TextPart } from "./highlight";

// Browser platform modules
export { IdbStore } from "./platform/idb-store";
export { startCapture, browserDeps, TARGET_SAMPLE_RATE } from "./platform/capture";
export type { CaptureDeps, CaptureError, CaptureHandle, CaptureOptions } from "./platform/capture";
export { createWhisperAdapter, workerTransport } from "./platform/whisper";
export type { WorkerLike } from "./platform/whisper";
