/// <reference lib="dom" />
// These checks run in Node. They do not open Raycast or read the real clipboard.
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  readText: vi.fn(),
  copy: vi.fn(),
  clear: vi.fn(),
  showToast: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@raycast/api", () => {
  type FrameProps = { children?: ReactNode };
  type ActionProps = { title: string; onAction?: () => unknown; content?: string; shortcut?: unknown };
  const Action = Object.assign(
    ({ title, onAction, shortcut }: ActionProps) => (
      <button onClick={onAction} data-shortcut={JSON.stringify(shortcut)}>
        {title}
      </button>
    ),
    {
      CopyToClipboard: ({ title, content }: ActionProps) => <button data-content={content}>{title}</button>,
      Paste: ({ title, content }: ActionProps) => <button data-content={content}>{title}</button>,
      Style: { Destructive: "destructive" },
    },
  );
  const List = Object.assign(
    ({ children, isLoading }: FrameProps & { isLoading: boolean }) => (
      <main data-loading={String(isLoading)}>{children}</main>
    ),
    {
      Item: ({
        title,
        subtitle,
        icon,
        actions,
      }: {
        title: string;
        subtitle: string;
        icon: string | { source: string };
        actions: ReactNode;
      }) => (
        <section aria-label={title} data-icon={typeof icon === "string" ? icon : icon.source}>
          <span>{title}</span>
          <span>{subtitle}</span>
          {actions}
        </section>
      ),
      EmptyView: ({ title, actions }: { title: string; actions: ReactNode }) => (
        <aside>
          {title}
          {actions}
        </aside>
      ),
    },
  );
  return {
    Action,
    ActionPanel: ({ children }: FrameProps) => <div>{children}</div>,
    List,
    Clipboard: { readText: api.readText, copy: api.copy, clear: api.clear },
    Color: { PrimaryText: "primary" },
    Icon: { ArrowClockwise: "refresh", Key: "key", ExclamationMark: "error", Trash: "trash", Clock: "clock" },
    Keyboard: { Shortcut: { Common: { Refresh: { modifiers: ["cmd"], key: "r" } } } },
    Toast: { Style: { Success: "success", Failure: "failure" } },
    showToast: api.showToast,
    open: api.open,
  };
});

import Command from "./token-clipboard";

const key = "sk-or-v1-" + "0123456789abcdef".repeat(4);
const removeTitle = "Remove Key from List and Current Clipboard";

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.readText.mockResolvedValue(key);
  api.copy.mockResolvedValue(undefined);
  api.clear.mockResolvedValue(undefined);
  api.showToast.mockResolvedValue(undefined);
  api.open.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

async function keyRow() {
  return screen.findByRole("region", { name: key });
}

test("does not show an empty state before clipboard loading finishes", async () => {
  let finish: (value: string | undefined) => void = () => undefined;
  const pending = new Promise<string | undefined>((resolve) => {
    finish = resolve;
  });
  api.readText.mockReturnValue(pending);
  render(<Command />);
  expect(screen.getByRole("main").getAttribute("data-loading")).toBe("true");
  expect(screen.queryByText("No API Keys in Recent Clipboard Items")).toBeNull();
  finish(undefined);
  await screen.findByText("No API Keys in Recent Clipboard Items");
  expect(screen.getByRole("main").getAttribute("data-loading")).toBe("false");
});

test("loads existing keys, shows the provider SVG, and sends the complete key to copy and paste actions", async () => {
  render(<Command />);
  const row = await keyRow();
  expect(row.getAttribute("data-icon")).toBe("providers/openrouter.svg");
  expect(within(row).getByText("OpenRouter")).toBeTruthy();
  expect(within(row).getByRole("button", { name: "Copy Key" }).getAttribute("data-content")).toBe(key);
  expect(within(row).getByRole("button", { name: "Paste Key" }).getAttribute("data-content")).toBe(key);
  expect(api.readText.mock.calls).toEqual(Array.from({ length: 6 }, (_, offset) => [{ offset }]));
});

test("uses the key icon when the provider cannot be identified", async () => {
  const unknown = "cu_headless_test_aB9dE2fG7hJ4kL6mN8pQ3rS5";
  api.readText.mockResolvedValue(unknown);
  render(<Command />);
  const row = await screen.findByRole("region", { name: unknown });
  expect(row.getAttribute("data-icon")).toBe("key");
  expect(within(row).getByRole("button", { name: "Copy Key" }).getAttribute("data-content")).toBe(unknown);
});

test("shows the Pangram SVG and preserves the complete Pangram key for copying", async () => {
  const pangram = "sk-pg-headless_test_aB9dE2fG7hJ4kL6mN8pQ3rS5";
  api.readText.mockResolvedValue(pangram);
  render(<Command />);
  const row = await screen.findByRole("region", { name: pangram });
  expect(row.getAttribute("data-icon")).toBe("providers/pangram.svg");
  expect(within(row).getByText("Pangram")).toBeTruthy();
  expect(within(row).getByRole("button", { name: "Copy Key" }).getAttribute("data-content")).toBe(pangram);
});

test("removes a selected key and keeps it hidden when this open view refreshes", async () => {
  render(<Command />);
  const row = await keyRow();
  const remove = within(row).getByRole("button", { name: removeTitle });
  expect(JSON.parse(remove.getAttribute("data-shortcut")!)).toEqual({ modifiers: ["cmd"], key: "backspace" });
  fireEvent.click(remove);
  await waitFor(() => expect(api.clear).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole("region", { name: key })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(api.readText).toHaveBeenCalledTimes(13));
  expect(screen.queryByRole("region", { name: key })).toBeNull();
});

test("hides a history-only key without changing the current clipboard", async () => {
  render(<Command />);
  const row = await keyRow();
  api.readText.mockResolvedValue("unrelated current text");
  fireEvent.click(within(row).getByRole("button", { name: removeTitle }));
  await waitFor(() => expect(screen.queryByRole("region", { name: key })).toBeNull());
  expect(api.clear).not.toHaveBeenCalled();
  expect(api.copy).not.toHaveBeenCalled();
  expect(api.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Key hidden from this list" }));
});

test("keeps a key visible when the clipboard cannot be changed", async () => {
  api.clear.mockRejectedValue(new Error("Clipboard unavailable"));
  render(<Command />);
  const row = await keyRow();
  fireEvent.click(within(row).getByRole("button", { name: removeTitle }));
  await waitFor(() =>
    expect(api.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Could not remove the key" })),
  );
  expect(screen.getByRole("region", { name: key })).toBeTruthy();
});

test("shows a read error and supports a later successful refresh", async () => {
  api.readText.mockRejectedValue(new Error("Clipboard unavailable"));
  render(<Command />);
  await screen.findByText("Could Not Read Clipboard");
  api.readText.mockResolvedValue(key);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await keyRow()).toBeTruthy();
});

test("opens the saved Clipboard History only when its action is selected", async () => {
  render(<Command />);
  const row = await keyRow();
  expect(api.open).not.toHaveBeenCalled();
  fireEvent.click(within(row).getByRole("button", { name: "Open Clipboard History" }));
  expect(api.open).toHaveBeenCalledWith("raycast://extensions/raycast/clipboard-history/clipboard-history");
});
