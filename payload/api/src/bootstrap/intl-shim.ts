// nodejs-mobile v18.20.4 (Android arm64) is built --without-intl to keep
// libnode.so under 60 MB. Node globals `Intl.DateTimeFormat`, `Intl.NumberFormat`
// and `Intl.Collator` are therefore missing, and NestJS's ConsoleLogger crashes
// at module load with `ReferenceError: Intl is not defined`.
//
// This shim provides just enough of the Intl surface for Nest's logger, string
// formatting in dayjs/moment-lite consumers, and any locale-aware sort we may
// hit. It's not a full ECMA-402 implementation — do not rely on locale-specific
// rounding / date fields.

/* eslint-disable @typescript-eslint/no-explicit-any */

const g: any = globalThis as any;

if (typeof g.Intl === "undefined" || !g.Intl.DateTimeFormat) {
  function pad(n: number, width = 2): string {
    return String(n).padStart(width, "0");
  }

  class DateTimeFormatShim {
    format(input?: number | Date): string {
      const d = input instanceof Date ? input : new Date(input ?? Date.now());
      return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );
    }
    formatToParts(input?: number | Date) {
      const d = input instanceof Date ? input : new Date(input ?? Date.now());
      return [
        { type: "year", value: String(d.getFullYear()) },
        { type: "literal", value: "-" },
        { type: "month", value: pad(d.getMonth() + 1) },
        { type: "literal", value: "-" },
        { type: "day", value: pad(d.getDate()) },
        { type: "literal", value: " " },
        { type: "hour", value: pad(d.getHours()) },
        { type: "literal", value: ":" },
        { type: "minute", value: pad(d.getMinutes()) },
        { type: "literal", value: ":" },
        { type: "second", value: pad(d.getSeconds()) },
      ];
    }
    resolvedOptions() {
      return { locale: "en-US", calendar: "gregory", numberingSystem: "latn" };
    }
  }

  class NumberFormatShim {
    format(n: number): string {
      return typeof n === "number" ? n.toString() : String(n);
    }
    formatToParts(n: number) {
      return [{ type: "integer", value: this.format(n) }];
    }
    resolvedOptions() {
      return { locale: "en-US", numberingSystem: "latn" };
    }
  }

  class CollatorShim {
    compare(a: string, b: string): number {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    resolvedOptions() {
      return { locale: "en-US", usage: "sort" };
    }
  }

  g.Intl = {
    DateTimeFormat: DateTimeFormatShim,
    NumberFormat: NumberFormatShim,
    Collator: CollatorShim,
    getCanonicalLocales: (input?: string | string[]) =>
      Array.isArray(input) ? input : input ? [input] : ["en-US"],
  };
}
