import rules from "../assets/token-rules.json";

export interface TokenMatch {
  value: string;
  provider: string;
  kind: string;
}

const patterns = rules.map((rule) => ({ ...rule, regex: new RegExp(`^(?:${rule.pattern})$`) }));
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const assignment = /([a-z\d_-]*(?:api[_-]?key|token|secret|access[_-]?key)[a-z\d_-]*)["']?\s*[:=]\s*["']?$/i;
const contextualProviders: [RegExp, string][] = [
  [/azure/i, "Azure"],
  [/gemini/i, "Google Gemini"],
  [/openrouter/i, "OpenRouter"],
  [/deepseek/i, "DeepSeek"],
  [/mistral/i, "Mistral AI"],
  [/cohere/i, "Cohere"],
  [/together/i, "Together AI"],
  [/fireworks/i, "Fireworks AI"],
  [/cerebras/i, "Cerebras"],
  [/railway/i, "Railway"],
  [/zai|z_ai|zhipu/i, "Z.AI"],
  [/cloudflare/i, "Cloudflare"],
  [/vercel/i, "Vercel"],
];

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

export function detectTokens(text: string): TokenMatch[] {
  if (text.length > 1_048_576) return [];
  const found = new Map<string, TokenMatch>();
  for (const match of text.matchAll(/[a-z\d_][a-z\d_.+/-]*={0,2}/gi)) {
    const value = match[0].replace(/^\.+|\.+$/g, "");
    if (match[0].includes("...") || value.length > 4096 || found.has(value)) continue;
    const prefix = text.slice(0, match.index).split("\n").pop() ?? "";
    const field = assignment.exec(prefix)?.[1] ?? "";
    const contextualProvider = contextualProviders.find(([pattern]) => pattern.test(field))?.[1];
    const rule = patterns.find(({ regex }) => regex.test(value));
    if (rule) {
      const provider =
        rule.provider === "Google" && contextualProvider === "Google Gemini"
          ? contextualProvider
          : rule.provider === "OpenAI-style" && contextualProvider
            ? contextualProvider
            : rule.provider;
      found.set(value, { value, provider, kind: rule.kind });
      continue;
    }

    const bare = text.trim().replace(/^["'`]+|["'`]+$/g, "") === value;
    if (!bare && !field) continue;
    if (uuid.test(value)) {
      found.set(value, {
        value,
        provider: contextualProvider ?? "UUID token",
        kind: contextualProvider ? "API token" : "Possible token / Railway-style",
      });
    } else if (
      value.length >= 24 &&
      value.length <= 512 &&
      /^[a-z\d_.+/-]+={0,2}$/i.test(value) &&
      (!value.includes("/") ||
        !!field ||
        (/^[a-z\d+/]+={0,2}$/i.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && entropy(value) >= 4.2)) &&
      /\d/.test(value) &&
      /[a-z]/i.test(value) &&
      entropy(value) >= 3.4 &&
      !/example|placeholder/i.test(value)
    ) {
      found.set(value, { value, provider: contextualProvider ?? "Generic token", kind: "Possible API key" });
    }
  }
  return [...found.values()];
}

export function filterClipboardTokens(texts: (string | undefined)[]): TokenMatch[] {
  const found = new Map<string, TokenMatch>();
  for (const text of texts) {
    if (!text) continue;
    for (const token of detectTokens(text)) {
      if (!found.has(token.value)) found.set(token.value, token);
    }
  }
  return [...found.values()];
}
