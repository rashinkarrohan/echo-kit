import type { ReactElement, ReactNode } from "react";
import { Skin, TextSizeButton } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import type { IconName } from "./icons";
import { Logo } from "./Brand";

export type NavKey = "home" | "compare" | "trust";

const NAV: ReadonlyArray<{ key: NavKey; label: string; href: string; icon: IconName }> = [
  { key: "home", label: CV.nav.home, href: "#/home", icon: "houseDuotone" },
  { key: "compare", label: CV.nav.compare, href: "#/compare", icon: "columnsDuotone" },
  { key: "trust", label: CV.nav.trust, href: "#/trust", icon: "shieldCheckDuotone" },
];

/**
 * Page frame from the design pack. On a phone: an optional top bar (Home, Test results), the
 * page, and a floating bottom bar with Home, Compare, Test results. On a wide screen: a header
 * with the logo, the same three links and the Text size button.
 */
export function Shell({
  active,
  topBar = false,
  bottomNav = false,
  locked = false,
  children,
  className,
}: {
  active?: NavKey;
  /** Phone only: show the logo and Text size button above the page */
  topBar?: boolean;
  /** Phone only: show the floating bottom bar */
  bottomNav?: boolean;
  /** The microphone may be live: no link leads away from the page */
  locked?: boolean;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <Skin skin="cover" className={className ? `cv ${className}` : "cv"}>
      <header className={`cv-top${topBar ? "" : " cv-hide-mobile"}`}>
        {locked ? (
          <span className="cv-brand">
            <Logo />
            <span>{CV.appName}</span>
          </span>
        ) : (
          <a className="cv-brand" href="#/home" aria-label={`${CV.appName} home`}>
            <Logo />
            <span>{CV.appName}</span>
          </a>
        )}
        {!locked && (
          <nav className="cv-pillnav" aria-label="Main">
            {NAV.map((n) => (
              <a
                key={n.key}
                className="cv-pillnav__item"
                href={n.href}
                {...(active === n.key ? { "aria-current": "page" as const } : {})}
              >
                <CoverIcon name={n.icon} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}
        <TextSizeButton popTitle="Caption text size" />
      </header>
      {children}
      {bottomNav && !locked && (
        <nav className="cv-nav" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.key}
              className="cv-nav__item"
              href={n.href}
              {...(active === n.key ? { "aria-current": "page" as const } : {})}
            >
              <span className="cv-nav__pill">
                <CoverIcon name={n.icon} />
              </span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      )}
    </Skin>
  );
}
