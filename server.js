import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

function createServer() {
  const server = new McpServer({
    name: "valmex-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "buscar_articulo",
    {
      title: "Buscar articulo",
      description: "Busca un articulo por codigo",
      inputSchema: z.object({
        codigo: z.string().min(1).describe("Codigo del articulo"),
      }),
    },
    async ({ codigo }) => {
      return {
        content: [
          {
            type: "text",
            text: `Busqueda simulada: ${codigo}`,
          },
        ],
      };
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



