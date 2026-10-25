import process from "node:process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
function run(values, args = []) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/seed-super-admin.mjs", ...args],
      {
        env: {
          ...process.env,
          SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
          SEED_ADMIN_PASSWORD: "test-password-for-local-only",
          ...values,
        },
      },
    );
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("close", (code) => resolve({ code, output }));
  });
}
test("rejects remote targets and missing passwords before accessing Auth", async () => {
  assert.notEqual((await run({ SUPABASE_URL: "https://example.com" })).code, 0);
  assert.notEqual(
    (
      await run({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SEED_ADMIN_PASSWORD: "",
      })
    ).code,
    0,
  );
});
test("creates the confirmed local account and activates exactly that profile", async () => {
  const requests = [];
  const id = "00000000-0000-4000-8000-000000000001";
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      path: req.url,
      method: req.method,
      body: JSON.parse(body),
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        req.url === "/auth/v1/admin/users"
          ? { id, email: "super-admin@example.com" }
          : { id },
      ),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const result = await run({
      SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
      SEED_ADMIN_EMAIL: "super-admin@example.com",
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(requests[0].body.email_confirm, true);
    assert.equal(requests[0].body.email, "super-admin@example.com");
    assert.equal(requests[1].method, "PATCH");
    assert.match(requests[1].path, new RegExp(`id=eq.${id}`));
    assert.deepEqual(requests[1].body, {
      role: "super_admin",
      status: "active",
    });
    assert.ok(!result.output.includes("test-password-for-local-only"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("production mode requires an HTTPS origin and credentials", async () => {
  const invalid = await run({ SUPABASE_URL: "http://example.com" }, [
    "--production",
  ]);
  assert.notEqual(invalid.code, 0);
  assert.match(invalid.output, /HTTPS project origin/);
  const missing = await run(
    { SUPABASE_URL: "https://example.com", SEED_ADMIN_PASSWORD: "" },
    ["--production"],
  );
  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /SEED_ADMIN_PASSWORD/);
});
