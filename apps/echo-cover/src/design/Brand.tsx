import type { ReactElement } from "react";

const FONT = "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";

/** Echo Cover logo from the Echo Cover design pack: a blue tile, a white shield and five sound bars. */
export function Logo({ size = 56 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 360"
      role="img"
      aria-label="Echo Cover logo"
      className="cv-logo"
    >
      <rect width="360" height="360" rx="84" fill="#1A4FBA" />
      <path
        d="M180 62L290 102V186C290 248 243 290 180 312C117 290 70 248 70 186V102Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth="16"
        strokeLinejoin="round"
      />
      <path d="M132 166V194" stroke="#1A4FBA" strokeWidth="20" strokeLinecap="round" />
      <path d="M156 140V220" stroke="#1A4FBA" strokeWidth="20" strokeLinecap="round" />
      <path d="M180 118V242" stroke="#1A4FBA" strokeWidth="20" strokeLinecap="round" />
      <path d="M204 140V220" stroke="#1A4FBA" strokeWidth="20" strokeLinecap="round" />
      <path d="M228 166V194" stroke="#1A4FBA" strokeWidth="20" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Home illustration: two offers side by side. The numbers are made-up example prices in a
 * drawing, not a quote from any seller, and the mark between them does not pick one.
 */
export function HeroArt(): ReactElement {
  return (
    <svg
      viewBox="0 0 320 170"
      width="100%"
      role="img"
      aria-label="Two sellers' offers compared side by side"
      className="cv-hero-art"
    >
      <rect x="6" y="14" width="146" height="112" rx="22" fill="#FFFFFF" />
      <path d="M34 126v26l30-26Z" fill="#FFFFFF" />
      <rect x="168" y="30" width="146" height="112" rx="22" fill="#9DBBFF" />
      <path d="M292 142v26l-30-26Z" fill="#9DBBFF" />
      <text x="24" y="46" fontSize="18" fontWeight="700" fill="#44506A" fontFamily={FONT}>
        Seller 1
      </text>
      <text x="24" y="84" fontSize="30" fontWeight="700" fill="#0F2F7A" fontFamily={FONT}>
        3,800
      </text>
      <rect x="24" y="96" width="74" height="10" rx="5" fill="#C9DBFF" />
      <text x="200" y="62" fontSize="18" fontWeight="700" fill="#0F2F7A" fontFamily={FONT}>
        Seller 2
      </text>
      <text x="198" y="100" fontSize="30" fontWeight="700" fill="#0F2F7A" fontFamily={FONT}>
        4,200
      </text>
      <rect x="200" y="112" width="74" height="10" rx="5" fill="#EAF2FF" />
      <circle cx="160" cy="76" r="22" fill="#FFE08A" stroke="#0F2F7A" strokeWidth="4" />
      <path
        d="M149 76l8 8 14-16"
        fill="none"
        stroke="#0F2F7A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
