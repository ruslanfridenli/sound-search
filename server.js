const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const publicFiles = new Set(["index.html", "styles.css", "app.js", "screenshots/app.png"]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!publicFiles.has(relativePath)) {
      response.writeHead(404).end("not found");
      return;
    }

    const file = path.join(root, relativePath);
    fs.readFile(file, (error, content) => {
      if (error) {
        response.writeHead(404).end("not found");
        return;
      }
      response.writeHead(200, { "content-type": contentTypes[path.extname(file)] || "application/octet-stream" });
      response.end(content);
    });
  } catch {
    response.writeHead(400).end("bad request");
  }
}).listen(8000, "127.0.0.1", () => {
  console.log("needle is running at http://localhost:8000");
});
