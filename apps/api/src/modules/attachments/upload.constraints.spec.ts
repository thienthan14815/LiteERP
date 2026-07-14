import { isAllowedMime, sanitizePathSegment } from "./upload.constraints";

describe("sanitizePathSegment", () => {
  it("keeps already-safe segments unchanged", () => {
    expect(sanitizePathSegment("SALES_ORDER")).toBe("SALES_ORDER");
    expect(sanitizePathSegment("abc-123.def")).toBe("abc-123.def");
    expect(sanitizePathSegment("clx1a2b3c")).toBe("clx1a2b3c");
  });

  it("never yields a path separator (cannot traverse directories)", () => {
    const out = sanitizePathSegment("../../etc/passwd");
    expect(out).not.toBeNull();
    expect(out).not.toContain("/");
    expect(out).not.toContain("\\");
    expect(out!.startsWith(".")).toBe(false);
  });

  it("rejects empty and dot-only inputs", () => {
    expect(sanitizePathSegment("")).toBeNull();
    expect(sanitizePathSegment("..")).toBeNull();
    expect(sanitizePathSegment("...")).toBeNull();
  });
});

describe("isAllowedMime", () => {
  it("allows images and PDF", () => {
    expect(isAllowedMime("image/png")).toBe(true);
    expect(isAllowedMime("image/jpeg")).toBe(true);
    expect(isAllowedMime("application/pdf")).toBe(true);
  });

  it("blocks dangerous / unknown types", () => {
    expect(isAllowedMime("text/html")).toBe(false);
    expect(isAllowedMime("application/octet-stream")).toBe(false);
    expect(isAllowedMime("application/x-msdownload")).toBe(false);
    expect(isAllowedMime("image/svg+xml")).toBe(false);
  });
});
