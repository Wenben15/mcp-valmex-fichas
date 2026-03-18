import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

const mcp = new McpServer({
  name: "valmex-mcp",
  version: "1.0.0",
});

mcp.tool(
  "buscar_articulo",
  {
    codigo: z.string().describe("Código del artículo"),
  },
  async ({ codigo }) => {
    const url = `${APPS_SCRIPT_URL}?tipo=articulo&q=${codigo}`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data),
        },
      ],
    };
  }
);

const transport = new StreamableHTTPServerTransport();

app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

app.get("/", (req, res) => {
  res.send("OK MCP limpio");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await mcp.connect(transport);
  console.log("MCP listo sin sessionId");
});
