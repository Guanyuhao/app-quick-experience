import { createRequestHandler, type ServerBuild } from "@remix-run/cloudflare";
// @ts-ignore - This file won't exist if it hasn't yet been built
import * as build from "./build/server";
import { getLoadContext } from "./load-context";

const handleRemixRequest = createRequestHandler(build as unknown as ServerBuild);

export default {
	async fetch(request, env, ctx) {
		try {
			const loadContext = getLoadContext({
				request,
				context: {
					cloudflare: {
						// This object matches the return value from Wrangler's
						// `getPlatformProxy` used during development via Remix's
						// `cloudflareDevProxyVitePlugin`:
						// https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
						cf: request.cf,
						ctx: {
							waitUntil: ctx.waitUntil.bind(ctx),
							passThroughOnException: ctx.passThroughOnException.bind(ctx),
							props: {},
						},
						caches,
						env,
					},
				},
			});
			const response = await handleRemixRequest(request, loadContext);
			
			// 添加安全响应头
			response.headers.set("X-Content-Type-Options", "nosniff");
			response.headers.set("X-Frame-Options", "SAMEORIGIN");
			response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
			
			return response;
		} catch (error) {
			console.log(error);
			return new Response("An unexpected error occurred", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
