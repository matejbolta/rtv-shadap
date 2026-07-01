import { describe, expect, it } from "vitest";
import savedRtvHomepage from "./fixtures/rtvslo-homepage.html?raw";

describe("saved RTV homepage fixture", () => {
  it("does not contain Google API keys", () => {
    expect(savedRtvHomepage).not.toMatch(/AIza[0-9A-Za-z_-]+/);
  });
});
