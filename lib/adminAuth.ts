export const ADMIN_COOKIE = "wf_admin";

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedAdminToken() {
  const password = process.env.ADMIN_PASSWORD || "";
  return sha256Hex(`wf-admin-salt:${password}`);
}
