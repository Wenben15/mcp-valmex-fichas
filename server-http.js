import express from "express";
import cors from "cors";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
if (!APPS_SCRIPT_URL) {
  console.error("Falta APPS_SCRIPT_URL en variables de entorno");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// MCP server
// ===============================
const mcp = new McpServer({
  name: "valmex-fichas-mcp",
  version: "1.0.0",
});

mcp.tool(
  "get_ficha_tecnica",
  { codigo: z.string().min(1).describe("Código del producto, ej. 10.100") },
  async ({ codigo }) => {
    const url = `${APPS_SCRIPT_URL}?codigo=${encodeURIComponent(codigo)}`;

    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ found: false, error: "No se pudo conectar a Apps Script" }),
          },
        ],
      };
    }

    if (!res.ok) {
      return {
        isError: true,
        content: [
          { type: "text", text: JSON.stringify({ found: false, error: `HTTP ${res.status}` }) },
        ],
      };
    }

    const data = await res.json(); // { found, codigo, url }
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

// ===============================
// SSE plumbing (IMPORTANT)
// ===============================
// Guardamos transports por sessionId para que el POST /mcp funcione.
const transports = new Map();

/**
 * 1) GET /mcp  -> abre el stream SSE y genera sessionId
 * 2) POST /mcp?sessionId=... -> recibe JSON-RPC del cliente y lo enruta al transport correcto
 */
app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp", res);
  const sessionId = transport.sessionId;

  transports.set(sessionId, transport);

  // Limpieza al cerrar el stream
  res.on("close", () => {
    transports.delete(sessionId);
  });

  await mcp.connect(transport);
});

app.post("/mcp", async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "Falta sessionId en query (?sessionId=...)" });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "sessionId inválido o expirado" });
    return;
  }

  // Esta es LA pieza que te falta: responder JSON-RPC correctamente
  await transport.handlePostMessage(req, res);
});

// Healthcheck
app.get("/", (req, res) => {
  res.type("text").send("OK Valmex MCP SSE running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP HTTP/SSE listo en puerto ${PORT}`));
