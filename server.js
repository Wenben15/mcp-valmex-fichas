import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

if (!APPS_SCRIPT_URL) {
  console.error("Falta APPS_SCRIPT_URL");
  process.exit(1);
}

function createServer() {
  const server = new McpServer({
    name: "valmex-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "buscar_articulo",
    {
      title: "Buscar articulo",
      description: "Busca un articulo por codigo en la API de Valmex.",
      inputSchema: z.object({
        codigo: z.string().min(1).describe("Codigo del articulo. Ejemplo: 10.100"),
      }),
      outputSchema: z.object({
        ok: z.boolean().optional(),
      }).passthrough(),
    },
    async ({ codigo }) => {
      try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set("tipo", "articulo");
        url.searchParams.set("q", codigo);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const output = {
            ok: false,
            codigo,
            error: `HTTP ${response.status}`,
          };

          return {
            content: [{ type: "text", text: JSON.stringify(output) }],
            structuredContent: output,
            isError: true,
          };
        }

        const data = await response.json();

        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      } catch (error) {
        const output = {
          ok: false,
          codigo,
          error: error instanceof Error ? error.message : "Unknown error",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    }
  );

  return server;
}

app.all("/mcp", async (req, res) => {
  console.log("MCP request", {
    method: req.method,
    path: req.path,
    accept: req.headers.accept,
    contentType: req.headers["content-type"],
    protocolVersion: req.headers["mcp-protocol-version"],
    body: req.body,
  });

  try {
    const server = createServer();

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP /mcp error full:", err);
    console.error("MCP /mcp error stack:", err?.stack);

    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
        stack: err?.stack ?? null,
      });
    }
  }
});

app.get("/", (_req, res) => {
  res.status(200).send("OK MCP limpio");
});

app.listen(PORT, HOST, () => {
  console.log(`MCP Valmex listo en ${HOST}:${PORT}`);
});
