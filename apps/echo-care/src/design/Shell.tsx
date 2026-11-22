import type { ReactElement, ReactNode } from "react";
import { Skin, TextSizeButton } from "@echo/ui";
import { CareIcon } from "./icons";
import type { IconName } from "./icons";
import { Logo } from "./parts";

export type NavKey = "home" | "visits" | "medicines";

const NAV: ReadonlyArray<{ key: NavKey; label: string; href: string; icon: IconName }> = [
  { key: "home", label: "Home", href: "#/home", icon: "house" },
  { key: "visits", label: "Visits", href: "#/visits", icon: "clipboardList" },
  { key: "medicines", label: "Medicines", href: "#/medicines", icon: "pill" },
];

/**
 * Page frame from the design pack. On a phone: an optional top bar (Home only), the page, and
 * a floating bottom bar with Home, Visits, Medicines. On a wide screen: a header with the logo,
 * the same three links and the Text size button.
 */
export function Shell({
  active,
  topBar = false,
  bottomNav = true,
  header = true,
  locked = false,
  children,
  className,
}: {
  active?: NavKey;
  /** Phone only: show the logo and Text size button above the page (Home) */
  topBar?: boolean;
  /** Phone only: show the floating bottom bar */
  bottomNav?: boolean;
  /** Wide screen only: show the header */
  header?: boolean;
  /** Audio may be captured: no link leads away from the page (it would keep recording) */
  locked?: boolean;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <Skin
      skin="care"
      className={["cd", header ? "" : "cd-nohead", className ?? ""].filter(Boolean).join(" ")}
    >
      <header className={`cd-top${topBar ? "" : " cd-hide-mobile"}`}>
        {locked ? (
          <span className="cd-brand">
            <Logo />
            <span>Echo Care</span>
          </span>
        ) : (
          <a className="cd-brand" href="#/home" aria-label="Echo Care home">
            <Logo />
            <span>Echo Care</span>
          </a>
        )}
        {!locked && (
          <nav className="cd-pillnav" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.key}
                className="cd-pillnav__item"
                href={n.href}
                {...(active === n.key ? { "aria-current": "page" as const } : {})}
              >
                <CareIcon name={n.icon} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}
        <TextSizeButton />
      </header>
      {children}
      {bottomNav && !locked && (
        <nav className="cd-nav" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.key}
              className="cd-nav__item"
              href={n.href}
              {...(active === n.key ? { "aria-current": "page" as const } : {})}
            >
              <span className="cd-nav__pill">
                <CareIcon name={n.icon} />
              </span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      )}
    </Skin>
  );
}
