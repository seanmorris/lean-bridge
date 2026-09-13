/**
 * Wait for each demo's existing result UI without changing its user-facing wording.
 *
 * @file
 */

/**
 * Await a completed initial computation on a React or source-preview demo.
 *
 * @param page Playwright page displaying the workbench.
 * @param slug Manifest algorithm slug.
 */
export const waitForWorkbench = async (page, slug) => {
	const readiness = {
		"lean-dijkstra": ["#status.ready", "."]
		, "lean-tutte": [".tutte-verdict", "Lean accepts this construction"]
		, "lean-flood-fill": ["#runtime", "^[0-9]"]
		, "lean-union-find": ["#runtime", "^[0-9]"]
		, "lean-aho-corasick": ["#match-count", "^[0-9]"]
		, "lean-a-star": ["#runtime-status", "Both searches run"]
		, "lean-tarjan": ["#runtime-status", "Groups computed"]
	};
	const [selector, pattern] = readiness[slug] ?? ["#runtime-status", "ready"];
	await page.waitForFunction(({ selector, pattern }) => {
		const text = globalThis.document.querySelector(selector)?.textContent;
		return text !== undefined && new RegExp(pattern).test(text);
	}, { selector, pattern });
};
