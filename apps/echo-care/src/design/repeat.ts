/** The Please repeat card: four things the user can ask the speaker to say again. */

export type RepeatTile = "name" | "amount" | "often" | "all";

export const REPEAT_TILES: readonly RepeatTile[] = ["name", "amount", "often", "all"];

export const REPEAT_PHRASES: Record<RepeatTile, string> = {
  name: "Please say the medicine name again.",
  amount: "Please say the amount again.",
  often: "Please say how often again.",
  all: "Please say all of that again.",
};

/** Start on the tile that matches what the live check asked about. */
export function tileForPrompt(kind: string | undefined): RepeatTile {
  switch (kind) {
    case "missing-medicine-name":
    case "unclear-medicine-name":
    case "unknown-medicine-name":
    case "unconfirmed-medicine-name":
      return "name";
    case "unclear-dose":
      return "amount";
    default:
      return "all";
  }
}
