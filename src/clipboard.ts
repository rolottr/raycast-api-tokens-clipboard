import { detectTokens, filterClipboardTokens } from "./token-detector";

export async function readClipboardTokens(readText: (options: { offset: number }) => Promise<string | undefined>) {
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, offset) => readText({ offset })));
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("Could not read the clipboard.");
  }
  return filterClipboardTokens(results.map((result) => (result.status === "fulfilled" ? result.value : undefined)));
}

export async function removeKeyFromCurrentClipboard(
  value: string,
  clipboard: {
    readText(): Promise<string | undefined>;
    copy(text: string): Promise<void>;
    clear(): Promise<void>;
  },
): Promise<boolean> {
  const text = await clipboard.readText();
  if (!text || !detectTokens(text).some((token) => token.value === value)) return false;
  // Replace complete token candidates only. Keep other keys and source text.
  const remaining = text.replace(/[a-z\d_][a-z\d_.+/-]*={0,2}/gi, (candidate) =>
    candidate.replace(/^\.+|\.+$/g, "") === value ? candidate.replace(value, "") : candidate,
  );
  if (remaining.trim().replace(/^["'`]+|["'`]+$/g, "") === "") await clipboard.clear();
  else await clipboard.copy(remaining);
  return true;
}
