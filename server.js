import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const APPS_SCRIPT_URL = "PEGA_AQUI_TU_URL_DEL_APPS_SCRIPT_EXEC";

const server = new McpServer({
  name: "valmex-fichas-mcp",
  version: "1.0.0",
});

server.tool(
  "get_ficha_tecnica",
  {
    codigo: z.string().min(1).describe("Código del producto, ej. 10.100"),
  },
  async ({ codigo }) => {
    const url = `${APPS_SCRIPT_URL}?codigo=${encodeURIComponent(codigo)}`;
    const res = await fetch(url);
   console.log("✅ MCP Valmex fichas corriendo (STDIO). Esperando conexión...");    


    if (!res.ok) {
      return {
        content: [
          { type: "text", text: JSON.stringify({ found: false, error: `HTTP ${res.status}` }) },
        ],
        isError: true,
      };
    }

    const data = await res.json(); // {found, codigo, url}
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  }
);

await server.connect(new StdioServerTransport());
