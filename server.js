import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const PORT = Number(process.env.PORT || 3000);

if (!APPS_SCRIPT_URL) {
  console.error("Falta la variable de entorno APPS_SCRIPT_URL");
  process.exit(1);
}

const mcp = new McpServer({
  name: "valmex-mcp",
  version: "1.0.0",
});

mcp.tool(
  "buscar_articulo",
  {
    codigo: z.string().min(1).describe("Codigo del articulo. Ejemplo: 10.100"),
  },
  async ({ codigo }) => {
    try {
      const url = new URL(APPS_SCRIPT_URL);
      url.searchParams.set("tipo", "articulo");
      url.searchParams.set("q", codigo);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: `HTTP ${response.status}`,
                codigo,
              }),
            },
          ],
          isError: true,
        };
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              codigo,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Transport stateless para evitar sessionId
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

// Conecta el servidor MCP al transport una sola vez
await mcp.connect(transport);

// Log simple por request
function logMcpRequest(req) {
  console.log("MCP request", {
    method: req.method,
    path: req.path,
    accept: req.headers.accept,
    contentType: req.headers["content-type"],
    protocolVersion: req.headers["mcp-protocol-version"],
    body: req.body,
  });
}

// Endpoint MCP: GET y POST
app.all("/mcp", async (req, res) => {
  logMcpRequest(req);

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP /mcp error:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
});

// Root para validar deploy
app.get("/", (_req, res) => {
  res.status(200).send("OK MCP limpio");
});

app.listen(PORT, () => {
  console.log(`MCP Valmex listo en puerto ${PORT}`);
});
