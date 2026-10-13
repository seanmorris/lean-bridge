/**
 * Host-neutral per-step dispatch expectations, the count interposer for any component identity and a
 * strict reader for installed Fin consumers that print one counted row per public call.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/** Lean source entries counted in each row, before their adapters. */
export const nativeFinDispatchSources = Object.freeze(["mirror", "impossible", "label"]);
const arity = { mirror: 1, impossible: 1, label: 3 };

/**
 * Exported adapter symbol of one Lean declaration, as the native model derives it.
 *
 * @param componentId - Component identity, such as nativefin@1.0.0.
 * @param name - Lean declaration name.
 */
export const nativeFinAdapterSymbol = (componentId, name) => `lb_${sha256(`${componentId}\0${name}`).slice(0, 24)}`;

/**
 * Columns in row order: source mirror, impossible and label, then their adapters.
 *
 * @param componentId - Component identity whose adapters are counted.
 */
export const nativeFinDispatchSymbols = componentId => [
	...nativeFinDispatchSources.map(name => `l_NativeFin_${name}`)
	, ...nativeFinDispatchSources.map(name => nativeFinAdapterSymbol(componentId, `NativeFin.${name}`))
];

/**
 * Test-only LD_PRELOAD interposer for one component identity. Each wrapper resolves its target on first
 * use, after the host has loaded the bundled libraries globally; the runtime installer is not wrapped
 * because it runs while those libraries are still being loaded.
 *
 * @param componentId - Component identity whose adapters are counted.
 */
export const nativeFinCountInterposerFor = componentId => {
	const counted = nativeFinDispatchSymbols(componentId).map((symbol, index) => [symbol, arity[nativeFinDispatchSources[index % 3]]]);
	const wrapper = ([symbol, count], index) => {
		const parameters = Array.from({ length: count }, (_, i) => `void *a${i}`).join(", ");
		const values = Array.from({ length: count }, (_, i) => `a${i}`).join(", ");
		return `void *${symbol}(${parameters}) {
  static void *(*next)(${Array(count).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${values});
}`;
	};
	return `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
static unsigned long counts[${counted.length}];
unsigned long native_fin_dispatch_count(unsigned index) { return index < ${counted.length} ? counts[index] : 0; }
${counted.map(wrapper).join("\n")}
`;
};

const huge = 2n ** 70n;
/**
 * Per-step public calls with their outcomes and cumulative counts. Invalid calls, including every Fin 0
 * call and a late Fin argument, run before any valid call; recovery repeats both after the first entries.
 * An outcome is either the decimal or text result or the rejected parameter and its bound.
 */
export const nativeFinDispatchSteps = Object.freeze([
	["start", null, null, { ok: null }, [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-bound", "mirror", [10n], { rejected: ["arg0", "10"] }, [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-huge", "mirror", [huge], { rejected: ["arg0", "10"] }, [0, 0, 0, 0, 0, 0]]
	, ["invalid-impossible-zero", "impossible", [0n], { rejected: ["arg0", "0"] }, [0, 0, 0, 0, 0, 0]]
	, ["invalid-label-late", "label", [5n, 4n, "slot"], { rejected: ["arg1", "4"] }, [0, 0, 0, 0, 0, 0]]
	, ["valid-mirror", "mirror", [3n], { ok: "6" }, [1, 0, 0, 1, 0, 0]]
	, ["valid-label", "label", [5n, 3n, "slot"], { ok: "slot:8" }, [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-mirror", "mirror", [10n], { rejected: ["arg0", "10"] }, [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-impossible", "impossible", [0n], { rejected: ["arg0", "0"] }, [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-label", "label", [5n, 4n, "slot"], { rejected: ["arg1", "4"] }, [1, 0, 1, 1, 0, 1]]
	, ["recovery-valid-mirror", "mirror", [9n], { ok: "0" }, [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", "label", [5n, 0n, "slot"], { ok: "slot:5" }, [2, 0, 2, 2, 0, 2]]
].map(step => Object.freeze(step)));

/**
 * Exact rows a host prints, with that host's status spelling.
 *
 * @param status - Render one outcome as the host's status token.
 */
export const nativeFinDispatchExpected = status => nativeFinDispatchSteps.map(([step, , , outcome, counts]) => [step, outcome.ok === null ? "ok" : status(outcome), counts]);

const dispatchLine = /^([a-z]+(?:-[a-z]+)*) (\S+)((?: (?:0|[1-9][0-9]{0,14})){6})$/;

/**
 * Parse probe output strictly and accept only the exact ordered rows. Each row is checked against its
 * step, status and per-step count change, so a rejected call that enters Lean fails even when later
 * counts compensate.
 *
 * @param stdout - Complete standard output of one dispatch probe run.
 * @param expected - Exact rows from nativeFinDispatchExpected.
 */
export const readNativeFinDispatch = (stdout, expected) => {
	if(typeof stdout !== "string" || !stdout.endsWith("\n")) throw new TypeError("dispatch output must be newline-terminated text");
	const rows = stdout.slice(0, -1).split("\n").map((line, index) => {
		const match = dispatchLine.exec(line);
		if(!match) throw new TypeError(`dispatch line ${index + 1} is malformed: ${JSON.stringify(line)}`);
		return [match[1], match[2], match[3].slice(1).split(" ").map(Number)];
	});
	const steps = rows.map(([step]) => step).join(",");
	if(steps !== expected.map(([step]) => step).join(",")) throw new TypeError(`dispatch steps differ: ${steps}`);
	const zero = expected[0][2].map(() => 0);
	rows.forEach(([step, status, counts], index) => {
		const [, expectedStatus, expectedCounts] = expected[index];
		const previous = index ? rows[index - 1][2] : zero, expectedPrevious = index ? expected[index - 1][2] : zero;
		const change = counts.map((value, column) => value - previous[column]);
		const expectedChange = expectedCounts.map((value, column) => value - expectedPrevious[column]);
		if(status !== expectedStatus) throw new TypeError(`${step} reported ${status} instead of ${expectedStatus}`);
		if(counts[1] !== 0 || counts[4] !== 0) throw new TypeError(`${step}: Fin 0 entered its source or adapter`);
		if(nativeFinDispatchSteps[index][3].rejected && change.some(Boolean)) throw new TypeError(`${step} was rejected but changed counts by ${change.join(" ")}`);
		if(change.some((value, column) => value !== expectedChange[column])) throw new TypeError(`${step} changed counts by ${change.join(" ")} instead of ${expectedChange.join(" ")}`);
	});
	return rows;
};

/**
 * Probe outputs the reader must refuse, derived from the exact expected rows.
 *
 * @param expected - Exact rows from nativeFinDispatchExpected.
 */
export const nativeFinDispatchMutations = expected => {
	const render = rows => rows.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join("");
	const copy = () => structuredClone(expected), at = step => expected.findIndex(([name]) => name === step);
	const shift = (rows, from, column, by) => {
		for(const row of rows.slice(from)) row[2][column] += by;
		return rows;
	};
	const swap = (rows, a, b) => {
		[rows[a], rows[b]] = [rows[b], rows[a]];
		return rows;
	};
	const status = (step, value) => {
		const rows = copy();
		rows[at(step)][1] = value;
		return render(rows);
	};
	const statusOf = step => expected[at(step)][1], first = render(expected).split("\n")[0];
	const mutations = {
		"missing row": render(expected.filter(([step]) => step !== "recovery-invalid-label"))
		, "missing final row": render(expected.slice(0, -1))
		, "missing start row": render(expected.slice(1))
		, "duplicated row": render([...expected, expected.at(-1)])
		, "reordered rejections": render(swap(copy(), at("invalid-mirror-bound"), at("invalid-mirror-huge")))
		, "reordered valid steps": render(swap(copy(), at("valid-mirror"), at("valid-label")))
		, "reordered recovery": render(swap(copy(), at("recovery-invalid-mirror"), at("recovery-valid-mirror")))
		, "all-zero valid counters": render(expected.map(([step, value, counts]) => [step, value, counts.map(() => 0)]))
		, "nonzero start": render(shift(copy(), 0, 3, 1))
		, "valid source without adapter": render(shift(copy(), at("valid-mirror"), 3, -1))
		, "valid adapter without source": render(shift(copy(), at("valid-label"), 2, -1))
		, "valid call entering twice": render(shift(copy(), at("recovery-valid-label"), 2, 1))
		, "Fin 0 source entered by a later valid step": render(shift(copy(), at("valid-mirror"), 1, 1))
		, "Fin 0 adapter entered by a rejection": render(shift(copy(), at("invalid-impossible-zero"), 4, 1))
		, "altered valid result": status("valid-mirror", statusOf("recovery-valid-mirror"))
		, "altered label result": status("valid-label", statusOf("recovery-valid-label"))
		, "altered rejection bound": status("invalid-mirror-bound", statusOf("invalid-impossible-zero"))
		, "altered rejection parameter": status("invalid-label-late", statusOf("invalid-mirror-bound"))
		, "unrecognized failure": status("invalid-impossible-zero", "error")
		, "rejection reported as success": status("recovery-invalid-mirror", statusOf("valid-mirror"))
		, "success reported as rejection": status("recovery-valid-mirror", statusOf("recovery-invalid-mirror"))
		, "compensated totals": render(shift(shift(copy(), at("invalid-mirror-bound"), 0, 1), at("valid-mirror"), 0, -1))
		, "compensated recovery totals": render(shift(shift(copy(), at("recovery-invalid-label"), 5, 1), at("recovery-valid-label"), 5, -1))
		, "empty output": ""
		, "missing final newline": render(expected).slice(0, -1)
		, "trailing blank line": `${render(expected)}\n`
		, "carriage returns": render(expected).replaceAll("\n", "\r\n")
		, "tab separator": render(expected).replace("start ok", "start\tok")
		, "double space": render(expected).replace("start ok", "start  ok")
		, "five columns": render(expected).replace(first, "start ok 0 0 0 0 0")
		, "seven columns": render(expected).replace(first, "start ok 0 0 0 0 0 0 0")
		, "leading zero": render(expected).replace(first, "start ok 00 0 0 0 0 0")
		, "negative count": render(expected).replace(first, "start ok -0 0 0 0 0 0")
		, "trailing text": render(expected).replace(first, "start ok 0 0 0 0 0 0 extra")
		, "uppercase step": render(expected).replace("start ok", "Start ok")
		, "trailing diagnostic line": `${render(expected)}warning ok 0 0 0 0 0 0\n`
	};
	for(let column = 0; column < 6; column++)
		for(const [index, [step]] of nativeFinDispatchSteps.entries())
			if(nativeFinDispatchSteps[index][3].rejected) mutations[`${step} entering column ${column}`] = render(shift(copy(), at(step), column, 1));
	return { valid: render(expected), mutations };
};
