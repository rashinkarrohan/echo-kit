/**
 * Small yes/no choices kept in this browser only (never sent anywhere). The sign language
 * interpreter switch on the doctor card is one: it adds a line to the "Ask the front desk" card.
 */

const INTERPRETER_KEY = "echo-care:interpreter";

export function readFlag(storage: Pick<Storage, "getItem"> | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function saveFlag(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  key: string,
  value: boolean,
): void {
  try {
    if (value) storage?.setItem(key, "1");
    else storage?.removeItem(key);
  } catch {
    // Blocked storage: the choice lasts until the page is closed.
  }
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const readInterpreter = (): boolean => readFlag(storage(), INTERPRETER_KEY);
export const saveInterpreter = (value: boolean): void =>
  saveFlag(storage(), INTERPRETER_KEY, value);
