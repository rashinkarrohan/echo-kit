import { createElement } from "react";
import type { ReactElement } from "react";

/**
 * Icons from the Echo Care design pack (Lucide, ISC licence; see docs/SOURCES.md).
 * Soft fill on the main shape, stroke follows the text colour. Decorative: the text next to
 * an icon, or the button's aria-label, carries the meaning.
 */
type Shape = readonly [
  tag: "path" | "rect" | "circle" | "line",
  attrs: Readonly<Record<string, string>>,
];

const SHAPES = {
  calendar: [
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M16 2v4" }],
    [
      "rect",
      {
        width: "18",
        height: "18",
        x: "3",
        y: "4",
        rx: "2",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M3 10h18" }],
  ],
  captions2: [
    ["rect", { width: "18", height: "14", x: "3", y: "5", rx: "2", ry: "2" }],
    ["path", { d: "M7 15h4M15 15h2M7 11h2M13 11h4" }],
  ],
  captions: [
    [
      "rect",
      {
        width: "18",
        height: "14",
        x: "3",
        y: "5",
        rx: "2",
        ry: "2",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M7 15h4M15 15h2M7 11h2M13 11h4" }],
  ],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  chevronLeft: [["path", { d: "m15 18-6-6 6-6" }]],
  chevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
  circleHelp: [
    ["circle", { cx: "12", cy: "12", r: "10", fill: "currentColor", fillOpacity: "0.16" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
    ["path", { d: "M12 17h.01" }],
  ],
  circlePlay: [
    ["circle", { cx: "12", cy: "12", r: "10", fill: "currentColor", fillOpacity: "0.16" }],
    ["path", { d: "m10 8 6 4-6 4z" }],
  ],
  clipboardList: [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M12 11h4" }],
    ["path", { d: "M12 16h4" }],
    ["path", { d: "M8 11h.01" }],
    ["path", { d: "M8 16h.01" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "10", fill: "currentColor", fillOpacity: "0.16" }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
  ear: [
    ["path", { d: "M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" }],
    ["path", { d: "M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" }],
  ],
  exclamationMark: [
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  eye: [
    ["path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
  flag: [
    ["path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }],
    ["line", { x1: "4", x2: "4", y1: "22", y2: "15" }],
  ],
  hand: [
    ["path", { d: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" }],
    ["path", { d: "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" }],
    ["path", { d: "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" }],
    [
      "path",
      {
        d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
      },
    ],
  ],
  hash: [
    ["path", { d: "M4 9h16" }],
    ["path", { d: "M4 15h16" }],
    ["path", { d: "M10 3 8 21" }],
    ["path", { d: "m16 3-2 18" }],
  ],
  history: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
    ["path", { d: "M12 7v5l4 2" }],
  ],
  house: [
    [
      "path",
      {
        d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M9 22V12h6v10" }],
  ],
  lock2: [
    [
      "rect",
      {
        width: "18",
        height: "11",
        x: "3",
        y: "11",
        rx: "2",
        ry: "2",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
  ],
  lock: [
    ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
  ],
  mic: [
    [
      "path",
      {
        d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22" }],
  ],
  minus: [["path", { d: "M5 12h14" }]],
  pause: [
    ["rect", { x: "14", y: "4", width: "4", height: "16", rx: "1" }],
    ["rect", { x: "6", y: "4", width: "4", height: "16", rx: "1" }],
  ],
  pill: [
    [
      "path",
      {
        d: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "m8.5 8.5 7 7" }],
  ],
  plus: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "M12 5v14" }],
  ],
  rotateCcw: [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
  ],
  share: [
    ["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }],
    ["path", { d: "m16 6-4-4-4 4" }],
    ["path", { d: "M12 2v13" }],
  ],
  squarePlus: [
    [
      "rect",
      {
        width: "18",
        height: "18",
        x: "3",
        y: "3",
        rx: "5",
        fill: "currentColor",
        fillOpacity: "0.18",
      },
    ],
    ["path", { d: "M12 8v8" }],
    ["path", { d: "M8 12h8" }],
  ],
  trash2: [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }],
  ],
  triangleAlert: [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        fill: "currentColor",
        fillOpacity: "0.16",
      },
    ],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof SHAPES;

export function CareIcon({
  name,
  size = 26,
  strokeWidth = 2,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {SHAPES[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
