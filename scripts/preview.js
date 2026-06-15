import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const PORT = Number.parseInt(process.env.PORT || "5173", 10);
const ROOT = process.cwd();
const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
};
const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url || "/", `http://${request.headers.host}`);
        const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
        const filePath = normalize(join(ROOT, pathname));
        const body = await readFile(filePath);
        response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
        response.end(body);
    }
    catch {
        response.writeHead(404);
        response.end("Not found");
    }
});
server.listen(PORT, () => console.log(`Client running on http://localhost:${PORT}`));
