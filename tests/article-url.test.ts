import { describe, expect, it } from "vitest";
import { identifyArticle } from "../src/shared/article-url";

const base = "https://www.rtvslo.si/";

describe("article identity", () => {
  it("normalizes relative and absolute URLs with the same numeric id", () => {
    expect(identifyArticle("/slovenija/test/704321?x=1#abc", base)?.key).toBe("rtv:704321");
    expect(identifyArticle("https://www.rtvslo.si/slovenija/test/704321/", base)?.key).toBe("rtv:704321");
  });

  it("removes query, fragment and trailing slash", () => {
    expect(identifyArticle("/svet/test/704321/?utm=1#x", base)?.canonicalUrl).toBe("https://www.rtvslo.si/svet/test/704321");
  });

  it("rejects external, category, homepage, empty and malformed URLs", () => {
    expect(identifyArticle("https://example.com/slovenija/test/704321", base)).toBeNull();
    expect(identifyArticle("/slovenija", base)).toBeNull();
    expect(identifyArticle("/", base)).toBeNull();
    expect(identifyArticle("", base)).toBeNull();
    expect(identifyArticle("javascript:void(0)", base)).toBeNull();
  });

  it("allows a clear article-like slug fallback", () => {
    expect(identifyArticle("/posebno/to-je-dovolj-dolg-slug", base)?.key).toBe("url:/posebno/to-je-dovolj-dolg-slug");
  });

  it("identifies RTV 365 media URLs by recording id", () => {
    expect(identifyArticle("https://365.rtvslo.si/arhiv/porocila/175233128", base)?.key).toBe("rtv365:175233128");
    expect(identifyArticle("https://365.rtvslo.si/kratki#175232322", base)?.key).toBe("rtv365:175232322");
    expect(identifyArticle("https://365.rtvslo.si/", base)).toBeNull();
  });
});
