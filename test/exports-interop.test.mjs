import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { describe, it, expect } from "vitest";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("package exports interop", () => {
  it("supports named ESM imports from the package entrypoint", async () => {
    const entrypointUrl = pathToFileURL(path.join(PROJECT_ROOT, "lib", "index.mjs")).href;
    const mod = await import(entrypointUrl);

    expect(typeof mod.produceIcons).toBe("function");
    expect(typeof mod.favgenVitePlugin).toBe("function");
  });
});
