/**
 * Coordinate installed copied-value packages before a PHP-Wasm host starts.
 * This module is copied verbatim into the dedicated runtime npm package.
 *
 * @file
 */
const property = "__leanBridgePhpWasmBootstrapV1";
const protocol = "php-wasm-copied-loading-v1";
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const reject = (code, message) => { throw Object.assign(new Error(message), { code }); };

/**
 * Bind a generated component descriptor to its exact shared-runtime package.
 *
 * @param runtime - Runtime and loader identities, with a package-relative URL.
 * @param component - Generated, closed component loading metadata.
 * @param assets - Statically declared URLs for bundlers and native ESM consumers.
 */
export const createPhpWasmCopiedDescriptor = (runtime, component, assets) => {
	if(!hash(runtime?.identity) || !hash(runtime?.loaderIdentity)
		|| !/^liblean_bridge_php_wasm_copied_[a-f0-9]{20}\.so$/.test(runtime.library)
		|| !hash(component?.identity) || !hash(component?.runtimeIdentity)
		|| typeof component.id !== "string" || !component.id.length
		|| !/^Lean[A-Za-z0-9_]+$/.test(component.namespace)
		|| !/^php8\.4-lb_[a-z0-9_]+_[a-f0-9]{16}\.so$/.test(component.library)
		|| !/^[a-z][a-z0-9_-]*\/[a-z][a-z0-9_-]*$/.test(component.composer)
		|| ![assets?.library, assets?.api, assets?.native, assets?.registration].every(url => url instanceof URL))
		reject("invalid-php-wasm-descriptor", "Invalid generated PHP-Wasm copied descriptor");
	if(runtime.identity !== component.runtimeIdentity) reject("php-wasm-runtime-conflict", "Component requires another PHP-Wasm runtime");
	const definition = Object.freeze({ ...component });
	const fingerprint = JSON.stringify([definition.id, definition.identity, definition.namespace, definition.library, definition.composer]);
	if(assets.php !== undefined && (!assets.php || typeof assets.php !== "object"
		|| !(assets.php["bootstrap.php"] instanceof URL)
		|| Object.entries(assets.php).some(([path, url]) => !(url instanceof URL)
			|| path !== "bootstrap.php" && !/^dependencies\/brick-math\/(?:autoload\.php|LICENSE|composer\.json|src\/[A-Za-z0-9_/]+\.php)$/.test(path))))
		reject("invalid-php-wasm-descriptor", "Invalid bundled PHP dependencies");
	const autoload = `/vendor/${definition.composer}/${assets.php ? "bootstrap.php" : "src/Api.php"}`;
	const prepare = (php, mode, getLibs) => {
		const args = php?.phpArgs;
		if(!args || typeof args !== "object" || php.phpVersion !== "8.4" || (php.phpVariant ?? "") !== "")
			reject("unsupported-php-wasm-host", "This package requires PHP-Wasm 0.1.0, PHP 8.4, with the default variant");
		if(php.binary !== undefined) reject("php-wasm-host-already-started", "Register copied descriptors before PHP starts");
		const wrongList = mode === "startup" ? args.dynamicLibs : args.sharedLibs;
		if((wrongList ?? []).flat().some(item => item?.getLibs === getLibs))
			reject("unsupported-php-wasm-loading", mode === "startup" ? "Use the lazy descriptor in dynamicLibs, or the default descriptor in sharedLibs" : "Register the lazy descriptor in dynamicLibs, not sharedLibs");
		let state = args[property];
		if(state !== undefined && (state.protocol !== protocol || state.runtimeIdentity !== runtime.identity
			|| state.loaderIdentity !== runtime.loaderIdentity || !(state.components instanceof Map) || !(state.namespaces instanceof Map)
			|| !(state.packages instanceof Map) || !(state.libraries instanceof Map)))
			reject("php-wasm-runtime-conflict", "PHP-Wasm packages require incompatible Lean runtimes or loaders");
		if(state === undefined)
		{
			state = { protocol, runtimeIdentity: runtime.identity, loaderIdentity: runtime.loaderIdentity, components: new Map(), namespaces: new Map(), packages: new Map(), libraries: new Map(), runtimeEmitted: false };
			Object.defineProperty(args, property, { value: state, enumerable: true });
		}
		let entry = state.components.get(definition.id);
		if(entry && entry.fingerprint !== fingerprint) reject("php-wasm-component-conflict", `Conflicting compiled package: ${definition.id}`);
		if(entry && entry.mode !== mode) reject("php-wasm-loading-conflict", `Choose one loading mode per component: ${definition.id}`);
		const owner = state.namespaces.get(definition.namespace.toLowerCase());
		if(owner !== undefined && owner !== definition.id) reject("php-wasm-namespace-conflict", `PHP namespace already belongs to another package: ${definition.namespace}`);
		for(const [registry, name] of [[state.packages, definition.composer], [state.libraries, definition.library]])
			if(registry.has(name) && registry.get(name) !== definition.id) reject("php-wasm-package-path-conflict", `PHP-Wasm package path already belongs to another component: ${name}`);
		if(!entry)
		{
			entry = { fingerprint, mode, librariesEmitted: false, filesEmitted: false, registrationEmitted: false };
			state.components.set(definition.id, entry);
			state.namespaces.set(definition.namespace.toLowerCase(), definition.id);
			state.packages.set(definition.composer, definition.id);
			state.libraries.set(definition.library, definition.id);
		}
		return { state, entry };
	};
	const create = mode => {
		const getLibs = php => {
			const { state, entry } = prepare(php, mode, getLibs), libraries = [];
			if(!state.runtimeEmitted)
			{
				libraries.push({ name: runtime.library, url: new URL(runtime.url), ini: false });
				state.runtimeEmitted = true;
			}
			if(!entry.librariesEmitted)
			{
				libraries.push({ name: definition.library, url: new URL(assets.library), ini: mode === "startup" });
				entry.librariesEmitted = true;
			}
			return libraries;
		};
		const getRegistration = php => {
			const { entry } = prepare(php, mode, getLibs);
			if(entry.registrationEmitted) return [];
			entry.registrationEmitted = true;
			return [{ path: `/__lean_bridge/php_wasm_lazy/${definition.library}.txt`, url: new URL(assets.registration) }];
		};
		const getFiles = php => {
			const files = mode === "lazy" ? getRegistration(php) : [];
			const { entry } = prepare(php, mode, getLibs);
			if(entry.filesEmitted) return files;
			entry.filesEmitted = true;
			const sources = [["src/Api.php", assets.api], ["src/Internal/Native.php", assets.native], ...Object.entries(assets.php ?? {})].map(([path, url]) => ({
				path: `/vendor/${definition.composer}/${path}`
				, url: new URL(url)
			}));
			return files.concat(sources);
		};
		return Object.freeze({ getLibs, getFiles, autoload, extensions: Object.freeze({ getLibs, ...(mode === "lazy" ? { getFiles: getRegistration } : {}) }) });
	};
	return Object.freeze({ ...create("startup"), lazy: create("lazy") });
};
