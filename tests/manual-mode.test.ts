import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import serviceWorker from "../src/background/service-worker.ts?raw";
import contentScript from "../src/content/content-script.ts?raw";
import popup from "../src/popup/popup.ts?raw";
import popupHtml from "../src/popup/popup.html?raw";
import manifestText from "../public/manifest.json?raw";

const contentCss = readFileSync("src/content/content.css", "utf8");
const popupCss = readFileSync("src/popup/popup.css", "utf8");

describe("manual-only product mode", () => {
  it("does not contain automatic click or page-lifecycle history hooks", () => {
    expect(contentScript).not.toMatch(/addEventListener\("(?:click|pointerdown|keydown|pagehide|pageshow|visibilitychange)"/);
    expect(serviceWorker).not.toContain("chrome.tabs.onRemoved");
    expect(serviceWorker).not.toContain("chrome.runtime.onStartup");
    expect(`${contentScript}\n${serviceWorker}`).not.toMatch(/MARK_ARTICLE_OPENED|START_SESSION|COMMIT_SESSION|ABANDON_SESSION/);
  });

  it("routes explicit page marking from the popup through the active tab", () => {
    expect(popup).toContain("MARK_CURRENT_PAGE_SEEN");
    expect(contentScript).toContain("MARK_ARTICLES_SEEN");
    expect(serviceWorker).toContain('case "MARK_ARTICLES_SEEN"');
    expect(popup).not.toContain("storageSet");
    expect(contentScript).not.toContain("storageSet");
  });

  it("uses browser-native sync without an extension account or identity permission", () => {
    const manifest = JSON.parse(manifestText) as {
      key?: string;
      permissions?: string[];
      options_ui?: { page?: string };
    };
    expect(popup).toContain("SET_SYNC_MODE");
    expect(popup).toContain("browser's built-in sync");
    expect(popup).toContain("history on all synced devices");
    expect(serviceWorker).toContain("chrome.storage.onChanged");
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.options_ui?.page).toBe("options.html");
  });

  it("keeps manual builds on the published Web Store extension ID", () => {
    const manifest = JSON.parse(manifestText) as { key?: string };
    expect(manifest.key).toBeTypeOf("string");
    const digest = createHash("sha256")
      .update(Buffer.from(manifest.key ?? "", "base64"))
      .digest()
      .subarray(0, 16);
    const extensionId = Array.from(digest, (byte) => (
      String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))
    )).join("");
    expect(extensionId).toBe("oeplikfkggjcbekgclpegnblalngbpai");
  });

  it("loads on every path of the supported RTV origin", () => {
    const manifest = JSON.parse(manifestText) as { content_scripts?: Array<{ matches?: string[] }> };
    expect(manifest.content_scripts?.[0]?.matches).toEqual(["https://www.rtvslo.si/*"]);
    expect(contentScript).toContain("if (location.origin === HOMEPAGE_ORIGIN)");
  });

  it("keeps the popup action copy minimal", () => {
    expect(popupHtml).toContain("<h1>RTV Shadap</h1>");
    expect(popupHtml).toContain('<span id="enabled-label" class="switch-label">Enabled</span>');
    expect(popupHtml).toContain('<button id="mark-page" type="button">Do the magic</button>');
    expect(popupHtml).toContain('<button id="reset" type="button">Reset</button>');
    expect(popupHtml).not.toContain("RTV SLO");
    expect(popupHtml).not.toContain('<p id="status"');
  });

  it("shows a brief green signal only after successful manual marking", () => {
    expect(popup).toContain("flashSuccess();");
    expect(popup).toContain('classList.add("is-success")');
    expect(popup).toContain("}, 900)");
    expect(popupCss).toContain("#mark-page.is-success");
    expect(popupCss).toContain("#mark-page.is-success:hover");
    expect(popupCss).toContain("background: #168a4b");
  });

  it("uses the former dark opened treatment for every manually seen card", () => {
    expect(contentCss).toContain("--rtv-tracker-seen-stripe: rgb(0 0 0 / 11%)");
    expect(contentCss).toContain("filter: grayscale(0.85) saturate(0.25) brightness(0.52) contrast(0.86)");
    expect(contentCss).not.toContain("seen-title-opacity");
    expect(contentCss).not.toContain(":is(h1");
  });
});
