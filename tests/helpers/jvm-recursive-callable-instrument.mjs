/**
 * Isolate fault injection in copied JVM sources, leaving installed JARs unchanged.
 *
 * @file
 */
import assert from 'node:assert/strict';

/**
 * Add counted checkpoints and ownership tracking to regenerated probe sources.
 *
 * @param sources - Verified original generated files.
 * @param namespace - Generated Java package.
 */
export const instrumentJvmRecursiveCallbacks = (sources, namespace) => {
	const files = { ...sources }, edits = {}, prefix = 'src/main/java/' + namespace.replaceAll('.', '/') + '/';
	const replace = (name, key, pattern, replacement, expected) => {
		const file = prefix + name + '.java', count = [...files[file].matchAll(pattern)].length;
		if(expected !== undefined) assert.equal(count, expected, key); else assert.ok(count > 0, key);
		edits[key] = count; files[file] = files[file].replace(pattern, replacement);
	};
	replace('_GraphRuntime', 'checkpoints', /static void checkpoint\(\) \{ \}/g, 'static void checkpoint() { GraphFaultProbe.tick(); }', 1);
	replace('_GraphRuntime', 'arenas', /java\.lang\.foreign\.Arena\.ofConfined\(\)/g, 'GraphFaultProbe.arena()', 1);
	replace('_GraphRuntime', 'allocations', /arena\.allocate\(size, alignment\)/g, 'GraphFaultProbe.allocate(arena, size, alignment)', 1);
	replace('_GraphRuntime', 'scopes', /this.checkOnly = checkOnly;/g, 'GraphFaultProbe.tick(); this.checkOnly = checkOnly;', 1);
	replace('_GraphRuntime', 'opened', /arena = checkOnly \? null : GraphFaultProbe.arena\(\);/g, 'arena = checkOnly ? null : GraphFaultProbe.arena(); GraphFaultProbe.scopes++;', 1);
	replace('_GraphRuntime', 'closed', /hosts.clear\(\); outputs.clear\(\);/g, 'hosts.clear(); outputs.clear(); GraphFaultProbe.scopes--;', 1);
	replace('_GraphRuntime', 'conversion', /( {12}(?:Input|Output) frame = stack.peek\(\);)/g, '            checkpoint();\n$1', 2);
	replace('_CallableGraphRuntime', 'frames', /this.catalog = catalog; this.replies = replies; this.lifecycle = lifecycle;/g, 'GraphFaultProbe.tick(); this.catalog = catalog; this.replies = replies; this.lifecycle = lifecycle; GraphFaultProbe.frames++;', 1);
	replace('_CallableGraphRuntime', 'roots', /void keep\(Object callback\) \{ roots.add\(callback\); \}/g, 'void keep(Object callback) { GraphFaultProbe.tick(); GraphFaultProbe.host(callback); roots.add(callback); GraphFaultProbe.roots++; GraphFaultProbe.tick(); }', 1);
	replace('_CallableGraphRuntime', 'closeFrames', /java.lang.ref.Reference.reachabilityFence\(roots\); roots.clear\(\);/g, 'java.lang.ref.Reference.reachabilityFence(roots); GraphFaultProbe.roots -= roots.size(); roots.clear(); GraphFaultProbe.frames--;', 1);
	replace('_CallableGraphRuntime', 'adopt', /token = value; output.set/g, 'GraphFaultProbe.tick(); token = value; output.set', 1);
	replace('_CallableGraphRuntime', 'register', /return CLEANER.register\(owner, lease\);/g, 'GraphFaultProbe.tick(); var cleanable = CLEANER.register(owner, lease); GraphFaultProbe.tick(); return cleanable;', 1);
	replace('_CallableGraphRuntime', 'release', /release.invokeExact\(value\);/g, 'release.invokeExact(value); GraphFaultProbe.disposals++;', 1);
	replace('_CallableGraphRuntime', 'returned', /( {20}int status = \(int\)[^\n]+;)/g, '$1\n                    GraphFaultProbe.tick();');
	replace('_CallableGraphRuntime', 'stubs', /( {8}var stub = [^\n]+;)/g, '$1\n        GraphFaultProbe.tick();');
	replace('_CallableGraphRuntime', 'clear', /links.clear\(\).invokeExact\(output\);/g, 'GraphFaultProbe.clear(output, links.clear());');
	return { files, edits };
};
