/**
 * Inert context-report fixtures for verifier controls, never runtime evidence.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordPhpWasmContextContract, ownedCheckedRecordPhpWasmContextNode
	, ownedCheckedRecordPhpWasmContextBrowser, ownedCheckedRecordPhpWasmContextProgram
	, ownedCheckedRecordPhpWasmContextsCaller
} from "./owned-checked-record-php-wasm-contexts.mjs";

/**
 * Fabricate complete inert observations so each missing/forged cell is tested.
 *
 * @param primary - Synthetic primary component observation.
 * @param peer - Synthetic independently owned peer observation.
 * @param mode - Full or result-only primary API.
 * @param original - Source reader used to bind synthetic callers.
 */
export const syntheticOwnedCheckedRecordPhpWasmContexts = (primary, peer, mode, original) => {
	const contract = ownedCheckedRecordPhpWasmContextContract(primary.model, peer.model, mode);
	const name = primary.packageReceipt.npmSettings.name;
	const phase = () => ({ observed: { mode, phpBits: 32
		, checks: mode === "full" ? 194 : 31, rejections: mode === "full" ? 45 : 12
		, lateRejections: mode === "full" ? 30 : 0, contextIsolation: true
		, staleContextRejected: true, independentRetains: true }
	, snapshot: { runtimeState: 2, runtimeInitRuns: 1, componentInitRuns: 2, liveIdentities: 0 } });
	const execution = (arrangement, loading, peerMode, order, strict) => ({
		arrangement, loading, peerMode, order, strict, requestRecovery: true
		, libraries: ["runtime.so", "primary.so", "peer.so"]
		, initial: loading === "startup" && peerMode === "startup" ? 3
			: loading === "startup" || peerMode === "startup" ? 2 : 0
		, first: phase(), refreshed: phase() });
	const executions = [];
	for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["primary-first", "peer-first"])
	for(const strict of [0, 1]) executions.push(execution(arrangement, loading, peerMode, order, strict));
	const observations = [];
	for(const arrangement of ["embedded", "composer"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["primary-first", "peer-first"])
		observations.push({ arrangement, peerMode, order, version: "synthetic"
			, executableSha256: sha256("synthetic chromium")
			, sourceSha256: sha256(ownedCheckedRecordPhpWasmContextBrowser(contract, arrangement, peerMode, order))
			, executions: ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => ({
				...execution(arrangement, loading, peerMode, order, mode === "strict" ? 1 : 0)
				, realm: "chromium", mode }))) });
	const archives = new Map();
	for(const item of [...primary.packageReceipt.archives, ...peer.packageReceipt.archives])
		archives.set(item.archive, item);
	return { schemaVersion: 1
		, profile: "installed-owned-checked-record-php-wasm-contexts"
		, contract
		, consumerSha256: sha256(original(ownedCheckedRecordPhpWasmContextsCaller))
		, runnerSha256: sha256(ownedCheckedRecordPhpWasmContextNode(name, contract))
		, programSha256: sha256(ownedCheckedRecordPhpWasmContextProgram)
		, executions
		, browser: { observations, bundleSha256: sha256("synthetic bundle") }
		, peer, authorRemoved: true, sourceFreeInstallation: true
		, installed: { archives: [...archives.values()]
			, npmLock: { packages: Object.fromEntries(["", "node_modules/php-wasm"
				, "node_modules/@lean-bridge/php-wasm-copied-runtime"
				, `node_modules/${name}`
				, `node_modules/${peer.packageReceipt.npmSettings.name}`].map(name => [name, {}])) } } };
};
