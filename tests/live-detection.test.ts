import { describe, expect, it } from "vitest";
import { cardHasLiveSignal, hasLiveSignalFromText } from "../src/content/live-detection";

describe("live detection", () => {
  it("recognizes Slovenian and English live variants", () => {
    expect(hasLiveSignalFromText("V živo: seja")).toBe(true);
    expect(hasLiveSignalFromText("(V ŽIVO) seja")).toBe(true);
    expect(hasLiveSignalFromText("v zivo - tekma")).toBe(true);
    expect(hasLiveSignalFromText("LIVE: updates")).toBe(true);
  });

  it("does not treat weak surrounding words as live", () => {
    expect(hasLiveSignalFromText("Prenos tekme in dogajanje")).toBe(false);
  });

  it("uses short native badges without scanning a large section", () => {
    document.body.innerHTML = `
      <section>
        <span>V živo</span>
        <article><h2>Navadna novica</h2><p>Prenos tekme</p></article>
      </section>
      <article id="card"><span aria-label="LIVE"></span><h2>Tekma</h2></article>
    `;
    expect(cardHasLiveSignal(document.querySelector("section article")!, "Navadna novica")).toBe(false);
    expect(cardHasLiveSignal(document.querySelector("#card")!, "Tekma")).toBe(true);
  });
});
