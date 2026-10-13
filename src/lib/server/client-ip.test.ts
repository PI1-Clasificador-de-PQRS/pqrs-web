// @vitest-environment node
import { clientIpFromForwardedFor } from "@/lib/server/client-ip";

describe("clientIpFromForwardedFor", () => {
  it.each([
    ["203.0.113.7", 0, "203.0.113.7"],
    ["::ffff:127.0.0.1", 0, "::ffff:127.0.0.1"],
    ["6.6.6.6, 203.0.113.7", 0, undefined],
    ["basura", 0, undefined],
    ["", 0, undefined],
    ["6.6.6.6, 203.0.113.7", 1, "203.0.113.7"],
    ["6.6.6.6,203.0.113.7 , 10.0.0.2", 2, "203.0.113.7"],
    ["203.0.113.7", 2, undefined],
    ["6.6.6.6, basura", 1, undefined],
  ])("XFF %j con HOPS=%i → %s", (xff, hops, expected) => {
    expect(clientIpFromForwardedFor(xff, hops)).toBe(expected);
  });
});
