import { beforeEach, expect, test, vi } from "vitest";

const readText = vi.fn();
import { readClipboardTokens, removeKeyFromCurrentClipboard } from "./clipboard";

const key = "cu_clipboard_test_aB9dE2fG7hJ4kL6mN8pQ3rS5";

beforeEach(() => {
  readText.mockReset();
});

test("reads only the six existing Raycast clipboard items", async () => {
  readText.mockImplementation(({ offset }: { offset: number }) => Promise.resolve(offset === 3 ? key : "plain text"));
  expect((await readClipboardTokens(readText)).map((token) => token.value)).toEqual([key]);
  expect(readText.mock.calls).toEqual(Array.from({ length: 6 }, (_, offset) => [{ offset }]));
});

test("keeps matches when a prior clipboard item cannot be read", async () => {
  readText.mockImplementation(({ offset }: { offset: number }) =>
    offset === 0 ? Promise.resolve(key) : Promise.reject(new Error("Not available")),
  );
  expect((await readClipboardTokens(readText)).map((token) => token.value)).toEqual([key]);
});

test("reads fresh items on refresh and keeps no separate token history", async () => {
  readText.mockResolvedValue(key);
  expect(await readClipboardTokens(readText)).toHaveLength(1);
  readText.mockResolvedValue("plain text");
  expect(await readClipboardTokens(readText)).toEqual([]);
});

test("reports a read error if all clipboard reads fail", async () => {
  readText.mockRejectedValue(new Error("Clipboard unavailable"));
  await expect(readClipboardTokens(readText)).rejects.toThrow("Could not read the clipboard.");
});

test("removing the current standalone key clears the clipboard", async () => {
  const clipboard = {
    readText: vi.fn().mockResolvedValue(key),
    clear: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn(),
  };
  expect(await removeKeyFromCurrentClipboard(key, clipboard)).toBe(true);
  expect(clipboard.clear).toHaveBeenCalledOnce();
  expect(clipboard.copy).not.toHaveBeenCalled();
});

test("removing an embedded key preserves other text and keys, including a longer key with the same prefix", async () => {
  const longer = key + "Suffix";
  const clipboard = {
    readText: vi.fn().mockResolvedValue(`API_KEY="${key}"\nOTHER_KEY=${longer}`),
    clear: vi.fn(),
    copy: vi.fn().mockResolvedValue(undefined),
  };
  expect(await removeKeyFromCurrentClipboard(key, clipboard)).toBe(true);
  expect(clipboard.copy).toHaveBeenCalledWith(`API_KEY=""\nOTHER_KEY=${longer}`);
  expect(clipboard.clear).not.toHaveBeenCalled();
});

test("removing a history-only key leaves the current clipboard unchanged", async () => {
  const clipboard = { readText: vi.fn().mockResolvedValue("unrelated current text"), clear: vi.fn(), copy: vi.fn() };
  expect(await removeKeyFromCurrentClipboard(key, clipboard)).toBe(false);
  expect(clipboard.clear).not.toHaveBeenCalled();
  expect(clipboard.copy).not.toHaveBeenCalled();
});

test("clipboard write errors are reported instead of claiming removal", async () => {
  const clipboard = {
    readText: vi.fn().mockResolvedValue(key),
    copy: vi.fn(),
    clear: vi.fn().mockRejectedValue(new Error("Clipboard unavailable")),
  };
  await expect(removeKeyFromCurrentClipboard(key, clipboard)).rejects.toThrow("Clipboard unavailable");
});
