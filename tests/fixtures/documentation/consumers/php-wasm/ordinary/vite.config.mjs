/**
 * Bundle the Lean package and serve the pinned PHP host unchanged.
 *
 * @file
 */
export default {
	base: './'
	, build: {
		assetsInlineLimit: 0
		, rollupOptions: { external: ['/php-host/PhpWeb.mjs'] }
	}
};
