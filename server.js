import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

/**
 * Servidor MCP
 */
function createServer() {
  const server = new McpServer({
    name: "test-mcp",
    version: "1.0.0",
  });

  // 👇 TOOL ULTRA SIMPLE (sin schemas complejos)
  server.registerTool(
    "test_tool",
    {
      title: "Test tool",
      description: "Tool de prueba",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "ok",
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Endpoint MCP
 */
app.post("/mcp", async (req, res) => {
  try {
    const server = createServer();

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP ERROR MESSAGE:", err?.message);
    console.error("MCP ERROR STACK:", err?.stack);
    console.error("MCP ERROR FULL:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || "Unknown error",
        stack: err?.stack || null
      });
    }
  }
});

