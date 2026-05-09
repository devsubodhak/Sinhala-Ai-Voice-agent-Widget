import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Simple script to inject the widget
  app.get("/widget.js", (req, res) => {
    const agentId = req.query['agent-id'] || 'default';
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      (function() {
        var container = document.createElement('div');
        container.id = 'omnivice-widget-root';
        document.body.appendChild(container);
        
        var iframe = document.createElement('iframe');
        iframe.src = '${process.env.APP_URL || 'http://localhost:3000'}/widget?agentId=${agentId}';
        iframe.style.position = 'fixed';
        iframe.style.bottom = '0';
        iframe.style.right = '0';
        iframe.style.width = '400px';
        iframe.style.height = '600px';
        iframe.style.border = 'none';
        iframe.style.zIndex = '999999';
        iframe.style.colorScheme = 'light';
        iframe.allow = 'microphone';
        
        // Handle transparency
        iframe.style.background = 'transparent';
        
        document.body.appendChild(iframe);
      })();
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
