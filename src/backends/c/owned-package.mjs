/**
 * Generate public C views and executable ownership-aware calls. Package-builder
 * admission and installed receipts remain separate from this projection stage.
 *
 * @file
 */
import { generateOwnedNativeValueAdapters } from "../native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../native/owned-aggregate-leases.mjs";
import { ownedAggregateTransferLeaseSource, ownedAggregateTransferRuntime } from "../native/owned-aggregate-transfers.mjs";
import { generateOwnedCValues } from "./owned-values.mjs";
import { ownedCRuntime, ownedCBorrowRuntime } from "./owned-runtime.mjs";
import { ownedCCallbacks } from "./owned-callbacks.mjs";
import { ownedCInputTransfers } from "./owned-transfers.mjs";

/**
 * Project checked native values into semantic C records, constructors, spans,
 * GMP integers and opaque identities. All returned storage belongs to one result
 * owner; every failure leaves both output slots unchanged and releases partial
 * conversion storage and resource leases. Host callback construction requires
 * the explicit capability recorded in the authenticated native component model.
 *
 * @param options - Authenticated fresh compiler metadata and component identity.
 * @param backend - Internal transport implementation over the same native layout.
 */
export const generateOwnedCPackage = (options, backend = null) => {
	const generated = generateOwnedNativeValueAdapters(options);
	const hasTransfers = generated.layout.functions.some(item => item.transfers?.length);
	const hasExportAnchors = generated.layout.functions.some(item => item.anchor !== undefined);
	const hasCallbackAnchors = generated.layout.callbacks.some(item => item.anchor !== undefined);
	const hasAnchors = hasExportAnchors || hasCallbackAnchors;
	if(backend && generated.layout.functions.some(item => item.receiver === 0) && backend.receiverExports !== true)
		throw new TypeError("Owned C transport does not support receiver exports");
	if(backend && hasTransfers && backend.transferredInputs !== true) throw new TypeError("Owned C transport does not support transferred inputs");
	if(backend && hasExportAnchors && backend.anchoredResults !== true) throw new TypeError("Owned C transport does not support anchored results");
	if(backend && hasCallbackAnchors && backend.callbackResultAnchors !== true) throw new TypeError("Owned C transport does not support callback result anchors");
	const publicPrefix = backend ? backend.publicPrefix(generated.layout.model.bindingIr, {
		transferredInputs: options.transferredInputs
		, anchoredResults: options.anchoredResults
		, receiverExports: options.receiverExports
		, callbackResultAnchors: options.callbackResultAnchors
	}) : options.publicPrefix;
	const values = generateOwnedCValues(generated.layout.model.bindingIr, {
		hostCallbacks: options.hostCallbacks
		, publicPrefix
		, transferredInputs: options.transferredInputs
		, anchoredResults: options.anchoredResults
		, receiverExports: options.receiverExports
		, callbackResultAnchors: options.callbackResultAnchors
		, identityEquality: options.identityEquality
	});
	const p = values.prefix;
	const transport = backend?.render({ generated, values });
	const nodes = new Map(values.nodes.map(node => [node.id, node]));
	const walker = node => `oc_v${node.index}`;
	const source = [`#include "${p}.h"`, generated.source, ...transport ? [transport.source] : [], ownedCRuntime(values, generated.carriers, transport?.session)];
	if(hasAnchors) source.push(ownedCBorrowRuntime(values));
	if(hasTransfers) source.push(ownedCInputTransfers(values));
	for(const node of nodes.values()) source.push(
		`static inline int ${walker(node)}_to(${node.cName} const *, ${node.nativeName} *, size_t, oc_arena *);`
		, `static inline int ${walker(node)}_from(const ${node.nativeName} *, ${node.cName} *, size_t, oc_arena *);`
	);
	for(const node of nodes.values())
	{
		const body = into => {
			const direction = into ? "to" : "from", invalid = into ? "LB_OWNED_INVALID" : "OV_RESULT";
			const name = into ? node.cName : node.nativeName;
			const lines = [`if (!ov_pointer(value, sizeof(*value), _Alignof(${name}))) return ${invalid};`
				, `int status = ov_enter(arena->budget, value, ${node.index}, depth);`
				, "if (status) return status;", "(void)out;"];
			const field = (item, hostParent = "", rawParent = "") => {
				const child = nodes.get(item.type), hostSlot = hostParent + item.name, rawSlot = rawParent + item.nativeName;
				const input = into ? hostSlot : rawSlot, output = into ? rawSlot : hostSlot;
				return ["{"
					, ...item.pointer ? ["  void *data = NULL;"
						, `  status = oc_allocate(arena, 1, sizeof(${into ? child.nativeName : child.cName}), &data);`
						, "  if (status) return status;", `  out->${output} = data;`] : []
					, `  status = ${walker(child)}_${direction}(${item.pointer ? "" : "&"}value->${input}, ${item.pointer ? "data" : `&out->${output}`}, depth + 1, arena);`
					, "  if (status) return status;", "}"];
			};
			if(node.identity)
			{
				lines.push(`if (!${into ? "*value" : "value->token"}) return ${invalid};`);
				if(hasAnchors) lines.push("uint64_t token = 0;"
					, `status = oc_identity_${direction}(arena, ${JSON.stringify(node.identityKind)}, ${into ? "(uint64_t)(uintptr_t)*value" : "value->token"}, &token);`
					, "if (status) return status;"
					, into ? "out->token = token;" : `*out = (${node.cName})(uintptr_t)token;`);
				else lines.push(into ? "out->token = (uint64_t)(uintptr_t)*value;" : `*out = (${node.cName})(uintptr_t)value->token;`);
			}
			else if(node.integer)
			{
				if(into) lines.push("if (!ov_pointer(*value, sizeof(**value), _Alignof(__mpz_struct))) return LB_OWNED_INVALID;"
					, ...node.name === "nat" ? ["if (mpz_sgn(*value) < 0) return LB_OWNED_INVALID;"] : []
					, "if (mpz_size(*value) > arena->budget->bytes / sizeof(mp_limb_t) + 1) return LB_OWNED_LIMIT;"
					, "size_t length = mpz_sgn(*value) ? (mpz_sizeinbase(*value, 2) - 1) / 32 + 1 : 0;"
					, "void *data = NULL; status = oc_allocate(arena, length, sizeof(uint32_t), &data);"
					, "if (status) return status;"
					, "if (length) mpz_export(data, &length, -1, sizeof(uint32_t), 0, 0, *value);"
					, "out->data = data; out->length = length;"
					, ...node.name === "int" ? ["out->negative = mpz_sgn(*value) < 0;"] : []);
				else lines.push(...node.name === "int" ? ["if (value->negative > 1) return OV_RESULT;"] : []
					, `return oc_integer(arena, value->data, value->length, ${node.name === "int" ? "value->negative" : "0"}, out);`);
			}
			else if(node.kind === "primitive")
			{
				if(["string", "bytes"].includes(node.name)) lines.push(
					"status = ov_span(arena->budget, value->data, value->length, 1, 1);", "if (status) return status;"
					, ...node.name === "string" ? [`if (!ov_utf8((const uint8_t *)value->data, value->length)) return ${invalid};`] : []
					, "out->data = value->data; out->length = value->length;");
				else if(node.name === "bool") lines.push("uint8_t bits; memcpy(&bits, value, 1);"
					, `if (bits > 1) return ${invalid};`, into ? "*out = bits;" : "*out = bits != 0;");
				else lines.push(...node.name === "unit" ? [`if (*value) return ${invalid};`] : []
					, ...node.name === "char" ? [`if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return ${invalid};`] : []
					, "memcpy(out, value, sizeof(*out));");
			}
			else if(node.element)
			{
				const child = nodes.get(node.element), input = into ? child.cName : child.nativeName, output = into ? child.nativeName : child.cName;
				lines.push("if (value->length > arena->budget->visits) return LB_OWNED_LIMIT;"
					, `status = ov_span(arena->budget, value->data, value->length, sizeof(${input}), _Alignof(${input}));`
					, "if (status) return status;", "void *data = NULL;"
					, `status = oc_allocate(arena, value->length, sizeof(${output}), &data);`, "if (status) return status;"
					, `${output} *items = data; out->data = data; out->length = value->length;`
					, "for (size_t i = 0; i < value->length; ++i) {"
					, `  status = ${walker(child)}_${direction}(value->data + i, items + i, depth + 1, arena);`
					, "  if (status) return status;", "}");
			}
			else if(node.kind === "variant")
			{
				lines.push(`switch (value->${into ? "kind" : "tag"}) {`);
				node.cases.forEach((branch, index) => lines.push(`case ${into ? branch.tag : index}:`
					, `  out->${into ? "tag" : "kind"} = ${into ? index : branch.tag};`
					, ...branch.fields.flatMap(item => field(item, `cases.${branch.name}.`, `cases.${branch.nativeName}.`))
					, "  break;"));
				lines.push(`default: return ${invalid};`, "}");
			}
			else if(["option", "result"].includes(node.kind))
			{
				const option = node.kind === "option", tag = option ? "has_value" : "is_ok";
				if(into) lines.push(`uint8_t selected; memcpy(&selected, &value->${tag}, 1);`
					, "if (selected > 1) return LB_OWNED_INVALID;", `out->tag = ${option ? "selected" : "selected ? 0 : 1"};`);
				else lines.push("if (value->tag > 1) return OV_RESULT;", `out->${tag} = ${option ? "value->tag != 0" : "value->tag == 0"};`);
				node.fields.forEach((item, i) => lines.push(`if (${into ? "out" : "value"}->tag == ${option ? 1 : i}) {`, ...field(item), "}"));
			}
			else lines.push(...node.fields.flatMap(item => field(item)));
			lines.push("return LB_OWNED_OK;"); return lines;
		};
		source.push(`static inline int ${walker(node)}_to(${node.cName} const *value, ${node.nativeName} *out, size_t depth, oc_arena *arena) {`
			, ...body(true).map(line => `  ${line}`), "}"
			, `static inline int ${walker(node)}_from(const ${node.nativeName} *value, ${node.cName} *out, size_t depth, oc_arena *arena) {`
			, ...body(false).map(line => `  ${line}`), "}");
	}
	if(options.hostCallbacks) source.push(ownedCCallbacks(values, generated.carriers));
	if(hasAnchors || options.identityEquality) for(const node of values.nodes.filter(node => node.identity)) source.push(
		`${p}_status ${node.cName}_equal(${p}_session *session, ${node.cName} left, ${node.cName} right, bool *out) {`
		, `  if (!ov_pointer(out, sizeof(*out), _Alignof(bool))) return (${p}_status)LB_OWNED_INVALID;`
		, "  oc_session *active = NULL; int status = oc_session_get(session, &active);"
		, `  if (status) return (${p}_status)status;`
		, ...hasAnchors ? ["  oc_arena arena = { .session = active }; uint64_t a = 0, b = 0;"
			, `  status = oc_identity_to(&arena, ${JSON.stringify(node.identityKind)}, (uint64_t)(uintptr_t)left, &a);`
			, `  if (!status) status = oc_identity_to(&arena, ${JSON.stringify(node.identityKind)}, (uint64_t)(uintptr_t)right, &b);`]
			: ["  uint64_t a = (uint64_t)(uintptr_t)left, b = (uint64_t)(uintptr_t)right;"
				, `  if (!lb_owned_find(&active->native, ${JSON.stringify(node.identityKind)}, a) || !lb_owned_find(&active->native, ${JSON.stringify(node.identityKind)}, b)) status = LB_OWNED_INVALID;`]
		, "  if (!status) *out = a == b;", `  return (${p}_status)status;`, "}"
	);
	for(const item of [...values.retains, ...values.copies ?? []])
	{
		const node = nodes.get(item.id);
		source.push(`static inline int ${node.walker}_retain(lb_owned_context *context, const ${node.nativeName} *input, ${node.nativeName} *out, ov_result_owner *owner) {`
			, "  ov_transaction transaction = {0};"
			, `  int status = ov_begin(&transaction, context, owner, ${JSON.stringify(values.native.model.component.id)});`
			, "  if (status) return status;"
			, "  lean_object *value = NULL;"
			, `  status = ${node.walker}_in(input, 0, 1, &transaction, &value);`
			, "  if (status) return ov_abort(&transaction, status);"
			, `  status = ${node.walker}_out(out, value, 0, &transaction);`
			, "  if (status) return ov_abort(&transaction, status);"
			, "  return ov_commit(&transaction, owner);", "}");
	}
	for(const item of [...values.functions, ...values.callbacks, ...values.retains, ...values.copies ?? []])
	{
		const result = nodes.get(item.result), params = item.parameters.map(id => nodes.get(id));
		const transfers = item.transfers ?? [];
		const local = item.retain || item.copy;
		const symbol = local ? `${nodes.get(item.id).walker}_retain` : transport ? transport.symbols.get(item.id) : item.symbol;
		if(!symbol) throw new TypeError(`Missing owned transport function: ${item.id}`);
		const context = !local && transport ? "active->transport" : "&active->native";
		const borrows = options.hostCallbacks ? params.flatMap((node, i) => values.hostArgument(item, i) ? [{ node, index: i }] : []) : [];
		source.push(values.signature(item) + " {"
			, `  if (!oc_outputs(out, sizeof(*out), _Alignof(${result.cName}), owner) || *owner) return (${p}_status)LB_OWNED_INVALID;`
			, "  oc_session *active = NULL; int status = oc_session_get(session, &active);"
			, `  if (status) return (${p}_status)status;`
			, `  ov_budget budget = oc_budget(); oc_arena input = { .budget = &budget${hasAnchors ? ", .session = active" : ""} }, output = { .budget = &budget${hasAnchors ? ", .session = active" : ""} };`
			, "  oc_result *result_owner = NULL; status = oc_result_begin(active, &budget, &result_owner);"
			, `  if (status) return (${p}_status)status;`
			, ...item.anchor !== undefined ? ["  ov_input_anchor anchor = {0};"] : []
			, ...transfers.length ? [
				`  oc_transfer_input transfer_inputs[${transfers.length}] = { ${transfers.map(i => `{ .slot = a${i}_owner }`).join(", ")} };`
				, `  ov_result_owner *transfer_owners[${transfers.length}] = {0};`
				, `  oc_transfer_frame transfer_frame = { .inputs = transfer_inputs, .count = ${transfers.length} };`
				, `  ov_input_transfers transfer = { .owners = transfer_owners, .count = ${transfers.length}, .consume = oc_transfer_consume, .context = &transfer_frame };`
			] : []
			, ...params.map((node, i) => `  ${node.nativeName} raw${i} = {0};`)
			, ...borrows.map(({ node, index }) => `  oc_host_v${node.index} borrow${index} = {0};`)
			, `  ${result.nativeName} returned = {0};`, `  ${result.cName} converted = {0};`
			, "  status = ov_charge(&budget, 1, sizeof(converted));"
			, ...item.anchor !== undefined ? [`  if (!status) status = oc_anchor_prepare(active, a${item.anchor}_owner, &anchor);`] : []
			, ...transfers.length ? [
				`  if (!status) status = oc_transfer_prepare(active, &transfer_frame, transfer_owners, out, sizeof(*out), _Alignof(${result.cName}), owner);`
			] : []
			, ...params.map((node, i) => borrows.some(borrow => borrow.index === i)
				? `  if (!status) status = oc_host_v${node.index}_begin(&borrow${i}, a${i}, active, &budget, &raw${i});`
				: `  if (!status) status = ${walker(node)}_to(${node.leaf ? "&" : ""}a${i}, &raw${i}, 0, &input);`)
			, `  if (!status) status = ${symbol}(${context}, ${[...params.map((_, i) => `&raw${i}`), ...transfers.length ? ["&transfer"] : [], ...item.anchor !== undefined ? ["&anchor"] : [], "&returned", "&result_owner->native"].join(", ")});`
			, ...borrows.map(({ node, index }) => `  { int cleanup = oc_host_v${node.index}_end(&borrow${index}); if (!status) status = cleanup; }`)
			, "  if (!status) {"
			, ...hasAnchors ? [
				"    output.views = &result_owner->views;"
				, "    if (result_owner->native.batch.borrowed) output.view_batch = &result_owner->native.batch;"
			] : []
			, `    status = ${walker(result)}_from(&returned, &converted, 0, &output);`
			, "    if (status == LB_OWNED_INVALID) status = OV_RESULT;", "  }"
			, "  oc_release(input.head);"
			, ...transfers.length ? ["  status = oc_transfer_finish(&transfer_frame, status);"] : []
			, "  status = oc_result_finish(result_owner, &output, status, owner);"
			, "  if (!status) *out = converted;", `  return (${p}_status)status;`, "}");
	}
	const code = source.join("\n") + "\n";
	return { ...generated, values, publicHeader: values.header, source: code
		, files: { [`include/${p}.h`]: values.header
			, "internal/owned-values.h": generated.typesHeader
			, "internal/owned-leases.h": hasAnchors ? ownedAggregateTransferRuntime({ anchoredResults: true }) : hasTransfers ? ownedAggregateTransferLeaseSource : ownedAggregateLeaseSource
			, "internal/carriers.h": generated.carriers.header
			, [`src/${p}.c`]: code } };
};
