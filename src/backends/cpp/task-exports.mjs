/**
 * Project authenticated C task operations into C++20 values, exceptions and coroutines.
 *
 * @file
 */
const reserved = new Set(("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public reflexpr register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch synchronized template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq detail run_one shutdown").split(" "));
const scalars = {
	unit: "std::monostate", char: "char32_t", bool: "bool"
	, float32: "float", float64: "double"
	, usize: "std::size_t", isize: "std::intptr_t"
	, string: "std::string", bytes: "std::vector<std::uint8_t>"
};
for(const sign of ["int", "uint"])
	for(const bits of [8, 16, 32, 64]) scalars[`${sign}${bits}`] = `std::${sign}${bits}_t`;
const codec = t => {
	if(t?.kind === "primitive" && ["nat", "int"].includes(t.name))
	{
		const natural = t.name === "nat", type = natural ? "Nat" : "Int";
		return { type, arg: `const ${type}&`, owned: true
			, bigint: true, direct: true, natural
			, read: v => `detail::integer(${v})`, input: v => `arg_${v}.view()` };
	}
	if(t?.kind === "primitive" && Object.hasOwn(scalars, t.name))
	{
		const type = scalars[t.name], buffer = ["string", "bytes"].includes(t.name);
		const arg = t.name === "string" ? "std::string_view" : t.name === "bytes" ? "std::span<const std::uint8_t>" : type;
		return { type, arg, owned: buffer, buffer
			, input: v => buffer ? `{reinterpret_cast<const std::uint8_t *>(${v}.data()), ${v}.size()}` : t.name === "unit" ? `(static_cast<void>(${v}), 0)` : v
			, read: v => buffer ? `detail::${t.name === "string" ? "text" : "bytes"}(${v})` : t.name === "unit" ? "std::monostate{}" : `static_cast<${type}>(${v})` };
	}
	if(t?.kind !== "apply" || t.constructor !== "result" || t.arguments?.length !== 2) throw new TypeError("Unsupported C++ task carrier");
	const [ok, err] = t.arguments.map(codec), type = `Result<${ok.type}, ${err.type}>`;
	return { type, owned: ok.owned || err.owned, bigint: ok.bigint || err.bigint, read: v => `(${v}.ok ? ${type}{Ok<${ok.type}>{${ok.read(v + ".as.value")}}} : ${type}{Err<${err.type}>{${err.read(v + ".as.error")}}})` };
};
const slot = (site, local, t) => `detail::Slot<${site}> ${local}{${t.owned ? "&" + site + "_dispose" : ""}};`;

/**
 * Keep the C handles, ownership operations, buffers and effect tags out of application code.
 *
 * @param options - Declaration list and the prefix of the exact compiled C adapter.
 */
export const generateCppTaskHeader = options => {
	const { prefix: p, entries } = options, names = new Set();
	let bigint = false;
	const functions = entries.map(e => {
		const name = reserved.has(e.name) ? e.name + "_" : e.name;
		if(!/^[a-z][a-z0-9_]*$/u.test(name) || name.includes("__") || names.has(name)) throw new TypeError("Invalid or colliding C++ task name");
		names.add(name);
		const c = `${p}_${e.name}`, stream = e.delivery === "async-iterator", async = stream || e.delivery === "task";
		const args = e.parameters.map(v => codec(v.type)), item = codec(e.result);
		if(args.some(a => !a.arg)) throw new TypeError("C++ task arguments must be copied scalars");
		const unit = e.result.kind === "primitive" && e.result.name === "unit", type = unit ? "void" : item.type;
		const out = stream ? `Stream<${item.type}>` : async ? `Future<${type}>` : type;
		const er = e.effect === "EIO" ? codec(e.error) : null, step = e.stepError ? codec(e.stepError) : null, io = e.effect === "IO";
		bigint ||= [item, er, step, ...args].some(t => t?.bigint);
		const guards = args.some(a => a.direct) ? [
			"std::size_t available = 16u * 1024u * 1024u;"
			, ...args.flatMap((a, i) => a.direct ? [`const auto limbs${i} = detail::count(v${i}, ${a.natural}, available);`] : a.buffer ? [`detail::charge(available, v${i}.size());`] : [])
			, ...args.flatMap((a, i) => a.direct ? [`detail::IntegerIn arg_v${i}(v${i}, limbs${i});`] : [])
		].join("\n    ") + "\n    " : "";
		const startArgs = [...args.map((a, i) => a.input(`v${i}`)), async ? "&owner->handle" : "&value.value"];
		if(er || io) startArgs.push("&error.value");
		const startError = er ? slot(`${c}_start_error`, "error", er) : io ? `detail::Slot<${p}_buffer> error{&${p}_buffer_dispose};` : "";
		const catchStart = er ? `if (s == ${p}_TYPED_ERROR) throw StartError<${er.type}>{"${e.declaration}", ${er.read("error.value")}};`
			: io ? `if (s == ${p}_IO_ERROR) throw IOError{"${e.declaration}", detail::text(error.value)};` : "";
		const read = slot(c + "_value", "value", item);
		const take = `[owner] {
        ${read} ${step ? slot(c + "_step_error", "error", step) : ""}
        auto s = ${c}_take(&owner->handle, &value.value${step ? ", &error.value" : ""});
        ${stream ? `if (s == ${p}_END) return std::optional<${item.type}>{};` : ""}
        ${step ? `if (s == ${p}_TYPED_ERROR) throw StepError<${step.type}>{"${e.declaration}", ${step.read("error.value")}};` : ""}
        detail::check(s); return ${stream ? `std::optional<${item.type}>{${item.read("value.value")}}` : item.read("value.value")};
    }`;
		const poll = `[owner] { int fd = -1; auto s = ${c}_poll(owner->handle, &fd);
        if (s != ${p}_PENDING) detail::check(s);
        return fd; }`;
		const close = "[owner] { owner->close(); }";
		const finish = stream ? `return ${out}(std::make_shared<async_v1::detail::Cursor<${item.type}>>(loop,
        [owner] { detail::check(${c}_pull(owner->handle)); }, ${poll}, ${take}, ${close}));`
			: async ? `return async_v1::detail::future<${type}>(loop, ${poll}, ${take}, ${close});`
			: unit ? "return;" : `return ${item.read("value.value")};`;
		return `inline ${out} ${name}(${args.map((a, i) => `${a.arg} v${i}`).join(", ")}) {
    auto &loop = async_v1::detail::Loop::main(); loop.enter();
    ${guards}${async ? `auto owner = std::make_shared<detail::Owner<${c}_handle, ${c}_close>>();` : read}
    ${startError}
    auto s = ${c}_${async ? "start" : "call"}(${startArgs.join(", ")}); ${catchStart}
    detail::check(s); ${finish}
}`;
	});
	return `#ifndef ${p.toUpperCase()}_CPP_TASK_V1_HPP
#define ${p.toUpperCase()}_CPP_TASK_V1_HPP
#include "${p}.h"
#include <lean_bridge/async_v1/task-routine.hpp>
#include <span>${bigint ? `
#ifndef BOOST_MP_STANDALONE
#define BOOST_MP_STANDALONE
#endif
#include <boost/multiprecision/cpp_int.hpp>
#include <bit>
#include <iterator>
#include <limits>` : ""}
namespace lean_bridge::${p} {
${bigint ? "using Nat = boost::multiprecision::cpp_int; using Int = boost::multiprecision::cpp_int;\n" : ""}using async_v1::Future; using async_v1::Stream; using async_v1::Routine;
using async_v1::Ok; using async_v1::Err; using async_v1::Result;
using async_v1::StartError; using async_v1::StepError; using async_v1::IOError;
using async_v1::Cancelled; using async_v1::Closed; using async_v1::Busy;
using async_v1::Unavailable; using async_v1::WrongContext; using async_v1::run_one; using async_v1::shutdown;
namespace detail {${bigint ? `
inline void charge(std::size_t &available, std::size_t bytes) {
    if (bytes > available) throw std::length_error("Lean copy budget exceeded");
    available -= bytes;
}
inline std::size_t count(const Int &v, bool natural, std::size_t &available) {
    if (natural && v < 0) throw std::invalid_argument("Nat must be nonnegative");
    if (!v) return 0;
    const auto &b = v.backend(); const auto n = b.size();
    using Limb = std::remove_cvref_t<decltype(*b.limbs())>;
    static_assert(sizeof(Limb) == 4 || sizeof(Limb) == 8);
    if (n - 1 > available / sizeof(Limb)) throw std::length_error("Lean copy budget exceeded");
    auto bits = (static_cast<std::size_t>(n) - 1) * std::numeric_limits<Limb>::digits + std::bit_width(b.limbs()[n - 1]);
    auto count = (bits + 63) / 64; charge(available, count * 8); return count;
}
struct IntegerIn {
    std::vector<std::uint64_t> words; bool negative;
    IntegerIn(const Int &v, std::size_t n) : negative(v < 0) {
        words.reserve(n);
        if (n) boost::multiprecision::export_bits(v, std::back_inserter(words), 64, false);
    }
    ${p}_integer_view view() const { return {words.data(), words.size(), negative}; }
};
inline Int integer(const ${p}_integer &v) {
    Int result = 0;
    if (v.len) boost::multiprecision::import_bits(result, v.words, v.words + v.len, 64, false);
    if (v.negative) result = -result;
    return result;
}` : ""}
template<class R> struct Slot {
    void (*dispose)(R*){}; R value{};
    explicit Slot(void (*d)(R*) = nullptr) noexcept : dispose(d) {}
    Slot(const Slot&) = delete;
    ~Slot() { if (dispose) dispose(&value); }
};
template<class H, auto Drop> struct Owner {
    H handle{}; Owner() = default; Owner(const Owner&) = delete;
    void close() noexcept { if (handle.id) (void)Drop(&handle); }
    ~Owner() { close(); }
};
inline std::string text(const ${p}_buffer &b) {
    return b.len ? std::string(reinterpret_cast<const char *>(b.data), b.len) : std::string{};
}
inline std::vector<std::uint8_t> bytes(const ${p}_buffer &b) {
    return b.len ? std::vector<std::uint8_t>(b.data, b.data + b.len) : std::vector<std::uint8_t>{};
}
inline void check(${p}_status s) {
    switch (s) {
    case ${p}_OK: return;
    case ${p}_CLOSED: throw Closed{};
    case ${p}_BUSY: throw Busy{};
    case ${p}_WRONG_CONTEXT: throw WrongContext{};
    case ${p}_UNAVAILABLE: throw Unavailable{};
    case ${p}_NO_MEMORY: throw std::bad_alloc{};
    case ${p}_LIMIT: throw std::length_error("Lean copy budget exceeded");
    case ${p}_INVALID: throw std::invalid_argument("invalid Lean argument");
    default: throw std::runtime_error("unexpected Lean task state: " + std::to_string(s));
    }
}
} // namespace detail
${functions.join("\n")}
} // namespace lean_bridge::${p}
#endif
`;
};
