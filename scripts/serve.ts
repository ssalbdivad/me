/**
 * Serves the prerendered site in dist/client exactly as a static host would.
 *
 * Run: node scripts/serve.ts [port]
 */
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"

const root = new URL("../dist/client", import.meta.url).pathname
const port = Number(process.argv[2] ?? 4173)

const types: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".xml": "application/xml"
}

const decode = (pathname: string) => {
	try {
		return decodeURIComponent(pathname)
	} catch {
		// a malformed escape like /%E0 is just another unknown path
		return pathname
	}
}

const resolve = (url: string) => {
	const path = normalize(decode(new URL(url, "http://x").pathname))
	const file = join(root, path)
	if (!file.startsWith(root)) return
	if (existsSync(file) && statSync(file).isFile()) return file
	const index = join(file, "index.html")
	if (existsSync(index)) return index
}

createServer((req, res) => {
	const file = resolve(req.url ?? "/")
	const status = file ? 200 : 404
	const body = file ?? join(root, "404.html")
	if (!existsSync(body)) return res.writeHead(404).end("not found")
	res.writeHead(status, {
		"content-type": types[extname(body)] ?? "application/octet-stream"
	})
	createReadStream(body).pipe(res)
}).listen(port, () => console.log(`http://localhost:${port}`))
