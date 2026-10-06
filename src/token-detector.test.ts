import { test } from "vitest";
import assert from "node:assert/strict";
import { detectTokens as detect, filterClipboardTokens } from "./token-detector";

const body = "aB9dE2fG7hJ4kL6mN8pQ3rS5tU0vW1xY";
const uuid = "5db5af79-b6d6-4c49-a881-14c2fbfc3e23";

test("recognizes required providers and shared key formats without changing the token", () => {
  const samples = [
    ["oc_sk_001122aabbcc_X-" + body + "_additionalCharacters", "OpenCode"],
    ["sk-or-v1-" + "0123456789abcdef".repeat(4), "OpenRouter"],
    ["sk-pg-xxxxxxx", "Pangram"],
    ["sk-pg-" + body + "_with-dashes", "Pangram"],
    ["fw_" + body, "Fireworks AI"],
    ["fpk_" + body, "Fireworks AI"],
    ["sk-ant-api03-" + body, "Anthropic / Claude"],
    ["sk-proj-" + body, "OpenAI"],
    ["sk-svcacct-" + body, "OpenAI"],
    ["sk-" + "a".repeat(20) + "T3BlbkFJ" + "b".repeat(20), "OpenAI"],
    ["sk-" + body, "OpenAI-style"],
    ["cu_" + body, "cu_ token"],
    ["sk_live_" + body, "Stripe"],
    ["rk_test_" + body, "Stripe"],
    ["pk_live_" + body, "Stripe"],
    ["whsec_" + body, "Stripe / Svix"],
    ["a1b2c3d4e5f60718293a4b5c6d7e8f90." + body, "Z.AI-style"],
    ["ghp_" + body, "GitHub"],
    ["github_pat_" + body, "GitHub"],
    ["glpat-" + body, "GitLab"],
    ["AIza" + "a".repeat(35), "Google"],
    ["AQ." + body, "Google"],
    ["AKIA" + "A1".repeat(8), "AWS"],
    ["xoxb-" + body, "Slack"],
    ["sbp_" + "abcde12345".repeat(4), "Supabase"],
    ["sb_secret_" + body, "Supabase"],
    ["gsk_" + body, "Groq"],
    ["hf_" + body, "Hugging Face"],
    ["r8_" + body, "Replicate"],
    ["pplx-" + body, "Perplexity"],
    ["xai-" + body, "xAI"],
    ["re_" + body, "Resend"],
    ["lin_api_" + body, "Linear"],
    ["ntn_" + body, "Notion"],
    ["npm_" + body, "npm"],
    ["dop_v1_" + "a1b2c3d4".repeat(8), "DigitalOcean"],
    ["SG." + "a".repeat(22) + "." + "B".repeat(43), "SendGrid"],
    ["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.dGVzdHNpZ25hdHVyZQ", "JWT"],
  ];
  for (const [value, provider] of samples) {
    assert.deepEqual(
      detect(value).map((match) => [match.value, match.provider]),
      [[value, provider]],
      provider,
    );
  }
});

test("extracts complete keys from env files, JSON, curl headers, and multiple-token copies", () => {
  const openai = "sk-proj-" + body;
  const stripe = "rk_test_" + body;
  const text = `export OPENAI_API_KEY=${openai}\n{"stripe_key":"${stripe}"}\n-H 'Authorization: Bearer ${openai}'`;
  assert.deepEqual(
    detect(text).map((match) => match.value),
    [openai, stripe],
  );
  assert.equal(detect(`"${openai}"`)[0].value, openai);
  assert.equal(detect(`My key: ${openai}.`)[0].value, openai);
  assert.deepEqual(detect(`Value: prefix${openai}`), []);
});

test("keeps uncertain UUIDs and opaque hashes, and uses provider context when available", () => {
  assert.equal(detect(uuid)[0].provider, "UUID token");
  assert.equal(detect(`RAILWAY_TOKEN=${uuid}`)[0].provider, "Railway");
  assert.equal(detect(`ZAI_API_KEY=${body}`)[0].provider, "Z.AI");
  assert.equal(detect(`GEMINI_API_KEY=AQ.${body}`)[0].provider, "Google Gemini");
  assert.equal(detect(`GEMINI_API_KEY=AIza${"a".repeat(35)}`)[0].provider, "Google Gemini");
  assert.equal(detect(`AZURE_OPENAI_API_KEY=${body}`)[0].provider, "Azure");
  assert.equal(detect(`AZURE_OPENAI_API_KEY=${body}+/V3xyZ2==`)[0].provider, "Azure");
  assert.equal(detect(`${body}+/V3xyZ2==`)[0].provider, "Generic token");
  assert.equal(detect(`DEEPSEEK_API_KEY=sk-${body}`)[0].provider, "DeepSeek");
  assert.equal(detect(`MISTRAL_API_KEY=${body}`)[0].provider, "Mistral AI");
  assert.equal(detect(body)[0].provider, "Generic token");
  assert.equal(detect("a1b2c3d4-e5f60718-293a4b5c-6d7e8f90")[0].provider, "Generic token");
});

test("uses the matching key field instead of another provider name elsewhere on the same line", () => {
  const text = `{"AZURE_OPENAI_API_KEY":"${body}","GEMINI_API_KEY":"AQ.${body}"}`;
  assert.deepEqual(
    detect(text).map((token) => token.provider),
    ["Azure", "Google Gemini"],
  );
});

test.each([
  ["GEMINI_API_KEY", "Google Gemini"],
  ["AZURE_OPENAI_API_KEY", "Azure"],
  ["DEEPSEEK_API_KEY", "DeepSeek"],
  ["MISTRAL_API_KEY", "Mistral AI"],
  ["COHERE_API_KEY", "Cohere"],
  ["TOGETHER_API_KEY", "Together AI"],
  ["CEREBRAS_API_KEY", "Cerebras"],
  ["RAILWAY_TOKEN", "Railway"],
  ["ZAI_API_KEY", "Z.AI"],
  ["CLOUDFLARE_API_TOKEN", "Cloudflare"],
  ["VERCEL_TOKEN", "Vercel"],
])("identifies a copied %s field as %s", (field, provider) => {
  assert.equal(detect(`export ${field}="${body}"`)[0].provider, provider);
});

test("rejects normal text, URLs, record IDs in prose, placeholders, short values, and partial keys", () => {
  for (const value of [
    "hello world",
    "2026-10-06",
    "cu_abc",
    "sk-proj-short",
    "oc_sk_short",
    "sk-or-v1-short",
    "sk-pg-short",
    "AQ.short",
    "sk_test_...",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    `Order ID: ${uuid}`,
    `https://example.com/${uuid}`,
    "this-is-a-long-readable-sentence",
    "API_KEY=your_api_key_here",
    "node_modules/my-package/file1234567890.ts",
    "sk-proj-" + body + "...",
    "x".repeat(1_048_577),
  ])
    assert.deepEqual(detect(value), [], value.slice(0, 80));
});

test("filters clipboard items without storing them, with newest matches first", () => {
  const newer = "cu_" + body;
  const older = "sk-proj-" + body;
  assert.deepEqual(
    filterClipboardTokens([newer, "normal text", older, newer, undefined]).map((token) => token.value),
    [newer, older],
  );
  assert.deepEqual(filterClipboardTokens(["normal text", undefined]), []);
});
