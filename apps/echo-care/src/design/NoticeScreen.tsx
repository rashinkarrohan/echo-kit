import type { ReactElement, ReactNode } from "react";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { Shell } from "./Shell";
import type { NavKey } from "./Shell";

/**
 * A page with one heading and one message: loading, empty, nothing to show yet. Every state is
 * designed (design rules), and every page keeps an h1 so keyboard and screen-reader users land
 * somewhere meaningful.
 */
export function NoticeScreen({
  title,
  status,
  text,
  active,
  children,
}: {
  title: string;
  status: ViewStatus;
  text: string;
  active?: NavKey;
  children?: ReactNode;
}): ReactElement {
  return (
    <Shell {...(active ? { active } : {})}>
      <main className="cd-main cd-main--notice">
        <h1 className="cd-title">{title}</h1>
        <StatusMessage
          status={status}
          text={{ loading: text, empty: text, error: text, permissionDenied: text }}
        />
        {children && <div className="cd-stack">{children}</div>}
      </main>
    </Shell>
  );
}

/** A page for the shared parts (label check, read back, share, test results) in the Echo Care frame. */
export function SharedScreen({
  active,
  children,
}: {
  active?: NavKey;
  children: ReactNode;
}): ReactElement {
  return (
    <Shell {...(active ? { active } : {})}>
      <main className="cd-main cd-shared">{children}</main>
    </Shell>
  );
}
