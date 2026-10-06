# Token Clipboard

<img src="media/icon-color.png" width="96" alt="Token Clipboard icon">

A small Raycast extension that filters API keys from your clipboard. Select a key and press **Enter** to copy it. Provider SVG icons are bundled locally.

## Install

Requires macOS, Raycast, and Node.js 22 or later.

Clone or download this repository, then run:

```sh
cd raycast-api-tokens-clipboard
npm ci
npm run dev
```

Set **Command + Shift + T** in **Raycast Settings → Extensions → Token Clipboard**.

## Controls

| Shortcut | Action |
| --- | --- |
| Enter | Copy key |
| Command + Enter | Paste key |
| Command + R | Refresh |
| Command + Backspace | Remove key from this open list and the current clipboard, if present |

Other clipboard text is preserved when you remove a key. Removal from the list lasts until you close the command. Use **Open Clipboard History** to delete a saved history entry in Raycast.

## Supported providers

Detected by key format:

- Anthropic/Claude
- AWS access key IDs
- DigitalOcean
- Fireworks AI
- GitHub
- GitLab
- Google
- Groq
- Hugging Face
- Linear
- Notion
- npm
- OpenAI
- OpenCode
- OpenRouter
- Pangram
- Perplexity
- Replicate
- Resend
- SendGrid
- Slack
- Stripe
- Supabase
- xAI

These providers need a copied key field, such as `GEMINI_API_KEY=...` or `AZURE_OPENAI_API_KEY=...`:

- Azure
- Cerebras
- Cloudflare
- Cohere
- DeepSeek
- Google Gemini
- Mistral AI
- Railway
- Together AI
- Vercel
- Z.AI

It also finds `cu_` tokens, JWTs, UUIDs, OpenAI-style keys, Z.AI-style keys, and long random strings. Shared formats stay generic when the provider cannot be identified. `whsec_` secrets are labeled **Stripe / Svix**.

## Limits

The command reads the current clipboard item and five prior items, which is the [Raycast API limit](https://developers.raycast.com/api-reference/clipboard). It does not use Keychain, save token history, run a service, or make network requests. It cannot delete individual entries from Raycast's saved history.

## Tests

```sh
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run build
```

Coverage includes key detection, clipboard operations, and the React view logic. It requires at least 90% statement and line coverage, 85% branch coverage, and 100% function coverage. All tests run in Node with fake keys and a mocked Raycast API. They do not open apps or read the system clipboard. The included GitHub Actions workflow runs the checks after you push and saves the HTML coverage report.

MIT license. [Icon sources and licenses](assets/providers/README.md).
