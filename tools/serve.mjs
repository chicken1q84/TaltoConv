import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// HTML直接起動でコピー制限があるブラウザ向けの、小さなローカルサーバーです。
// 外部へ公開せず127.0.0.1だけで待ち受けるため、このPCからのみアクセスできます。
// 使い方: node tools/serve.mjs [ポート] [配信するフォルダ]
//   フォルダを省略するとこのツールのソースを配信します。dist を指定すると Web版の動作確認に使えます。
const root = path.resolve(process.argv[3] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.argv[2] || 8765);
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8"
};

http.createServer((request, response) => {
  // URLを配布フォルダ内のファイルへ変換します。上位フォルダへ出る要求は404にします。
  const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
  // 「/」は index.html があればそれを、なければソースの日本語名HTMLを返します。
  const indexName = fs.existsSync(path.join(root, "index.html")) ? "index.html" : "非公式TALTO移行ヘルパー.html";
  const relative = requestPath === "/" ? indexName : decodeURIComponent(requestPath.slice(1));
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`TALTO migration helper: http://127.0.0.1:${port}/`);
});
