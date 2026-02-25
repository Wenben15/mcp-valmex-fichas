import express from "express";
import cors from "cors";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // <-- ponla en Render como env var

if (!APPS_SCRIPT_URL) {
  console.error("Falta APPS_SCRIPT_URL en variables de entorno");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ---- MCP server definition ----
const mcp = new McpServer({
  name: "valmex-fichas-mcp",
  version: "1.0.0",
});

mcp.tool(
  "get_ficha_tecnica",
  {
    codigo: z.string().min(1).describe("Código del producto, ej. 10.100"),
  },
  async ({ codigo }) => {
    const url = `${APPS_SCRIPT_URL}?codigo=${encodeURIComponent(codigo)}`;
    const res = await fetch(url);

    if (!res.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify({ found: false, error: `HTTP ${res.status}` }) }],
        isError: true,
      };
    }

    const data = await res.json(); // {found, codigo, url}
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  }
);

// ---- SSE endpoints ----
// El SDK maneja 2 rutas típicas:
// 1) GET /mcp (abre el stream SSE)
// 2) POST /mcp (recibe mensajes del cliente)

app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp", res);
  await mcp.connect(transport);
});

app.post("/mcp", async (req, res) => {
  // Este handler es requerido por el transport SSE del SDK.
  // El transport lo “engancha” internamente al conectar.
  res.status(200).end();
});

app.get("/", (req, res) => {
  res.type("text").send("OK Valmex MCP SSE running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP HTTP/SSE listo en puerto ${PORT}`));
