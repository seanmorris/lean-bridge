/** @file Single private wasm32 entry for compiler-selected copied tasks, cursors and synchronous companions. */

export const taskFrame = Object.freeze({magic: 0x4c425431
	, handle: 24
	, out: 40
	, args: 72
	, start: 0, listen: 1, take: 2, cancel: 3, close: 4, pull: 5, clear: 6});

/**
 * Validate the complete aligned frame before touching its handle or result.
 * Component owners never pass a Lean object or a native wait descriptor to JS.
 *
 * @param symbol - Component-specific private control symbol.
 * @param wire - Authenticated C word-wire generator output.
 */
export const generateTaskControl = (symbol, wire) => {
	if(!/^lb_js_task_[0-9a-f]{64}$/u.test(symbol)) throw new TypeError("Expected component-specific Wasm task control");
	const types = {start: "const uint64_t *,uint64_t *,uint64_t *,uint8_t *"
		, take: "uint64_t *,uint64_t *,uint8_t *"
		, listen: "uint64_t *,uint32_t"
		, cancel: "uint64_t *"
		, close: "uint64_t *"
		, pull: "uint64_t *"};
	const pass = {start: "args,h,out,tags", take: "h,out,tags", listen: "h,f[4]", cancel: "h", close: "h", pull: "h"};
	const prototypes = [], cases = wire.methods.map((m,index) => {
		const size = taskFrame.args + 24*m.args.length + m.tagBytes;
		const branch = [];
		if(m.names) for(const [op, name] of Object.entries(m.names))
		{
			if(!Object.hasOwn(types,op)) throw new TypeError("Unknown Wasm task operation: " + op);
			prototypes.push(`extern int ${name}(${types[op]});`);
			branch.push(`case ${taskFrame[op]}: return ${name}(${pass[op]});`);
		}
		else
		{
			prototypes.push(`extern int ${m.symbol}(const uint64_t *,uint64_t *,uint8_t *);`);
			branch.push(`case 0: return ${m.symbol}(args,out,tags);`);
		}
		return `case ${index}: {
    if (f[1] != ${size}u) return 5;
    uint8_t *tags = (uint8_t *)(args + ${3*m.args.length});
    switch (f[3]) { ${branch.join(" ")} case ${taskFrame.clear}: ${wire.clear}(out); return 0; default: return 5; }
  }`;
	});
	return `#include <stdint.h>
extern void ${wire.clear}(uint64_t *);
${prototypes.join("\n")}
__attribute__((visibility("default"))) int ${symbol}(uint32_t *f) {
  uintptr_t base = (uintptr_t)f;
  uint64_t end = (uint64_t)__builtin_wasm_memory_size(0) * 65536;
  if (!base || base % 8 || base + UINT64_C(72) > end || f[0] != ${taskFrame.magic}u ||
      base + (uint64_t)f[1] > end || f[5] || (f[3] != ${taskFrame.listen} && f[4])) return 5;
  uint64_t *h = (uint64_t *)(f + 6), *out = h + 2, *args = out + 4;
  switch(f[2]) { ${cases.join("\n  ")} default: return 5; }
}
`;
};
