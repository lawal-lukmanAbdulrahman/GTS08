import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/session", () => ({ API_BASE: "http://api.test/api/v1", getToken: () => "tok-1" }));

import { uploadToCloudinary } from "./cloudinary-upload";

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "shirt.png", { type: "image/png" });

describe("uploadToCloudinary (authenticated proxy only)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the image to our own upload route with the staff token, never to Cloudinary", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: "https://res.cloudinary.com/x/a.png", public_id: "gts/a" }), { status: 200 }));
    const out = await uploadToCloudinary(png());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/v1/upload");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-1" });
    expect(out).toMatchObject({ url: "https://res.cloudinary.com/x/a.png", public_id: "gts/a" });
  });

  it("fails loudly with the server's message instead of saving a local blob: URL", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Images can be at most 5 MB.", code: "FILE_TOO_LARGE" }), { status: 413 }));
    await expect(uploadToCloudinary(png())).rejects.toThrow("Images can be at most 5 MB.");
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes("cloudinary.com"))).toBe(true);
  });

  it("fails with a clear message when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(uploadToCloudinary(png())).rejects.toThrow(/couldn't reach the server/i);
  });

  it("rejects a response with no image URL rather than returning an empty one", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await expect(uploadToCloudinary(png())).rejects.toThrow(/no image url/i);
  });
});
