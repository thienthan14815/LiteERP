// cuid-style id generator — replaces Prisma's @default(cuid()).
//
// Prisma generated ids client-side; with drizzle we do the same. Format keeps
// the "c" prefix + 24 chars so ids sort/scan like the existing rows, but this
// is NOT a spec-perfect cuid: uniqueness comes from 64 bits of CSPRNG entropy
// + millisecond timestamp + a process-local counter.

import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
let counter = Math.floor(Math.random() * 36 ** 4);

function toBase36(value: number, width: number): string {
  let out = "";
  let v = Math.floor(Math.abs(value));
  while (out.length < width) {
    out = ALPHABET[v % 36] + out;
    v = Math.floor(v / 36);
  }
  return out.slice(-width);
}

export function createId(): string {
  const time = toBase36(Date.now(), 8);
  counter = (counter + 1) % 36 ** 4;
  const count = toBase36(counter, 4);
  const rand = Array.from(randomBytes(12), (b) => ALPHABET[b % 36]).join("");
  return `c${time}${count}${rand}`;
}
