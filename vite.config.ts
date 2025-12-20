import { defineConfig } from "vite";
import {
	vitePlugin as remix,
	cloudflareDevProxyVitePlugin,
} from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";
import { getLoadContext } from "./load-context";

declare module "@remix-run/cloudflare" {
	interface Future {
		v3_singleFetch: true;
	}
}

export default defineConfig({
	plugins: [
		cloudflareDevProxyVitePlugin({
			getLoadContext,
		}),
		remix({
			future: {
				v3_fetcherPersist: true,
				v3_relativeSplatPath: true,
				v3_throwAbortReason: true,
				v3_singleFetch: true,
				v3_lazyRouteDiscovery: true,
			},
		}),
		tsconfigPaths(),
	],
	ssr: {
		resolve: {
			conditions: ["workerd", "worker", "browser"],
		},
	},
	resolve: {
		mainFields: ["browser", "module", "main"],
	},
	build: {
		minify: "esbuild",
		target: "es2020",
		cssMinify: true,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// 将 node_modules 中的大型库单独打包
					if (id.includes("node_modules")) {
						// React 相关
						if (id.includes("react") || id.includes("react-dom")) {
							return "vendor-react";
						}
						// Remix 相关
						if (id.includes("@remix-run")) {
							return "vendor-remix";
						}
						// 其他第三方库
						return "vendor";
					}
				},
				chunkFileNames: "assets/[name]-[hash].js",
				entryFileNames: "assets/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash].[ext]",
			},
		},
		chunkSizeWarningLimit: 1000,
	},
});
