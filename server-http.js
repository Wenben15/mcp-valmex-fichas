// server-http.js
import express from "express";
import cors from "cors";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // ficha técnica
const INVENTORY_BASE_URL =
  process.env.INVENTORY_BASE_URL || "https://valvuleriamexicana.org/compras_agent_ia";
const INVENTORY_API_KEY = process.env.INVENTORY_API_KEY; // x-api-key

const PORT = process.env.PORT || 3000;

if (!APPS_SCRIPT_URL) {
  console.error("❌ Falta APPS_SCRIPT_URL en variables de entorno");
  process.exit(1);
}

const app = express();
app.use(cors());

// ⚠️ IMPORTANTE: NO pongas express.json() antes de /mcp
// Porque rompe el stream y provoca: "stream is not readable"

// -------------------- MCP Server --------------------
const mcp = new McpServer({
  name: "valmex-mcp",
  version: "1.0.0",
});

// Tool: ficha técnica
mcp.tool(
  "get_ficha_tecnica",
  { codigo: z.string().min(1).describe("Código del producto, ej. 10.100") },
  async ({ codigo }) => {
    const url = `${APPS_SCRIPT_URL}?codigo=${encodeURIComponent(codigo)}`;
    const res = await fetch(url);

    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ found: false, error: `HTTP ${res.status}` }) }],
      };
    }

    const data = await res.json(); // {found, codigo, url}
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

// Tool: inventario (por artículo)
mcp.tool(
  "get_inventario",
  { articulo: z.string().min(1).describe("Artículo, ej. 10.002") },
  async ({ articulo }) => {
    const url = `${INVENTORY_BASE_URL}/articulos/${encodeURIComponent(articulo)}`;
    const headers = { Accept: "application/json" };

    // Si la API requiere x-api-key, lo mandamos
    if (INVENTORY_API_KEY) headers["x-api-key"] = INVENTORY_API_KEY;

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              status: res.status,
              error: "Inventory API request failed",
              response: text,
              url,
            }),
          },
        ],
      };
    }

    const data = await res.json();

    // Si viene un arreglo, filtramos por Articulo = articulo
    const row = Array.isArray(data)
      ? data.find((x) => String(x.Articulo) === String(articulo))
      : data;

    if (!row) {
      return { content: [{ type: "text", text: JSON.stringify({ found: false, articulo }) }] };
    }

    // Regresamos solo lo útil
    const result = {
      Articulo: row.Articulo,
      Descripcion: row.Descripcion,
      Marca: row.Marca,
      Existencia_VALMEX: row.Existencia_VALMEX,
      Existencia_Guadalajara: row.Existencia_Guadalajara,
      Existencia_GRUPO: row.Existencia_GRUPO,
      Existencia_VALMAIN: row.Existencia_VALMAIN,
      Existencia_Total: row.Existencia_Total,
    };

    return { content: [{ type: "text", text: JSON.stringify({ found: true, ...result }) }] };
  }
);

// -------------------- SSE plumbing (MCP) --------------------
// Guardamos transport por sessionId (memoria)
const transports = new Map();

// 1) GET /mcp => abre SSE y crea sessionId
app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp", res);
  const sessionId = transport.sessionId;

  transports.set(sessionId, transport);

  res.on("close", () => {
    transports.delete(sessionId);
  });

  await mcp.connect(transport);
});

// 2) POST /mcp?sessionId=... => JSON-RPC del cliente
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

  // ⚠️ Aquí el SDK necesita leer el stream crudo del request.
  await transport.handlePostMessage(req, res);
});

// Healthcheck
app.get("/", (req, res) => res.type("text").send("OK Valmex MCP SSE running"));

app.listen(PORT, () => console.log(`✅ MCP HTTP/SSE listo en puerto ${PORT}`));

// Ya puedes usar express.json() PARA OTRAS RUTAS si lo ocupas,
// pero agrégalo después de /mcp.
