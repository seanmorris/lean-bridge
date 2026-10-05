/**
 * Project already checked producer metadata into one additive archive receipt.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseNpmPackageCoordinate } from "./component-package-receipt.mjs";
import { packageSetReceiptName, readVerifiedPackageSetReceipt, writePackageSetReceipt } from "./package-set-receipt.mjs";

const read = async path => JSON.parse(await readFile(path, "utf8"));
const ref = ({ ecosystem, name, version }) => ({ ecosystem, name, version });
const artifact = (prefix, item) => ({ path: `${prefix ? `${prefix}/` : ""}${item.archive}`, ...(item.bytes === undefined ? {} : { bytes: item.bytes }), sha256: item.sha256 });
const profile = (id, bindingIrSha256, runtimeIdentity) => ({ id, bindingIrSha256, runtimeIdentity });
const pkg = (target, ecosystem, item, abi, role, runtimeDelivery, requires, artifacts) => ({
	target, ecosystem
	, name: item.name, version: item.version, profile: abi.id, role
	, runtimeIdentity: abi.runtimeIdentity
	, runtimeDelivery, requires, artifacts });

/**
 * Assemble the npm variant without changing its original receipt or archives.
 *
 * @param options - Package output, npm report and exact runtime identity.
 */
export const writeNpmPackageSet = async options => {
	const { root, report, runtimeIdentity, signal } = options;
	const abi = profile("component-scalars-v1", report.bindingIrSha256, runtimeIdentity);
	const runtime = { ecosystem: "npm", ...parseNpmPackageCoordinate(report.runtime.package) };
	const packages = [
		pkg("npm", "npm", runtime, abi, "runtime", "provided", [], [artifact("", report.runtime)])
		, pkg("npm", "npm", parseNpmPackageCoordinate(report.package.package), abi, "component", "dependency", [ref(runtime)], [artifact("", report.package)])
	];
	return writePackageSetReceipt({ root, component: report.component, source: report.source, profiles: [abi], signal, packages });
};

/**
 * Assemble all projections of one already compiled native component.
 *
 * @param options - Native release staging, model, runtime and projections.
 */
export const writeNativePackageSet = async options => {
	const { root, model, runtimeIdentity, projections, signal } = options;
	const abi = profile("native-library-v1", model.bindingIrSha256, runtimeIdentity), packages = [];
	for(const projection of projections)
	{
		if(projection.ecosystem === "cpan")
		{
			const runtime = await read(join(root, "packages/runtime/lean-bridge-package.json"));
			const component = await read(join(root, "packages/component/lean-bridge-package.json"));
			if([runtime, component].some(item => item.nativeRuntimeIdentity !== runtimeIdentity || item.runtimeIdentity !== projection.runtimeIdentity)) throw new Error("CPAN runtime differs from native package set");
			if(component.runtimeVersion !== runtime.version) throw new Error("CPAN component dependency differs from runtime package version");
			const runtimeRef = { ecosystem: "cpan", name: runtime.distribution, version: runtime.version };
			for(const [index, item] of [runtime, component].entries())
				packages.push(pkg("cpan", "cpan", { name: item.distribution, version: item.version }, abi, index ? "component" : "runtime", index ? "dependency" : "provided", index ? [runtimeRef] : [], [artifact("archives", projection.packages[index])]));
			continue;
		}
		if(projection.runtimeIdentity !== runtimeIdentity) throw new Error("Projection runtime differs from native package set");
		const groups = new Map();
		for(const item of projection.packages)
		{
			const key = JSON.stringify([item.name, item.version]);
			if(!groups.has(key)) groups.set(key, pkg(projection.ecosystem, projection.ecosystem === "php-native" ? "composer" : projection.ecosystem, item, abi, "component", "embedded", [], []));
			groups.get(key).artifacts.push(artifact("archives", item));
		}
		packages.push(...groups.values());
	}
	return writePackageSetReceipt({ root, component: model.component, source: { treeSha256: model.sourceIdentity.sourceTreeSha256 }, profiles: [abi], packages, signal });
};

/**
 * Assemble the npm runtime, extension and Composer API from the PHP build.
 *
 * @param options - PHP release staging, compiled model and package report.
 */
export const writePhpWasmPackageSet = async options => {
	const { root, model, report, signal } = options;
	const abi = profile("php-wasm-copied-v1", model.bindingIrSha256, report.runtimeIdentity);
	const runtime = report.archives.find(item => item.role === "runtime"), component = report.archives.find(item => item.role === "component");
	return writePackageSetReceipt({ root
		, component: model.component
		, source: { treeSha256: model.sourceIdentity.sourceTreeSha256 }
		, profiles: [abi], signal
		, packages: report.archives.map(item => pkg("php-wasm", item.ecosystem, item, abi, item.role, item.role === "runtime" ? "provided" : "dependency"
			, item.role === "runtime" ? [] : [ref(runtime), ...(item.role === "api" ? [ref(component)] : [])], [artifact("packages/php-wasm/archives", item)])) });
};

/**
 * Combine verified single-profile receipts with release-relative archive paths.
 *
 * @param options - Combined release staging, child paths and common source identity.
 */
export const writeCombinedPackageSet = async options => {
	const { root, roots, component, source, signal } = options;
	const profiles = [], packages = [];
	for(const prefix of roots)
	{
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(root, prefix, packageSetReceiptName), signal });
		if(["id", "name", "version"].some(key => receipt.component[key] !== component[key]) || receipt.source.treeSha256 !== source.treeSha256) throw new Error("Package sets disagree on component or captured source");
		profiles.push(...receipt.profiles);
		packages.push(...receipt.packages.map(item => ({ ...item, artifacts: item.artifacts.map(file => ({ ...file, path: `${prefix}/${file.path}` })) })));
	}
	return writePackageSetReceipt({ root, component, source, profiles, packages, signal });
};
