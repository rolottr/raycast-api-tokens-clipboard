import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import manifest from "../package.json";

test("the extension and command icons resolve to valid 512px PNG assets", () => {
  const icons = [manifest.icon, ...manifest.commands.map((command) => command.icon)];
  for (const icon of icons) {
    expect(icon).toBeTruthy();
    const png = readFileSync(join(process.cwd(), "assets", icon));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  }
});
