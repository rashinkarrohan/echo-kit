/**
 * Talks to the real server over stdio with the MCP client, the way Kiro does.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
let client: Client;

const text = (r: { content: unknown }): string =>
  (r.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? "").join("\n");

beforeAll(async () => {
  client = new Client({ name: "echo-kit-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: "pnpm", args: ["-s", "start"], cwd, stderr: "ignore" }),
  );
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe("echo-kit-evals MCP server", () => {
  it("lists the three tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["list_failures", "run_evals", "show_case"]);
  });

  it("run_evals passes with the rules extractor", async () => {
    const r = await client.callTool({ name: "run_evals", arguments: {} });
    expect(text(r)).toMatch(/PASSED/);
    expect(text(r)).toMatch(/invented 0, unanchored 0/);
  });

  it("a deliberately broken extractor fails, and a failing case can be read", async () => {
    const run = await client.callTool({ name: "run_evals", arguments: { broken: true } });
    expect(text(run)).toMatch(/FAILED/);

    const failures = await client.callTool({ name: "list_failures", arguments: { broken: true } });
    expect(text(failures)).toMatch(/care-01: .*invented fact/);

    const shown = await client.callTool({
      name: "show_case",
      arguments: { id: "care-01", broken: true },
    });
    const body = text(shown);
    expect(body).toMatch(/care-01 \(doctor-visit\): FAILS/);
    expect(body).toMatch(/invented medicine/);
    expect(body).toContain("seg-0002");
  });

  it("show_case reports an unknown id as an error", async () => {
    const r = await client.callTool({ name: "show_case", arguments: { id: "nope" } });
    expect(r.isError).toBe(true);
  });
}, 120_000);
