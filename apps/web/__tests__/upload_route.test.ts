// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@gts/database", () => ({ createServiceClient: () => ({}) }));

const mockRequirePermission = vi.fn();
vi.mock("../app/api/v1/_lib/staff-access", async (orig) => ({
  ...(await orig<typeof import("../app/api/v1/_lib/staff-access")>()),
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "../app/api/v1/upload/route";
import { detectImageType } from "../app/api/v1/_lib/image-type";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const AVIF = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function upload(bytes: Uint8Array | null, type = "image/png", name = "a.png") {
  const form = new FormData();
  if (bytes) form.append("file", new File([bytes as BlobPart], name, { type }));
  return POST(new NextRequest("http://localhost:3000/api/v1/upload", { method: "POST", body: form }));
}
const deny = (status: number) => ({ ok: false, response: NextResponse.json({ code: "X" }, { status }) });

describe("detectImageType (what the bytes really are)", () => {
  it.each([[PNG, "image/png"], [JPEG, "image/jpeg"], [WEBP, "image/webp"], [AVIF, "image/avif"]])("recognises %#", (b, t) => expect(detectImageType(b)).toBe(t));
  it.each([[EXE], [SVG], [new Uint8Array([])], [new Uint8Array([1, 2])]])("rejects %#", (b) => expect(detectImageType(b)).toBeNull());
});

describe("POST /upload", () => {
  const env = { ...process.env };
  const fetchMock = vi.fn();
  beforeEach(() => {
    mockRequirePermission.mockReset().mockResolvedValue({ ok: true, user: { id: "u1" } });
    fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ secure_url: "https://res.cloudinary.com/c/i.png", public_id: "i" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "mycloud";
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = "mypreset";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  it.each([401, 403])("is refused with %s for anyone without product access, and contacts nobody", async (status) => {
    mockRequirePermission.mockResolvedValue(deny(status));
    const res = await upload(PNG);
    expect(res.status).toBe(status);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires the can_manage_products grant", async () => {
    await upload(PNG);
    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), "can_manage_products");
  });

  it("uploads a real image and returns its URL and id", async () => {
    const res = await upload(PNG);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: "https://res.cloudinary.com/c/i.png", public_id: "i" });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/v1_1/mycloud/image/upload");
  });

  it("accepts jpeg, webp and avif", async () => {
    for (const [b, t] of [[JPEG, "image/jpeg"], [WEBP, "image/webp"], [AVIF, "image/avif"]] as const) expect((await upload(b, t)).status).toBe(200);
  });

  it("400s when no file is sent", async () => {
    expect((await upload(null)).status).toBe(400);
  });

  it("refuses a file that claims to be an image but isn't (checked by its bytes, not its label)", async () => {
    const res = await upload(EXE, "image/png", "evil.png");
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses SVG (it can carry scripts)", async () => {
    expect((await upload(SVG, "image/svg+xml", "x.svg")).status).toBe(415);
  });

  it("refuses a file over 5 MB", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    const res = await upload(big);
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the service isn't configured instead of using a built-in account", async () => {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const res = await upload(PNG);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("UPLOAD_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not pass Cloudinary's error details back to the caller", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid api_key 438796" } }), { status: 401 }));
    const res = await upload(PNG);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/api_key|438796/);
  });
});
