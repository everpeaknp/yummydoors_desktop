import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function getBackendBaseUrl() {
  const explicit = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  return (explicit || "https://yummydoorsapi.everacy.com").replace(/\/+$/, "");
}

function filterRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  const allow = new Set([
    "authorization",
    "content-type",
    "accept",
    "accept-language",
    "x-requested-with",
  ]);

  req.headers.forEach((value, key) => {
    if (allow.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

function filterResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const allow = new Set([
    "content-type",
    "content-disposition",
    "cache-control",
    "pragma",
    "expires",
  ]);

  upstream.headers.forEach((value, key) => {
    if (allow.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  return headers;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const backend = getBackendBaseUrl();
  const upstreamUrl = new URL(`${backend}/api/v1/${path.join("/")}`);
  req.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  const method = req.method.toUpperCase();
  const headers = filterRequestHeaders(req);
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const resHeaders = filterResponseHeaders(upstream);
    const resBody = await upstream.arrayBuffer();
    resHeaders.set("x-upstream-status", String(upstream.status));
    resHeaders.set("x-proxy-upstream-base", backend);

    if (!upstream.ok) {
      const contentType = upstream.headers.get("content-type") || "";
      const textSnippet = new TextDecoder().decode(resBody).slice(0, 1500);
      console.error(
        `[yummydoors proxy] upstream error method=${method} url=${upstreamUrl.toString()} status=${upstream.status} body=${textSnippet}`,
      );

      if (!contentType.toLowerCase().includes("application/json")) {
        return new Response(
          JSON.stringify({
            detail: textSnippet || `Upstream request failed with status ${upstream.status}.`,
            upstream_status: upstream.status,
            upstream_url: upstreamUrl.toString(),
          }),
          {
            status: upstream.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              pragma: "no-cache",
              expires: "0",
              "x-upstream-status": String(upstream.status),
              "x-proxy-upstream-base": backend,
            },
          },
        );
      }
    }

    return new Response(resBody, { status: upstream.status, headers: resHeaders });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Proxy upstream fetch failed",
        url: upstreamUrl.toString(),
        error: String(error?.message || error),
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
