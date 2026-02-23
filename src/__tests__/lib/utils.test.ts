import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn (classNames utility)", () => {
  it("should merge class names", () => {
    const result = cn("foo", "bar")
    expect(result).toBe("foo bar")
  })

  it("should handle conditional classes", () => {
    const result = cn("base", true && "included", false && "excluded")
    expect(result).toBe("base included")
  })

  it("should merge tailwind classes correctly", () => {
    const result = cn("px-2 py-1", "px-4")
    expect(result).toBe("py-1 px-4")
  })

  it("should handle arrays", () => {
    const result = cn(["foo", "bar"])
    expect(result).toBe("foo bar")
  })

  it("should handle objects", () => {
    const result = cn({ foo: true, bar: false, baz: true })
    expect(result).toBe("foo baz")
  })

  it("should handle undefined and null", () => {
    const result = cn("foo", undefined, null, "bar")
    expect(result).toBe("foo bar")
  })

  it("should return empty string for no inputs", () => {
    const result = cn()
    expect(result).toBe("")
  })
})
