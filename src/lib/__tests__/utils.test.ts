/**
 * Tests for src/lib/utils.ts
 */
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (class name utility)", () => {
  it("returns an empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns a single class name unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("joins multiple class names with a space", () => {
    expect(cn("foo", "bar", "baz")).toBe("foo bar baz");
  });

  it("ignores falsy values (undefined, false, null, 0, empty string)", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
    expect(cn("a", false as unknown as string, "b")).toBe("a b");
    expect(cn("a", null as unknown as string, "b")).toBe("a b");
    expect(cn("a", "", "b")).toBe("a b");
  });

  it("handles conditional classes via object syntax", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
    expect(cn({ foo: true, bar: true })).toBe("foo bar");
    expect(cn({ foo: false, bar: false })).toBe("");
  });

  it("merges Tailwind utility classes (tailwind-merge behaviour)", () => {
    // tailwind-merge resolves conflicting utilities - later wins
    expect(cn("p-4", "p-8")).toBe("p-8");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles array inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("combines conditional and literal class names", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn("base", { active: isActive, disabled: isDisabled }, "extra");
    expect(result).toBe("base active extra");
  });

  it("deduplicates conflicting Tailwind padding classes", () => {
    // The last class wins in tailwind-merge
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("handles deeply nested arrays and objects", () => {
    const result = cn(["a", ["b", { c: true, d: false }]], "e");
    expect(result).toBe("a b c e");
  });
});
