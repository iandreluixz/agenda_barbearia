import assert from "node:assert/strict";
import test from "node:test";
import { hasOverlap, isWithinBusinessHours } from "../src/booking-rules.js";

test("allows an appointment fully inside business hours", () => {
  assert.equal(
    isWithinBusinessHours(
      new Date("2026-10-19T12:00:00-03:00"),
      new Date("2026-10-19T12:30:00-03:00"),
      "America/Sao_Paulo",
    ),
    true,
  );
});

test("rejects appointments that start before opening or end after closing", () => {
  assert.equal(
    isWithinBusinessHours(
      new Date("2026-10-19T08:30:00-03:00"),
      new Date("2026-10-19T09:30:00-03:00"),
      "America/Sao_Paulo",
    ),
    false,
  );
  assert.equal(
    isWithinBusinessHours(
      new Date("2026-10-19T18:30:00-03:00"),
      new Date("2026-10-19T19:30:00-03:00"),
      "America/Sao_Paulo",
    ),
    false,
  );
  assert.equal(
    isWithinBusinessHours(
      new Date("2026-10-18T12:00:00-03:00"),
      new Date("2026-10-18T12:30:00-03:00"),
      "America/Sao_Paulo",
    ),
    false,
  );
  assert.equal(
    isWithinBusinessHours(
      new Date("2026-10-19T23:30:00-03:00"),
      new Date("2026-10-20T00:30:00-03:00"),
      "America/Sao_Paulo",
    ),
    false,
  );
});

test("treats back-to-back appointments as separate and partial overlaps as conflicts", () => {
  const existing = {
    startsAt: new Date("2026-10-19T12:00:00Z"),
    endsAt: new Date("2026-10-19T12:30:00Z"),
  };

  assert.equal(
    hasOverlap(
      {
        startsAt: new Date("2026-10-19T12:30:00Z"),
        endsAt: new Date("2026-10-19T13:00:00Z"),
      },
      existing,
    ),
    false,
  );
  assert.equal(
    hasOverlap(
      {
        startsAt: new Date("2026-10-19T12:20:00Z"),
        endsAt: new Date("2026-10-19T12:50:00Z"),
      },
      existing,
    ),
    true,
  );
});
