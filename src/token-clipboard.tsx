import { Action, ActionPanel, Clipboard, Color, Icon, Keyboard, List, open, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { readClipboardTokens, removeKeyFromCurrentClipboard } from "./clipboard";
import { TokenMatch } from "./token-detector";
import icons from "../assets/provider-icons.json";

const providerIcons: Record<string, string> = icons;

export default function Command() {
  const [tokens, setTokens] = useState<TokenMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const removed = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const matches = await readClipboardTokens((options) => Clipboard.readText(options));
      setTokens(matches.filter((token) => !removed.current.has(token.value)));
      setError(false);
    } catch {
      setTokens([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  async function removeKey(value: string) {
    try {
      const cleared = await removeKeyFromCurrentClipboard(value, Clipboard);
      removed.current.add(value);
      setTokens((current) => current.filter((token) => token.value !== value));
      await showToast({
        style: Toast.Style.Success,
        title: cleared ? "Key removed from current clipboard" : "Key hidden from this list",
        message: "Saved history entries stay in Raycast Clipboard History.",
      });
    } catch {
      await showToast({ style: Toast.Style.Failure, title: "Could not remove the key" });
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshAction = (
    <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={refresh} />
  );

  return (
    <List isLoading={loading} searchBarPlaceholder="Search keys or services…">
      {!loading && (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.Key}
          title={error ? "Could Not Read Clipboard" : "No API Keys in Recent Clipboard Items"}
          description="Copy a key, then press Command + R to refresh."
          actions={<ActionPanel>{refreshAction}</ActionPanel>}
        />
      )}
      {tokens.map((token) => (
        <List.Item
          key={token.value}
          title={token.value}
          subtitle={token.provider}
          icon={
            providerIcons[token.provider]
              ? { source: providerIcons[token.provider], tintColor: Color.PrimaryText }
              : Icon.Key
          }
          keywords={[token.provider, token.kind]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Key" content={token.value} />
              <Action.Paste title="Paste Key" content={token.value} shortcut={{ modifiers: ["cmd"], key: "return" }} />
              <Action
                title="Remove Key from List and Current Clipboard"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                onAction={() => removeKey(token.value)}
              />
              <Action
                title="Open Clipboard History"
                icon={Icon.Clock}
                onAction={() => open("raycast://extensions/raycast/clipboard-history/clipboard-history")}
              />
              {refreshAction}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
