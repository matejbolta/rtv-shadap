import { describe, expect, it } from "vitest";
import { extractArticles } from "../src/content/extractor";
import { hideDistractingHomepageSections } from "../src/content/site-cleanup";
import fixture from "./fixtures/homepage.html?raw";
import savedRtvHomepage from "./fixtures/rtvslo-homepage.html?raw";

describe("extractArticles", () => {
  it("groups duplicate article links and ignores navigation", () => {
    document.documentElement.innerHTML = fixture;
    const articles = extractArticles(document);
    expect(articles.map((article) => article.key).sort()).toEqual(["rtv:704321", "rtv:704322", "rtv:704323", "rtv:704324"]);
    const duplicate = articles.find((article) => article.key === "rtv:704321")!;
    expect(duplicate.links).toHaveLength(3);
    expect(duplicate.imageElements).toHaveLength(1);
  });

  it("selects titles, cards and native live badges", () => {
    document.documentElement.innerHTML = fixture;
    const articles = extractArticles(document);
    expect(articles.find((article) => article.key === "rtv:704322")?.title).toBe("Druga novica");
    expect(articles.find((article) => article.key === "rtv:704322")?.cardElements).toHaveLength(1);
    expect(articles.find((article) => article.key === "rtv:704323")?.isLive).toBe(true);
  });

  it("extracts real saved RTV homepage cards using RTV card wrappers", () => {
    const sanitizedHomepage = savedRtvHomepage.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    document.open();
    document.write(sanitizedHomepage);
    document.close();
    hideDistractingHomepageSections(document);
    const articles = extractArticles(document);
    expect(articles.length).toBeGreaterThanOrEqual(60);
    const lead = articles.find((article) => article.key === "rtv:786788");
    expect(lead?.title).toBe("Medletna inflacija junija ostaja pri 3,6 odstotka");
    expect(lead?.cardElements[0]?.className).toContain("xl-news");
    expect(articles.find((article) => article.key === "rtv:786767")?.cardElements[0]?.className).toContain("md-news");
    expect(articles.find((article) => article.key === "rtv:786684")?.cardElements[0]?.className).toContain("article-container");
    expect(articles.some((article) => article.key === "url:/gospodarstvo")).toBe(false);
  });

  it("extracts Avdio/Video RTV 365 cards and hides distracting promo blocks", () => {
    const sanitizedHomepage = savedRtvHomepage.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    document.open();
    document.write(sanitizedHomepage);
    document.close();
    hideDistractingHomepageSections(document);
    const articles = extractArticles(document);
    const media = articles.find((article) => article.key === "rtv365:175232950");
    expect(media?.title).toBe("Nasvet: Če bi se radi hitro odžejali, spijte mlačno vodo");
    expect(media?.links).toHaveLength(2);
    expect(media?.imageElements).toHaveLength(1);
    expect(document.querySelector<HTMLElement>("section[data-rtv-tracker-hidden-section='rtv365']")?.style.display).toBe("none");
    const footballBanner = document.querySelector<HTMLImageElement>("img[data-src*='banner-1400x80']")?.closest<HTMLElement>("[data-rtv-tracker-hidden-section='promo-banner']");
    const rtv365Banner = document.querySelector<HTMLImageElement>("img[data-src*='rtv365_bannerji']")?.closest<HTMLElement>("[data-rtv-tracker-hidden-section='promo-banner']");
    expect(footballBanner?.style.display).toBe("none");
    expect(footballBanner?.style.getPropertyPriority("display")).toBe("important");
    expect(rtv365Banner?.style.display).toBe("none");
    expect(rtv365Banner?.style.getPropertyPriority("display")).toBe("important");
    expect(document.querySelectorAll(".container.text-center[data-rtv-tracker-hidden-section='promo-banner']")).toHaveLength(8);
    expect(document.querySelector<HTMLElement>("section[aria-label='Posebna izdaja']")?.style.display).not.toBe("none");
    expect(document.querySelector("[data-rtv-tracker-hidden-section='portal-shortcuts'] a[aria-label='Skit']")).not.toBeNull();
    expect(document.querySelector<HTMLElement>(".section-heading[data-rtv-tracker-hidden-section='sodelujte-heading']")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>("section[aria-label='Sodelujte']")?.style.display).toBe("none");
    expect(articles.some((article) => article.key === "rtv365:175232322")).toBe(false);
  });
});
