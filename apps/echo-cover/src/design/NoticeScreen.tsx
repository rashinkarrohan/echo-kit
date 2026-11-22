import type { ReactElement, ReactNode } from "react";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { Shell } from "./Shell";
import type { NavKey } from "./Shell";

/** A page with one heading and one message: loading, empty, nothing to show yet. */
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
    <Shell {...(active ? { active } : {})} bottomNav>
      <main className="cv-main cv-main--flow">
        <h1 className="cv-title">{title}</h1>
        <StatusMessage
          status={status}
          text={{ loading: text, empty: text, error: text, permissionDenied: text }}
        />
        {children}
      </main>
    </Shell>
  );
}
