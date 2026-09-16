/*
 * Web版（GitHub Pages）だけで使う Service Worker です。ZIP版には含まれません。
 * ビルド時に __VERSION__・__BUILD_ID__・__PRECACHE__ が実際の値へ置き換わります。
 *
 * キャッシュ名にはバージョンだけでなく、配信ファイル全体のハッシュ（BUILD_ID）も含めます。
 * バージョン番号を上げずにアイコンやスクリプトだけ差し替えた場合でも、この SW の内容が変わり、
 * ブラウザが更新を検出して新しいキャッシュを作ります（同じ SW のままだと古いファイルが使われ続けるため）。
 *
 * 方針:
 *   - install で配信ファイル一式をまとめてキャッシュする（precache）。
 *     1つでも取得に失敗したら install 自体を失敗させ、欠けたキャッシュで動作させない。
 *   - activate でこの版以外のキャッシュを削除する。キャッシュ名にバージョンを含めるのはこのため。
 *   - fetch は同一オリジンの GET だけを扱い、キャッシュ優先で応答する。
 *     画面遷移（navigate）はキャッシュ済みの index.html を返し、オフラインでも起動できるようにする。
 *   - 原稿データはこの SW を通らない。変換は端末内で完結し、外部へ送信しない。
 */
const VERSION = "__VERSION__";
const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `talto-helper-${VERSION}-${BUILD_ID}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// 画面側の「再読み込み」ボタンから送られる合図で、待機中の新しい版を即座に有効化します。
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === "navigate") {
      const page = await cache.match("./index.html");
      if (page) return page;
    }
    // クエリ文字列付きで開かれても同じファイルを返せるよう、検索部分は無視して照合します。
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return fetch(request);
  })());
});
