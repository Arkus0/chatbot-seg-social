import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_PORT = 3000;
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function getPort(): number {
  const candidate = Number(process.env.PORT ?? DEFAULT_PORT);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : DEFAULT_PORT;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(body);
}

function createVercelResponse(response: ServerResponse) {
  return {
    status(code: number) {
      response.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      if (!response.hasHeader("content-type")) {
        response.setHeader("content-type", "application/json; charset=utf-8");
      }
      response.end(JSON.stringify(payload));
      return this;
    },
    send(payload: string | Buffer) {
      response.end(payload);
      return this;
    },
    setHeader(name: string, value: string) {
      response.setHeader(name, value);
      return this;
    },
  };
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  return raw;
}

function resolveStaticPath(pathname: string): string {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = resolve(ROOT_DIR, `.${relativePath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    throw new Error("Path traversal blocked.");
  }

  return absolutePath;
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  let absolutePath: string;

  try {
    absolutePath = resolveStaticPath(pathname);
    await access(absolutePath, fsConstants.R_OK);
  } catch {
    sendText(response, 404, "Not found");
    return;
  }

  const body = await readFile(absolutePath);
  const extension = extname(absolutePath);

  response.statusCode = 200;
  response.setHeader("content-type", MIME_TYPES.get(extension) ?? "application/octet-stream");
  response.end(body);
}

async function serveApi(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  const absolutePath = resolve(ROOT_DIR, `.${pathname}.ts`);

  try {
    await access(absolutePath, fsConstants.R_OK);
  } catch {
    sendJson(response, 404, {
      ok: false,
      error: "API route not found",
    });
    return;
  }

  const moduleUrl = `${pathToFileURL(absolutePath).href}?t=${Date.now()}`;
  const handlerModule = await import(moduleUrl);
  const handler = handlerModule.default;

  if (typeof handler !== "function") {
    throw new Error(`Invalid API handler for ${pathname}`);
  }

  const body = await readRequestBody(request);
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${getPort()}`}`);
  const reqLike = Object.assign(request, {
    body,
    query: Object.fromEntries(requestUrl.searchParams.entries()),
  });

  await handler(reqLike, createVercelResponse(response));
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendText(response, 400, "Missing request URL");
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? `localhost:${getPort()}`}`);

  try {
    if (requestUrl.pathname.startsWith("/api/")) {
      await serveApi(request, response, requestUrl.pathname);
      return;
    }

    await serveStatic(requestUrl.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, {
      ok: false,
      error: "Internal server error",
    });
  }
});

server.listen(getPort(), () => {
  console.log(`Dev server running at http://localhost:${getPort()}`);
});
