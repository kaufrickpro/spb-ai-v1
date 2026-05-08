import { describe, expect, it } from "vitest";
import { buildMatchVisibleContactSettings } from "./matchVisibleContactForm";

describe("buildMatchVisibleContactSettings", () => {
  it("normalizes non-empty website and email fields before saving", () => {
    expect(
      buildMatchVisibleContactSettings({
        publicEmail: " submissions@example.com ",
        showEmail: true,
        showWebsite: true,
        websiteUrl: " publisher.example.com ",
      }),
    ).toEqual({
      publicEmail: "submissions@example.com",
      publicPhone: null,
      websiteUrl: "https://publisher.example.com",
      socialLinks: [],
      visibility: {
        publicEmail: true,
        publicPhone: false,
        websiteUrl: true,
        socialLinks: false,
      },
    });
  });

  it("keeps empty contact fields nullable", () => {
    expect(
      buildMatchVisibleContactSettings({
        publicEmail: " ",
        showEmail: false,
        showWebsite: false,
        websiteUrl: "",
      }),
    ).toMatchObject({
      publicEmail: null,
      websiteUrl: null,
    });
  });
});
