import type { ReactElement, ReactNode } from "react";
import { Skin } from "@echo/ui";
import { COVER } from "./copy";

type ShellRoute = string;

function BrandMark(): ReactElement {
  return (
    <span className="cover-brand__mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/** Cover's ledger shell. Navigation is hidden while the microphone is active. */
export function CoverShell({
  children,
  route,
  savedCount,
  recording = false,
}: {
  children: ReactNode;
  route: ShellRoute;
  savedCount: number;
  recording?: boolean;
}): ReactElement {
  return (
    <Skin skin="cover" className="cover-page">
      <header className="cover-header">
        {recording ? (
          <span className="cover-brand">
            <BrandMark />
            {COVER.appName}
          </span>
        ) : (
          <a className="cover-brand" href="#/home" aria-label={`${COVER.appName} home`}>
            <BrandMark />
            {COVER.appName}
          </a>
        )}
        {!recording && (
          <nav aria-label={COVER.headerNavigation}>
            {route !== "/home" && <a href="#/home">{COVER.homeLink}</a>}
            {savedCount > 0 && route !== "/saved" && <a href="#/saved">{COVER.savedTitle}</a>}
            {route !== "/trust" && <a href="#/trust">{COVER.testResults}</a>}
          </nav>
        )}
      </header>
      <main className={route === "/home" ? "cover-main cover-main--home" : "cover-main"}>
        {children}
      </main>
      {route !== "/home" && (
        <footer className="cover-footer">
          <p>{COVER.footerNeutrality}</p>
        </footer>
      )}
    </Skin>
  );
}
