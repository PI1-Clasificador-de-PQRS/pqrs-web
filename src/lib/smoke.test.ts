import { cn } from "@/lib/utils";

test("cn combina clases", () => {
  expect(cn("a", false && "b", "c")).toBe("a c");
});
