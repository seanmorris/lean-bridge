import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const ignoredDirectories = new Set([
	".git"
	, ".lake"
	, ".direnv"
	, ".toolchains"
	, ".venv"
	, "build"
	, "dist"
	, "node_modules"
	, "result"
	, "target"
	, "vendor"
]);
const declarationKinds = new Set(["def", "opaque", "abbrev", "theorem", "structure", "inductive", "class"]);
const exportableDeclarationKinds = new Set(["def", "opaque", "abbrev"]);
const relevantProjectFiles = new Set([
	"flake.lock"
	, "flake.nix"
	, "lake-manifest.json"
	, "lakefile.lean"
	, "lakefile.toml"
	, "lean-toolchain"
	, "package-lock.json"
	, "package.json"
]);

/**
 * Reports Lean project analysis failures with stable machine-readable codes and structured diagnostic context.
 */
export class LeanProjectAnalysisError extends Error
{
	/**
   * Initializes the error used to report Lean project analysis failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "LeanProjectAnalysisError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new LeanProjectAnalysisError(code, message, details);
};

const sourceFiles = async (root, { signal = undefined } = {}) => {
	const files = [];
	const visit = async directory => {
		signal?.throwIfAborted();
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for(const entry of entries)
		{
			signal?.throwIfAborted();
			if(entry.isDirectory() && (ignoredDirectories.has(entry.name) || entry.name.startsWith(".lean-bridge-"))) continue;
			const absolute = join(directory, entry.name);
			if(entry.isDirectory()) await visit(absolute);
			if(entry.isFile()) files.push(absolute);
		}
	};
	await visit(root);
	return files.sort();
};

const compiledEnvironment = async (root, { signal = undefined } = {}) => {
	const metadataRoot = join(root, ".lake", "build", "lib", "lean");
	const paths = [];
	const visit = async directory => {
		signal?.throwIfAborted();
		let entries;
		try
		{
			entries = await readdir(directory, { withFileTypes: true });
		} catch(error)
		{
			if(error.code === "ENOENT") return;
			throw error;
		}
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for(const entry of entries)
		{
			signal?.throwIfAborted();
			const absolute = join(directory, entry.name);
			if(entry.isDirectory()) await visit(absolute);
			if(entry.isFile() && entry.name.endsWith(".ilean")) paths.push(absolute);
		}
	};
	await visit(metadataRoot);
	const modules = [];
	for(const absolute of paths.sort())
	{
		signal?.throwIfAborted();
		let document;
		try
		{
			document = JSON.parse(await readFile(absolute, "utf8"));
		} catch
		{
			continue;
		}
		if(typeof document.module !== "string" || document.decls === null || typeof document.decls !== "object") continue;
		const bytes = await readFile(absolute);
		modules.push({
			module: document.module
			, declarations: Object.keys(document.decls).sort()
			, directImports: Array.isArray(document.directImports)
				? document.directImports.map(item => Array.isArray(item) ? item[0] : item).filter(item => typeof item === "string").sort()
				: []
			, sha256: sha256(bytes)
		});
	}
	return {
		status: modules.length === 0 ? "absent" : "available"
		, format: "Lean ilean"
		, modules
		, note: modules.length === 0
			? "No Lake interface metadata was present; source inference remains provisional until build."
			: "Interface metadata establishes compiled declaration presence, but the build gate must still reject stale metadata."
	};
};

const textIfPresent = async path => {
	try
	{
		return await readFile(path, "utf8");
	} catch(error)
	{
		if(error.code === "ENOENT") return null;
		throw error;
	}
};

const cleanDoc = value => value
  .trim()
  .replace(/^\/--?/, "")
  .replace(/-\/$/, "")
  .split("\n")
  .map(line => line.replace(/^\s*\*?\s?/, "").trimEnd())
  .join("\n")
  .trim();

const declarationName = (namespace, name) => namespace.length === 0 ? name : `${namespace.join(".")}.${name}`;
const referencesName = (signature, name) => {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[^A-Za-z0-9_'])${escaped}(?=$|[^A-Za-z0-9_'])`).test(signature);
};

const scanLeanSource = (source, path) => {
	const lines = source.split(/\r?\n/);
	const namespace = [];
	const scopes = [];
	const declarations = [];
	const imports = [];
	let pendingDoc = null;
	let pendingExtern = null;
	let inDoc = false;
	let docLines = [];

	for(let index = 0; index < lines.length; index += 1)
	{
		const line = lines[index];
		let trimmed = line.trim();
		const imported = trimmed.match(/^import\s+([A-Za-z0-9_.'-]+)/);
		if(imported) imports.push(imported[1]);

		if(inDoc)
		{
			docLines.push(line);
			if(line.includes("-/"))
			{
				pendingDoc = cleanDoc(docLines.join("\n"));
				docLines = [];
				inDoc = false;
			}
			continue;
		}
		if(trimmed.startsWith("/--"))
		{
			docLines = [line];
			if(trimmed.includes("-/"))
			{
				pendingDoc = cleanDoc(line);
				docLines = [];
			} else
			{
				inDoc = true;
			}
			continue;
		}
		const external = trimmed.match(/^@\[extern\s+"([^"]+)"\]\s*(.*)$/);
		if(external)
		{
			pendingExtern = external[1];
			trimmed = external[2].trim();
			if(trimmed === "") continue;
		}
		const openNamespace = trimmed.match(/^namespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*$/);
		if(openNamespace)
		{
			const segments = openNamespace[1].split(".");
			namespace.push(...segments);
			scopes.push({ kind: "namespace", segments: segments.length });
			continue;
		}
		if(/^section(?:\s+[A-Za-z_][A-Za-z0-9_']*)?\s*$/.test(trimmed))
		{
			scopes.push({ kind: "section", segments: 0 });
			continue;
		}
		if(/^end(?:\s+[A-Za-z_][A-Za-z0-9_.]*)?\s*$/.test(trimmed))
		{
			const scope = scopes.pop();
			if(scope?.kind === "namespace") namespace.splice(namespace.length - scope.segments, scope.segments);
			continue;
		}

		const match = trimmed.match(/^(?:(private|protected)\s+)?(?:(unsafe|partial)\s+)?(def|opaque|abbrev|theorem|structure|inductive|class)\s+([A-Za-z_][A-Za-z0-9_']*)\b/);
		if(!match || !declarationKinds.has(match[3])) continue;
		const chunks = [trimmed];
		let balance = (trimmed.match(/[({\[]/g) ?? []).length - (trimmed.match(/[)}\]]/g) ?? []).length;
		const bodyRequired = match[3] !== "opaque";
		const bodyMissing = () => bodyRequired ? !/(?:\:=|\bwhere\b)/.test(chunks.join(" ")) : !/:/.test(chunks.join(" "));
		while(
			index + 1 < lines.length
        && chunks.length < 40
        && (balance > 0 || bodyMissing())
		) {
			const next = lines[index + 1].trim();
			if(next === "" && balance <= 0) break;
			if(
				balance <= 0
        && /^(?:@\[|\/--|(?:(?:private|protected)\s+)?(?:(?:unsafe|partial)\s+)?(?:def|opaque|abbrev|theorem|structure|inductive|class)\b)/.test(next)
			) break;
			chunks.push(next);
			balance += (next.match(/[({\[]/g) ?? []).length - (next.match(/[)}\]]/g) ?? []).length;
			index += 1;
			if(balance <= 0 && /(?:\:=|\bwhere\b)/.test(next)) break;
		}
		const signature = chunks.join(" ").replace(/\s+/g, " ").trim();
		declarations.push({
			kind: match[3]
			, name: match[4]
			, fullName: declarationName(namespace, match[4])
			, visibility: match[1] ?? "public"
			, modifier: match[2] ?? null
			, documentation: pendingDoc
			, externSymbol: pendingExtern
			, signature
			, path
			, line: index - chunks.length + 2
		});
		pendingDoc = null;
		pendingExtern = null;
	}
	return { declarations, imports: [...new Set(imports)].sort() };
};

const stripOuter = value => {
	let current = value.trim();
	while(current.startsWith("(") && current.endsWith(")")) current = current.slice(1, -1).trim();
	return current;
};

const primitiveTypes = new Map([
	["Unit", "unit"], ["Bool", "bool"], ["UInt8", "uint8"], ["UInt16", "uint16"]
	, ["UInt32", "uint32"]
	, ["UInt64", "uint64"]
	, ["Int8", "int8"]
	, ["Int16", "int16"]
	, ["Int32", "int32"], ["Int64", "int64"], ["Nat", "nat"], ["Int", "int"]
	, ["Float32", "float32"]
	, ["Float", "float64"]
	, ["String", "string"]
	, ["ByteArray", "bytes"]
]);

const splitTopLevel = value => {
	const parts = [];
	let start = 0;
	let depth = 0;
	for(let index = 0; index < value.length; index += 1)
	{
		const character = value[index];
		if("([{⟨".includes(character)) depth += 1;
		if(")]}⟩".includes(character)) depth -= 1;
		if(character === " " && depth === 0)
		{
			const part = value.slice(start, index).trim();
			if(part) parts.push(part);
			start = index + 1;
		}
	}
	const last = value.slice(start).trim();
	if(last) parts.push(last);
	return parts;
};

const typeRef = source => {
	const value = stripOuter(source.replace(/\s+/g, " "));
	if(primitiveTypes.has(value)) return { kind: "primitive", name: primitiveTypes.get(value) };
	const parts = splitTopLevel(value);
	if(parts[0] === "Array" && parts.length === 2)
	{
		const item = typeRef(parts[1]);
		return item === null ? null : { kind: "apply", constructor: "array", arguments: [item] };
	}
	if(parts[0] === "Option" && parts.length === 2)
	{
		const item = typeRef(parts[1]);
		return item === null ? null : { kind: "apply", constructor: "option", arguments: [item] };
	}
	if(parts[0] === "Except" && parts.length === 3)
	{
		const error = typeRef(parts[1]);
		const result = typeRef(parts[2]);
		return error === null || result === null ? null : { kind: "apply", constructor: "result", arguments: [error, result] };
	}
	return null;
};

const functionShape = declaration => {
	if(!exportableDeclarationKinds.has(declaration.kind)) return null;
	const prefix = declaration.signature.slice(declaration.signature.indexOf(declaration.name) + declaration.name.length);
	const stop = prefix.search(/\:=|\bwhere\b/);
	const header = (stop === -1 ? prefix : prefix.slice(0, stop)).trim();
	if(/[{\[]/.test(header)) return { blocker: "implicit-or-instance-parameter" };
	const parameters = [];
	const group = /\(([^()]*)\)/g;
	let matched;
	let lastEnd = 0;
	while((matched = group.exec(header)) !== null)
	{
		lastEnd = matched.index + matched[0].length;
		const colon = matched[1].lastIndexOf(":");
		if(colon === -1) return { blocker: "untyped-parameter" };
		const names = matched[1].slice(0, colon).trim().split(/\s+/).filter(Boolean);
		const leanType = matched[1].slice(colon + 1).trim();
		const projected = typeRef(leanType);
		if(names.length === 0 || projected === null) return { blocker: "unsupported-parameter-type", leanType };
		for(const name of names) parameters.push({ name, leanType, type: projected });
	}
	const tail = header.slice(lastEnd).trim();
	const resultMatch = tail.match(/^:\s*(.+)$/);
	if(!resultMatch) return { blocker: "result-type-absent" };
	const resultType = resultMatch[1].trim();
	const effect = splitTopLevel(resultType);
	if(effect[0] === "EIO") return { blocker: "effect-adapter-required", leanType: resultType };
	if(new Set(["IO", "Task"]).has(effect[0]))
	{
		if(effect.length !== 2) return { blocker: "effect-adapter-required", leanType: resultType };
		const result = typeRef(effect[1]);
		if(result === null) return { blocker: "unsupported-result-type", leanType: effect[1] };
		return {
			parameters
			, resultType: effect[1]
			, result
			, resultMode: "promise"
			, effects: ["async"]
			, leanEffect: effect[0]
		};
	}
	if(/→|->/.test(resultType)) return { blocker: "callable-projection-required", leanType: resultType };
	const result = typeRef(resultType);
	if(result === null) return { blocker: "unsupported-result-type", leanType: resultType };
	return { parameters, resultType, result, resultMode: "value", effects: [], leanEffect: null };
};

const packageFacts = async root => {
	const [lakeToml, lakeLean, toolchain, packageJson] = await Promise.all([
		textIfPresent(join(root, "lakefile.toml"))
		, textIfPresent(join(root, "lakefile.lean"))
		, textIfPresent(join(root, "lean-toolchain"))
		, textIfPresent(join(root, "package.json"))
	]);
	const tomlName = lakeToml?.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
	const leanName = lakeLean?.match(/package\s+([A-Za-z_][A-Za-z0-9_-]*)/m)?.[1];
	let npm;
	try
	{ npm = packageJson === null ? null : JSON.parse(packageJson); } catch
	{ npm = null; }
	const rawName = tomlName ?? leanName ?? npm?.name ?? basename(root);
	const name = rawName.replace(/^@/, "").replace(/[^A-Za-z0-9_-]+/g, "-");
	const version = lakeToml?.match(/^version\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)"/m)?.[1]
    ?? (typeof npm?.version === "string" && /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(npm.version) ? npm.version : "0.0.0-local");
	const toolchainValue = toolchain?.trim() || "unknown";
	const toolVersion = toolchainValue.match(/v?([0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?)/)?.[1] ?? "unknown";
	return { name, version, toolchain: toolchainValue, toolVersion, lakefile: lakeToml !== null ? "lakefile.toml" : lakeLean !== null ? "lakefile.lean" : null };
};

const sourceSite = declaration => ({
	producer: "lean"
	, declaration: declaration.fullName
	, extensions: {
		"lean-lang.org/inferred-export": declaration.shape.leanEffect === null ? "pure-function" : "async-function",
		...(declaration.shape.leanEffect === null ? {} : { "lean-lang.org/effect": declaration.shape.leanEffect })
	}
});

const proposedIr = ({ facts, exports, theorems }) => {
	const capability = {
		id: "capability:shared-runtime"
		, category: "runtime"
		, requirement: "required"
		, documentation: {
			summary: "The component uses the application shared runtime."
			, details: "Generated packages must not embed a private Lean runtime."
		}
	};
	const assurance = exports.map(item => {
    const linked = theorems.filter(theorem => referencesName(theorem.signature, item.fullName) || referencesName(theorem.signature, item.name));
    return {
      id: `assurance:${item.fullName}.analysis`
      , state: "unverified"
      , subject: `lean:${item.fullName}`
      , claim: linked.length > 0
        ? "The analyzer found theorem declarations that reference this function; it did not check their meaning or build status."
        : "The analyzer found no theorem relationship for this function."
      , theorems: linked.map(theorem => theorem.fullName)
      , assumptions: ["Static source analysis does not replace Lean elaboration or proof checking."]
      , source: {
        producer: "bridge"
        , declaration: `analysis:${item.fullName}`
        , extensions: {}
      }
    };
	});
	const declarations = exports.map((item, index) => ({
		id: `lean:${item.fullName}`
		, name: item.name
		, kind: "function"
		, owner: null
		, overloadKey: `${item.name}(${item.shape.parameters.map(parameter => parameter.leanType).join(",")})`
		, typeParameters: []
		, receiver: null
		, parameters: item.shape.parameters.map(parameter => ({
			name: parameter.name
			, type: parameter.type
			, ownership: "copy"
			, lifetime: null
			, mutability: "immutable"
			, optional: false
			, default: null
		}))
		, result: { type: item.shape.result, ownership: "copy", lifetime: null }
		, mutability: "immutable"
		, effects: item.shape.effects
		, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: item.shape.resultMode
		, capabilities: [capability.id]
		, assurance: [assurance[index].id]
		, documentation: {
			summary: item.documentation?.split("\n")[0] || `Undocumented Lean declaration ${item.fullName}.`
			, details: item.documentation?.split("\n").slice(1).join("\n") ?? ""
		}
		, source: sourceSite(item)
	}));
	const idName = facts.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "lean-project";
	const ir = {
		schemaVersion: 3
		, component: { id: `${idName}@${facts.version}`, name: facts.name, version: facts.version }
		, producers: [
			{
				id: "lean", adapter: "lean4-static-analysis", adapterVersion: 1
				, tool: "Lean", toolVersion: facts.toolVersion
				, extensions: { "lean-lang.org/toolchain": facts.toolchain }
			}
			, {
				id: "bridge", adapter: "lean-bridge-analyzer", adapterVersion: 1
				, tool: "Lean Bridge", toolVersion: "0.0.0-poc", extensions: {}
			}
		]
		, types: []
		, declarations
		, errors: []
		, capabilities: [capability]
		, assurance
		, documentation: {
			summary: `Statically inferred binding contract for ${facts.name}.`
			, details: "Lean elaboration and generated ABI validation remain required before build."
		}
	};
	validateBindingIr(ir);
	return ir;
};

/**
 * Inventories a Lean project, correlates source declarations with compiled exports, and emits diagnostics plus a proposed Binding IR.
 *
 * @param projectRoot - Lean project root inspected without modifying its source or build outputs.
 * @param root0 - Optional controls for the project scan.
 * @param root0.signal - Abort signal checked throughout filesystem and environment analysis.
 */
export const analyzeLeanProject = async (projectRoot, { signal = undefined } = {}) => {
	const root = resolve(projectRoot);
	signal?.throwIfAborted();
	let files;
	try
	{
		files = await sourceFiles(root, { signal });
	} catch(error)
	{
		if(error.code === "ENOENT") fail("project-absent", `Lean project does not exist: ${root}`);
		throw error;
	}
	const relevant = files.filter(path =>
		path.endsWith(".lean")
    || path.endsWith(".binding-ir.json")
    || relevantProjectFiles.has(basename(path))
	);
	const inputs = [];
	for(const absolute of relevant)
	{
		signal?.throwIfAborted();
		const bytes = await readFile(absolute);
		inputs.push({ path: relative(root, absolute).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256(bytes) });
	}
	inputs.sort((left, right) => left.path.localeCompare(right.path));
	const treeSha256 = sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join(""));
	const [facts, environment] = await Promise.all([packageFacts(root), compiledEnvironment(root, { signal })]);
	signal?.throwIfAborted();
	const compiledDeclarations = new Set(environment.modules.flatMap(module => module.declarations));
	const declarations = [];
	const imports = [];
	for(const input of inputs.filter(item => item.path.endsWith(".lean")))
	{
		signal?.throwIfAborted();
		const scanned = scanLeanSource(await readFile(join(root, input.path), "utf8"), input.path);
		declarations.push(...scanned.declarations);
		imports.push(...scanned.imports.map(module => ({ module, source: input.path })));
	}
	declarations.sort((left, right) => left.fullName.localeCompare(right.fullName) || left.path.localeCompare(right.path));
	const theorems = declarations.filter(item => item.kind === "theorem");
	const diagnostics = [];
	const adapterHints = [];
	const candidates = [];
	const preliminaryShapes = new Map();
	const projectedNameCounts = new Map();
	for(const declaration of declarations.filter(item => exportableDeclarationKinds.has(item.kind)))
	{
		const shape = functionShape(declaration);
		preliminaryShapes.set(declaration.fullName, shape);
		if(
			declaration.visibility === "public"
      && declaration.modifier === null
      && declaration.externSymbol === null
      && shape !== null
      && !shape.blocker
		) projectedNameCounts.set(declaration.name, (projectedNameCounts.get(declaration.name) ?? 0) + 1);
	}
	for(const declaration of declarations)
	{
		signal?.throwIfAborted();
		if(!exportableDeclarationKinds.has(declaration.kind)) continue;
		const reasons = [];
		let shape = null;
		if(declaration.visibility !== "public") reasons.push("not-public");
		if(declaration.modifier !== null) reasons.push(`${declaration.modifier}-declaration`);
		if(declaration.externSymbol !== null) reasons.push("foreign-contract-required");
		if(reasons.length === 0)
		{
			shape = preliminaryShapes.get(declaration.fullName);
			if(shape?.blocker) reasons.push(shape.blocker);
			if(!shape?.blocker && projectedNameCounts.get(declaration.name) > 1) reasons.push("public-name-collision");
		}
		const exportable = reasons.length === 0;
		if(declaration.documentation === null)
		{
			diagnostics.push({
				code: "documentation-missing", severity: "warning"
				, message: `${declaration.fullName} has no documentation comment`
				, path: `${declaration.path}:${declaration.line}`
				, hint: null
			});
		}
		for(const reason of reasons.filter(reason => new Set([
			"foreign-contract-required"
			, "effect-adapter-required"
			, "callable-projection-required"
			, "unsupported-parameter-type"
			, "unsupported-result-type"
			, "implicit-or-instance-parameter"
			, "public-name-collision"
		]).has(reason))) {
			adapterHints.push({
				id: `hint:${declaration.fullName}:${reason}`
				, declaration: declaration.fullName
				, reason
				, question: reason === "foreign-contract-required"
					? "Should this foreign declaration be excluded or use a reviewed ownership, failure, and runtime contract?"
					: reason === "public-name-collision"
						? "How should this namespace-qualified declaration appear in host languages?"
						: `How should Lean Bridge project ${shape?.leanType ?? "this declaration"}?`
				, choices: reason === "foreign-contract-required"
					? ["exclude", "provide-foreign-contract"]
					: reason === "public-name-collision"
						? ["qualify-with-namespace", "rename-export", "exclude"]
						: ["exclude", "provide-adapter"]
				, required: true
			});
		}
		candidates.push({
			declaration: declaration.fullName
			, kind: declaration.kind
			, path: declaration.path
			, line: declaration.line
			, documentation: declaration.documentation
			, externSymbol: declaration.externSymbol
			, confidence: exportable ? "safe-static" : "blocked"
			, status: exportable ? "exportable" : "blocked"
			, reasons
			, shape
			, theoremCandidates: theorems.filter(theorem => referencesName(theorem.signature, declaration.fullName) || referencesName(theorem.signature, declaration.name)).map(theorem => theorem.fullName)
			, evidence: [
				`source:${declaration.path}:${declaration.line}`
				, ...(compiledDeclarations.has(declaration.fullName) ? ["compiled-interface:present"] : [])
			]
		});
	}

	const existingPaths = inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	let bindingIr = null;
	if(existingPaths.length === 1)
	{
		const document = parseBindingIr(await readFile(join(root, existingPaths[0].path), "utf8"));
		bindingIr = { origin: "existing-validated", path: existingPaths[0].path, semanticSha256: hashBindingIr(document), document };
	} else if(existingPaths.length > 1)
	{
		adapterHints.push({
			id: "hint:component-selection"
			, declaration: null
			, reason: "multiple-binding-ir-documents"
			, question: "Which component should this analysis target?"
			, choices: existingPaths.map(item => item.path)
			, required: true
		});
	} else
	{
		const declarationsByName = new Map(declarations.map(item => [item.fullName, item]));
		const exports = candidates
      .filter(item => item.status === "exportable")
      .map(item => ({ ...declarationsByName.get(item.declaration), shape: item.shape }));
		if(exports.length > 0)
		{
			const document = proposedIr({ facts, exports, theorems });
			bindingIr = { origin: "statically-inferred", path: null, semanticSha256: hashBindingIr(document), document };
		}
	}

	if(facts.version === "0.0.0-local")
	{
		diagnostics.push({
			code: "package-version-defaulted", severity: "warning"
			, message: "No semantic package version was found; the proposed Binding IR uses 0.0.0-local"
			, path: facts.lakefile
			, hint: "Set version in lakefile.toml or package.json before release."
		});
	}
	if(bindingIr === null)
	{
		diagnostics.push({
			code: "binding-ir-unavailable", severity: "error"
			, message: "No complete safe Binding IR can be proposed from the discovered declarations"
			, path: null
			, hint: "Resolve the reported adapter hints or select an existing Binding IR."
		});
	}

	const unresolvedHints = bindingIr?.origin === "existing-validated" ? [] : adapterHints;
	const lockfiles = inputs
    .filter(input => new Set(["flake.lock", "lake-manifest.json", "package-lock.json"]).has(basename(input.path)))
    .map(input => ({ path: input.path, sha256: input.sha256 }));

	return Object.freeze({
		schemaVersion: 1
		, project: { root: ".", name: facts.name, version: facts.version, toolchain: facts.toolchain, lakefile: facts.lakefile }
		, sourceTreeSha256: treeSha256
		, inputs: Object.freeze(inputs)
		, buildGraph: {
			imports: Object.freeze(imports.sort((left, right) => left.module.localeCompare(right.module) || left.source.localeCompare(right.source)))
			, flake: inputs.some(input => input.path === "flake.nix")
			, lockfiles: Object.freeze(lockfiles)
		}
		, compiledEnvironment: environment
		, declarations: Object.freeze(declarations.map(item => ({
			name: item.fullName, kind: item.kind, path: item.path, line: item.line
			, signature: item.signature
			, documented: item.documentation !== null
			, foreign: item.externSymbol !== null
			, compiled: compiledDeclarations.has(item.fullName)
		})))
		, exportCandidates: Object.freeze(candidates)
		, proposedExports: Object.freeze(bindingIr?.document.declarations.map(item => item.id) ?? [])
		, bindingIr
		, adapterHints: Object.freeze(unresolvedHints.sort((left, right) => left.id.localeCompare(right.id)))
		, diagnostics: Object.freeze(diagnostics.sort((left, right) => left.code.localeCompare(right.code) || String(left.path).localeCompare(String(right.path))))
		, readOnly: true
	});
};
