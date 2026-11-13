/**
 * Echo Kit eval MCP server (stdio). Tools: run_evals, list_failures, show_case.
 * Lets Kiro run the eval harness and read failing cases without leaving the chat.
 * Local only: reads the repo's consults and schemas; no network.
 * Nothing may be written to stdout except MCP messages.
 */

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { listFailures, runEvals, showCase } from "./tools";

const broken = z
  .boolean()
  .optional()
  .describe("Use the deliberately broken extractor, to see what a failing run looks like");

const reply = (text: string, data: unknown) => ({
  content: [
    { type: "text" as const, text },
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ],
});

serveStdio(() => {
  const server = new McpServer({ name: "echo-kit-evals", version: "1.0.0" });

  server.registerTool(
    "run_evals",
    {
      description:
        "Run the Echo Kit eval harness over all scripted consults. Reports facts kept, dropped, invented and unanchored, flagged-token recall and checklist accuracy. Does not write results.json.",
      inputSchema: z.object({ broken }),
    },
    ({ broken: b }) => {
      const r = runEvals(b ?? false);
      return reply(r.text, r.data);
    },
  );

  server.registerTool(
    "list_failures",
    {
      description: "List the eval cases that fail, with why.",
      inputSchema: z.object({ broken }),
    },
    ({ broken: b }) => {
      const r = listFailures(b ?? false);
      return reply(r.text, r.data);
    },
  );

  server.registerTool(
    "show_case",
    {
      description:
        "Show one eval case: its transcript, planted facts, the facts Echo accepted, and any invented or dropped facts.",
      inputSchema: z.object({ id: z.string().describe("Case id, e.g. care-01"), broken }),
    },
    ({ id, broken: b }) => {
      const r = showCase(id, b ?? false);
      if (!r)
        return {
          isError: true,
          content: [{ type: "text" as const, text: `No eval case "${id}".` }],
        };
      return reply(r.text, r.data);
    },
  );

  return server;
});
