import { MIGRATIONS } from "./migrations";

describe("MIGRATIONS", () => {
  it("has unique, well-formed ids", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{4}_[a-z0-9_]+$/);
  });

  it("every migration ships at least one statement", () => {
    for (const m of MIGRATIONS) {
      expect(m.statements.length).toBeGreaterThan(0);
      for (const s of m.statements) expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  it("ids are ordered ascending (append-only)", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
