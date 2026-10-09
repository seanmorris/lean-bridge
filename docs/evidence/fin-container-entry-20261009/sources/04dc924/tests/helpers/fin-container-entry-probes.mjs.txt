/**
 * Public FinContainers entry probes for the six reviewed container hosts (VO #1438): native PHP and WIT/WASI
 * under an LD_PRELOAD interposer, Ruby and .NET under strict-root GDB breakpoints and Java and Kotlin under
 * extracted-root GDB breakpoints. Each host calls only its own installed public API. A separate C probe
 * then calls the raw adapters of the same verified installed libraries; its rows are recorded as that C
 * caller's, never as the host's.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { assertFinContainerGdbRun, finContainerDefiners, finContainerGdbCommand, finContainerGdbExit, finContainerGdbRecord, finContainerGdbScript, observeFinContainerGdbDispatch, readFinContainerGdbRecord } from "./fin-container-dispatch-gdb.mjs";
import { assertExtractedFinContainerGdbRun, finContainerGdbExtractedScript, observeExtractedFinContainerDispatch } from "./fin-container-dispatch-gdb-extracted.mjs";
import { finContainerEntryColumns, finContainerEntryExpected, finContainerEntryInterposer, finContainerEntryRawExpected, finContainerEntryRawMissing, finContainerEntryRawProbe, finContainerEntryReport, finContainerEntryStatus, finContainerEntrySteps, readFinContainerEntry } from "./fin-container-entry-dispatch.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/** The six host profiles this module measures. */
export const finContainerEntryProfiles = Object.freeze(["php-native", "wit-wasi", "ruby", "dotnet", "java", "kotlin"]);
export const finContainerEntryUnattached = "fin container record is not attached to this process with nothing armed\n";
export const finContainerEntryUncovered = "fin container columns are not all armed once at their verified definitions with no entries\n";
export const finContainerEntryUntriggered = "fin container load trigger countNone([]) did not return 0\n";
export const finContainerEntryMissing = "fin_container_entry_count is not resolvable in this process\n";
export const finContainerEntryLoadTrigger = "countNone([]) == 0: a public call outside the ten counted columns, after a record with nothing armed and no entries, and before a record with all ten armed and still no entries";
const R = finContainerGdbRecord;
const width = 10, entries = 296, definers = 216, breakpoints = 136;

// Host-language literals for one step's arguments; every method's parameter types are fixed.
const types = { mirrorAll: [["array", "nat"]], sumHuge: [["list", "nat"]], orDefault: [["option", "nat"]], present: [["array", ["option", "nat"]]], label: [["array", "string"], ["array", "nat"]] };
const literal = (spell, type, value) => {
	if(type === "nat") return spell.nat(value);
	if(type === "string") return spell.string(value);
	if(type[0] === "option") return value === null ? spell.none(type[1]) : spell.some(literal(spell, type[1], value.some), type[1]);
	return spell.array(value.map(item => literal(spell, type[1], item)), type[1], type[0]);
};
const typeName = (spell, type) => type === "nat" ? spell.natType : type === "string" ? spell.stringType : spell.optionType;
const callArguments = (spell, method, args) => types[method].map((type, k) => literal(spell, type, args[k])).join(", ");
const bracketed = items => `[${items.join(", ")}]`;
const spells = {
	ruby: { nat: value => `${value}`, string: JSON.stringify, none: () => "nil", some: item => `Some.new(${item})`, array: bracketed }
	, php: { nat: value => `n('${value}')`, string: value => `'${value}'`, none: () => "null", some: item => `new Some(${item})`, array: bracketed }
	, csharp: { natType: "BigInteger", stringType: "string", optionType: "Option<BigInteger>", nat: value => `N("${value}")`, string: JSON.stringify }
	, java: { natType: "BigInteger", stringType: "String", nat: value => `n("${value}")`, string: JSON.stringify }
	, kotlin: { natType: "BigInteger", stringType: "String", optionType: "Option<BigInteger>", nat: value => `n("${value}")`, string: JSON.stringify }
};
Object.assign(spells.csharp, { none: () => "Option<BigInteger>.None", some: item => `Option<BigInteger>.Some(${item})` });
Object.assign(spells.java, { none: () => "Option.<BigInteger>none()", some: item => `Option.some(${item})` });
Object.assign(spells.kotlin, { none: () => "Option.none()", some: item => `Option.some(${item})` });
spells.csharp.array = (items, type) => items.length ? `new ${typeName(spells.csharp, type)}[] { ${items.join(", ")} }` : `Array.Empty<${typeName(spells.csharp, type)}>()`;
// Java has no generic array creation; Option arrays are raw, as in the container consumer fixture.
spells.java.array = (items, type) => `new ${Array.isArray(type) ? "Option" : typeName(spells.java, type)}[]{${items.join(", ")}}`;
spells.kotlin.array = (items, type) => `arrayOf<${typeName(spells.kotlin, type)}>(${items.join(", ")})`;
const names = {
	ruby: name => name.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)
	, php: name => name.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)
	, csharp: name => `${name[0].toUpperCase()}${name.slice(1)}`
	, java: name => name, kotlin: name => name
	, wit: name => name.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)
};
const rows = (host, render) => finContainerEntrySteps.slice(1).map(([step, method, args]) => render(step, `${names[host](method)}(${callArguments(spells[host], method, args)})`));

/** PHP probe: the counter is resolved before Composer loads the package; argv[1] is the consumer root. */
export const phpFinContainerEntryProbe = () => String.raw`<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use LeanFincontainers\Some;
use LeanFincontainers\LeanBridgeError;
try {
    $counter = FFI::cdef('unsigned long fin_container_entry_count(unsigned);');
} catch (Throwable $error) {
    fwrite(STDERR, ${JSON.stringify(finContainerEntryMissing.trimEnd())} . "\n");
    exit(2);
}
if ($argc !== 2) {
    fwrite(STDERR, "usage: entry.php CONSUMER_ROOT\n");
    exit(2);
}
require $argv[1] . '/vendor/autoload.php';
function n(string $digits): BigInteger { return BigInteger::of($digits); }
function show($value): ?string {
    if ($value instanceof BigInteger) return (string)$value;
    if (is_string($value)) return preg_match('/^[!-~]*$/D', $value) === 1 ? $value : null;
    if (!is_array($value) || !array_is_list($value)) return null;
    foreach ($value as $item) if (!($item instanceof BigInteger)) return null;
    return implode(',', array_map(fn($item) => (string)$item, $value));
}
function status(callable $call): string {
    try { $result = $call(); }
    catch (LeanBridgeError $error) {
        return $error->getCode() === 1 && preg_match('/^(arg[0-9]+) is not below its Fin ([0-9]+) bound$/D', $error->getMessage(), $match) === 1
            ? 'rejected:' . $match[1] . ':' . $match[2] : 'native-error:' . $error->getCode();
    }
    catch (Throwable $error) { return 'threw:' . str_replace('\\', '.', get_class($error)); }
    $text = show($result);
    return $text === null ? 'ok:unexpected' : 'ok:' . $text;
}
function report(FFI $counter, string $step, string $status): void {
    $line = "$step $status";
    for ($index = 0; $index < ${width}; ++$index) $line .= ' ' . $counter->fin_container_entry_count($index);
    echo $line, "\n";
}
report($counter, 'start', 'ok');
${rows("php", (step, call) => `report($counter, '${step}', status(fn() => LeanFincontainers\\${call}));`).join("\n")}
`;

const limbs = value => {
	const out = [];
	for(let rest = value; rest > 0n; rest >>= 32n) out.push(Number(rest & 0xffffffffn));
	return out;
};
const witExpr = (type, value) => {
	if(type === "nat")
	{
		const parts = limbs(value);
		return parts.length ? `nat((const uint32_t[]){${parts.join(", ")}}, ${parts.length})` : "nat(NULL, 0)";
	}
	if(type === "string") return `text(${JSON.stringify(value)})`;
	if(type[0] === "option") return value === null ? "none()" : `some(${witExpr(type[1], value.some)})`;
	return value.length ? `list(${value.length}, (value[]){${value.map(item => witExpr(type[1], item)).join(", ")}})` : "list(0, NULL)";
};
const witResult = { mirrorAll: ["array", "nat"], sumHuge: "nat", orDefault: "nat", present: ["array", "nat"], label: "string" };

const witRows = () => finContainerEntrySteps.slice(1).map(([step, method, values, outcome]) => {
	const assign = types[method].map((type, k) => `args[${k}] = ${witExpr(type, values[k])};`).join(" ");
	const status = JSON.stringify(finContainerEntryStatus(outcome)), name = JSON.stringify(names.wit(method)), count = types[method].length;
	const message = outcome.rejected ? JSON.stringify(`${outcome.rejected[0]} is not below its Fin ${outcome.rejected[1]} bound`) : null;
	const call = message ? `refused(${name}, args, ${count}, ${message}, ${status})` : `accepted(${name}, args, ${count}, ${witExpr(witResult[method], outcome.ok)}, ${status})`;
	return `  { ${assign} report(${JSON.stringify(step)}, ${call}); }`;
});

/**
 * WIT/WASI C host probe over the installed component session. Each result is compared structurally with
 * its exact expected value and each refusal with its exact message, before the row is printed.
 *
 * @param prefix - The package's C prefix, such as fincontainers.
 */
export const witFinContainerEntryProbe = prefix => `#define _GNU_SOURCE
#include "${prefix}_wasmtime.h"
#include <dlfcn.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned long (*counter)(unsigned);
static ${prefix}_wasmtime *session;
static value nat(const uint32_t *parts, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = parts[i]};
  return result;
}
static value list(size_t count, const value *items) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  if (count) memcpy(result.of.list.data, items, count * sizeof(*items));
  return result;
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
static value text(const char *bytes) {
  value result = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&result.of.string, strlen(bytes), bytes);
  return result;
}
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_STRING: return a->of.string.size == b->of.string.size && !memcmp(a->of.string.data, b->of.string.data, a->of.string.size);
    case WASMTIME_COMPONENT_OPTION: return !a->of.option == !b->of.option && (!a->of.option || same(a->of.option, b->of.option));
    case WASMTIME_COMPONENT_LIST:
      if (a->of.list.size != b->of.list.size) return false;
      for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
      return true;
    default: return false;
  }
}
static void report(const char *step, const char *status) {
  printf("%s %s", step, status);
  for (unsigned i = 0; i < ${width}; ++i) printf(" %lu", counter(i));
  printf("\\n");
}
static const char *accepted(const char *name, value *args, size_t count, value expected, const char *status) {
  value result = {0};
  wasmtime_error_t *error = ${prefix}_wasmtime_call(session, name, args, count, &result);
  for (size_t i = 0; i < count; ++i) wasmtime_component_val_delete(&args[i]);
  bool exact = !error && same(&result, &expected);
  if (error) wasmtime_error_delete(error); else wasmtime_component_val_delete(&result);
  wasmtime_component_val_delete(&expected);
  return exact ? status : "ok:unexpected";
}
/* A refusal must name the parameter and bound and leave the result slot unchanged. */
static const char *refused(const char *name, value *args, size_t count, const char *message, const char *status) {
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = ${prefix}_wasmtime_call(session, name, args, count, &output);
  for (size_t i = 0; i < count; ++i) wasmtime_component_val_delete(&args[i]);
  if (!error) { wasmtime_component_val_delete(&output); return "error:accepted"; }
  wasm_name_t text; wasmtime_error_message(error, &text);
  bool exact = text.size >= strlen(message) && memmem(text.data, text.size, message, strlen(message)) != NULL;
  wasm_name_delete(&text); wasmtime_error_delete(error);
  return exact && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991 ? status : "error:refusal";
}
int main(void) {
  *(void **)&counter = dlsym(RTLD_DEFAULT, "fin_container_entry_count");
  if (!counter) { fputs(${JSON.stringify(finContainerEntryMissing)}, stderr); return 2; }
  if (${prefix}_wasmtime_open(&session)) { fputs("cannot open the installed component session\\n", stderr); return 1; }
  value args[2];
  report("start", "ok");
${witRows().join("\n")}
  ${prefix}_wasmtime_close(session);
  return 0;
}
`;

/** Ruby probe: the record must be attached and quiet before require, and all ten armed after it. */
export const rubyFinContainerEntryProbe = () => `# frozen_string_literal: true
RECORD, NONCE, CONFIG, DEFINERS = ARGV
EXPECTED = DEFINERS.to_s.split(",").map { |index| Integer(index, 10) }
LAYOUT = ${JSON.stringify(R.rubyFormat)}
def instrumentation
  bytes = begin
    ::File.binread(RECORD)
  rescue ::SystemCallError, ::TypeError
    nil
  end
  bytes && bytes.bytesize == ${R.size} ? bytes.unpack(LAYOUT) : nil
end
def ours?(record)
  record && record[0] == ${JSON.stringify(R.magic)} && record[1] == ${R.version} && record[2] == ${width} && record[3] == CONFIG && record[4] == NONCE && record[5] == ::Process.pid && record[6] == 1
end
def entries(record) = record[40, ${width}]
record = ARGV.size == 4 && EXPECTED.size == ${width} ? instrumentation : nil
unless ours?(record) && record[7].zero? && record[8].zero? && record[9].zero? && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(finContainerEntryUnattached)})
  exit 2
end
require "lean_bridge/fincontainers"
API = LeanBridge::Fincontainers
Some = API::Some
record = instrumentation
unless ours?(record) && record[7] == ${R.armed} && record[8].zero? && record[9].zero? && record[10, ${width}].all? { |count| count == 1 } && record[20, ${width}] == EXPECTED && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(finContainerEntryUncovered)})
  exit 3
end
def report(step, status)
  $stdout.write([step, status, *entries(instrumentation)].join(" ") + "\\n")
end
def show(value)
  return value.to_s if value.instance_of?(Integer)
  return value if value.instance_of?(String) && value.match?(/\\A[!-~]*\\z/)
  value.instance_of?(Array) && value.all? { |item| item.instance_of?(Integer) } ? value.join(",") : nil
end
def status
  text = show(yield)
  text ? "ok:#{text}" : "ok:unexpected"
rescue ::RangeError => error
  match = /\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\z/.match(error.message)
  match ? "rejected:#{match[1]}:#{match[2]}" : "error:RangeError"
rescue ::StandardError => error
  "error:#{error.class}"
end
report("start", "ok")
${rows("ruby", (step, call) => `report(${JSON.stringify(step)}, status { API.${call} })`).join("\n")}
`;

/** .NET probe: nothing is armed before the countNone([]) trigger and all ten are armed after it. */
export const dotnetFinContainerEntryProbe = () => `using System;
using System.Buffers.Binary;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using LeanBridge.Fincontainers;

static class Probe
{
    static string record = "", nonce = "", config = "";
    static int[] expected = Array.Empty<int>();
    static byte[]? Instrumentation()
    {
        try
        {
            var bytes = File.ReadAllBytes(record);
            return bytes.Length == ${R.size} ? bytes : null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }
    static uint Word(byte[] bytes, int offset) => BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(offset));
    static ulong[] Wide(byte[] bytes, int offset) => Enumerable.Range(0, ${width}).Select(k => BinaryPrimitives.ReadUInt64LittleEndian(bytes.AsSpan(offset + 8 * k))).ToArray();
    static ulong[] Entries(byte[] bytes) => Wide(bytes, ${entries});
    static bool Ours([NotNullWhen(true)] byte[]? bytes) => bytes is not null && Encoding.Latin1.GetString(bytes, 0, 8) == ${JSON.stringify(R.magic)}
        && Word(bytes, 8) == ${R.version} && Word(bytes, 12) == ${width} && Encoding.Latin1.GetString(bytes, 16, 64) == config && Encoding.Latin1.GetString(bytes, 80, 32) == nonce
        && BinaryPrimitives.ReadInt64LittleEndian(bytes.AsSpan(112)) == Environment.ProcessId && Word(bytes, 120) == 1;
    // Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
    static bool Quiet(byte[] bytes, uint armed) => Word(bytes, 124) == armed && Word(bytes, 128) == 0 && Word(bytes, 132) == 0 && Entries(bytes).All(count => count == 0);
    static bool Covered(byte[] bytes) => Wide(bytes, ${breakpoints}).All(count => count == 1)
        && Enumerable.Range(0, ${width}).Select(k => BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(${definers} + 4 * k))).SequenceEqual(expected);
    static int Main(string[] args)
    {
        if (args.Length == 4)
        {
            record = args[0]; nonce = args[1]; config = args[2];
            expected = args[3].Split(',').Select(index => int.TryParse(index, NumberStyles.None, CultureInfo.InvariantCulture, out var value) ? value : -1).ToArray();
        }
        var before = expected.Length == ${width} ? Instrumentation() : null;
        if (!Ours(before) || !Quiet(before, 0))
        {
            Console.Error.Write(${JSON.stringify(finContainerEntryUnattached)});
            return 2;
        }
        if (!Trigger())
        {
            Console.Error.Write(${JSON.stringify(finContainerEntryUntriggered)});
            return 4;
        }
        var after = Instrumentation();
        if (!Ours(after) || !Quiet(after, ${R.armed}) || !Covered(after))
        {
            Console.Error.Write(${JSON.stringify(finContainerEntryUncovered)});
            return 3;
        }
        Measure();
        return 0;
    }
    // The explicit load trigger: a public call that counts in no column opens the verified deployment.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static bool Trigger()
    {
        try { return Api.CountNone(Array.Empty<BigInteger>()) == BigInteger.Zero; }
        catch (Exception) { return false; }
    }
    static BigInteger N(string digits) => BigInteger.Parse(digits, NumberStyles.None, CultureInfo.InvariantCulture);
    static void Report(string step, string status)
    {
        var bytes = Instrumentation() ?? throw new InvalidOperationException("fin container record is unreadable");
        Console.Out.Write(step + " " + status + " " + string.Join(" ", Entries(bytes)) + "\\n");
    }
    static string? Show(object value) => value switch
    {
        BigInteger number => number.ToString(CultureInfo.InvariantCulture),
        string text => Regex.IsMatch(text, @"\\A[!-~]*\\z") ? text : null,
        BigInteger[] numbers => string.Join(",", numbers.Select(number => number.ToString(CultureInfo.InvariantCulture))),
        _ => null
    };
    static string Status(Func<object> call)
    {
        try { return Show(call()) is string text ? "ok:" + text : "ok:unexpected"; }
        catch (ArgumentOutOfRangeException) { return "error:ArgumentOutOfRangeException"; }
        catch (ArgumentException error)
        {
            var match = Regex.Match(error.Message, @"\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\z");
            return match.Success ? "rejected:" + match.Groups[1].Value + ":" + match.Groups[2].Value : "error:ArgumentException";
        }
        catch (Exception error) { return "error:" + error.GetType().Name; }
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Measure()
    {
        Report("start", "ok");
${rows("csharp", (step, call) => `        Report(${JSON.stringify(step)}, Status(() => Api.${call}));`).join("\n")}
    }
}
`;

/** Java probe: nothing is armed before the countNone([]) trigger, all ten after it, in one extraction root. */
export const javaFinContainerEntryProbe = () => `import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.leanbridge.fincontainers.Api;
import org.leanbridge.fincontainers.Option;

final class Probe {
    private Probe() { }
    private static final Pattern REJECTED = Pattern.compile("\\\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\\\z");
    private static final Pattern PRINTABLE = Pattern.compile("\\\\A[!-~]*\\\\z");
    private static String record = "", nonce = "", config = "";
    private static int[] expected = new int[0];
    private static ByteBuffer instrumentation() {
        try {
            byte[] bytes = Files.readAllBytes(Path.of(record));
            return bytes.length == ${R.size} ? ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) : null;
        } catch (java.io.IOException | RuntimeException error) { return null; }
    }
    private static String ascii(ByteBuffer bytes, int offset, int length) { return new String(bytes.array(), offset, length, StandardCharsets.ISO_8859_1); }
    private static long word(ByteBuffer bytes, int offset) { return Integer.toUnsignedLong(bytes.getInt(offset)); }
    private static long[] entries(ByteBuffer bytes) {
        long[] counts = new long[${width}];
        for (int k = 0; k < ${width}; k++) counts[k] = bytes.getLong(${entries} + 8 * k);
        return counts;
    }
    private static boolean ours(ByteBuffer bytes) {
        return bytes != null && ascii(bytes, 0, 8).equals(${JSON.stringify(R.magic)}) && word(bytes, 8) == ${R.version} && word(bytes, 12) == ${width}
            && ascii(bytes, 16, 64).equals(config) && ascii(bytes, 80, 32).equals(nonce)
            && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1;
    }
    // Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
    private static boolean quiet(ByteBuffer bytes, long armed) {
        if (word(bytes, 124) != armed || word(bytes, 128) != 0 || word(bytes, 132) != 0) return false;
        for (long count : entries(bytes)) if (count != 0) return false;
        return true;
    }
    private static boolean covered(ByteBuffer bytes) {
        for (int k = 0; k < ${width}; k++) if (bytes.getLong(${breakpoints} + 8 * k) != 1 || bytes.getInt(${definers} + 4 * k) != expected[k]) return false;
        return true;
    }
    private static int[] indices(String text) {
        String[] parts = text.split(",", -1);
        int[] values = new int[parts.length];
        for (int k = 0; k < parts.length; k++) values[k] = parts[k].matches("[0-9]{1,3}") ? Integer.parseInt(parts[k]) : -1;
        return values;
    }
    public static void main(String[] args) {
        if (args.length == 4) { record = args[0]; nonce = args[1]; config = args[2]; expected = indices(args[3]); }
        ByteBuffer before = expected.length == ${width} ? instrumentation() : null;
        if (!ours(before) || !quiet(before, 0)) { System.err.print(${JSON.stringify(finContainerEntryUnattached)}); System.err.flush(); System.exit(2); }
        if (!trigger()) { System.err.print(${JSON.stringify(finContainerEntryUntriggered)}); System.err.flush(); System.exit(4); }
        ByteBuffer after = instrumentation();
        if (!ours(after) || !quiet(after, ${R.armed}) || !covered(after)) { System.err.print(${JSON.stringify(finContainerEntryUncovered)}); System.err.flush(); System.exit(3); }
        measure();
        System.out.flush();
    }
    // The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
    private static boolean trigger() {
        try { return Api.countNone(new BigInteger[0]).equals(BigInteger.ZERO); }
        catch (RuntimeException error) { return false; }
    }
    private static BigInteger n(String digits) { return new BigInteger(digits); }
    private static void report(String step, String status) {
        ByteBuffer bytes = instrumentation();
        if (bytes == null) throw new IllegalStateException("fin container record is unreadable");
        StringBuilder line = new StringBuilder(step).append(' ').append(status);
        for (long count : entries(bytes)) line.append(' ').append(count);
        System.out.print(line.append('\\n'));
    }
    private static String show(Object value) {
        if (value instanceof BigInteger number) return number.toString();
        if (value instanceof String text) return PRINTABLE.matcher(text).matches() ? text : null;
        if (value instanceof BigInteger[] numbers) return Arrays.stream(numbers).map(BigInteger::toString).collect(Collectors.joining(","));
        return null;
    }
    private static String status(Supplier<Object> call) {
        try {
            String text = show(call.get());
            return text == null ? "ok:unexpected" : "ok:" + text;
        } catch (IllegalArgumentException error) {
            var match = REJECTED.matcher(String.valueOf(error.getMessage()));
            return match.matches() ? "rejected:" + match.group(1) + ":" + match.group(2) : "error:IllegalArgumentException";
        } catch (RuntimeException error) { return "error:" + error.getClass().getSimpleName(); }
    }
    // Only the raw Option[] arguments of Api.present need these; every other call is checked.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void measure() {
        report("start", "ok");
${rows("java", (step, call) => `        report(${JSON.stringify(step)}, status(() -> Api.${call}));`).join("\n")}
    }
}
`;

/** Kotlin probe: the Java probe's checks, as a separate Kotlin caller of the same public API. */
export const kotlinFinContainerEntryProbe = () => `import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess
import org.leanbridge.fincontainers.Api
import org.leanbridge.fincontainers.Option

private val rejectedPattern = Regex("(arg[0-9]+) is not below its Fin ([0-9]+) bound")
private val printablePattern = Regex("[!-~]*")
private var record = ""
private var nonce = ""
private var config = ""
private var expected = IntArray(0)

private fun instrumentation(): ByteBuffer? = try {
    val bytes = Files.readAllBytes(Path.of(record))
    if (bytes.size == ${R.size}) ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) else null
} catch (error: java.io.IOException) { null } catch (error: RuntimeException) { null }
private fun ascii(bytes: ByteBuffer, offset: Int, length: Int) = String(bytes.array(), offset, length, Charsets.ISO_8859_1)
private fun word(bytes: ByteBuffer, offset: Int) = Integer.toUnsignedLong(bytes.getInt(offset))
private fun entries(bytes: ByteBuffer) = LongArray(${width}) { bytes.getLong(${entries} + 8 * it) }
private fun ours(bytes: ByteBuffer?) = bytes != null && ascii(bytes, 0, 8) == ${JSON.stringify(R.magic)} && word(bytes, 8) == ${R.version}L && word(bytes, 12) == ${width}L
    && ascii(bytes, 16, 64) == config && ascii(bytes, 80, 32) == nonce
    && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1L
// Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
private fun quiet(bytes: ByteBuffer, armed: Long) = word(bytes, 124) == armed && word(bytes, 128) == 0L && word(bytes, 132) == 0L && entries(bytes).all { it == 0L }
private fun covered(bytes: ByteBuffer) = (0 until ${width}).all { bytes.getLong(${breakpoints} + 8 * it) == 1L && bytes.getInt(${definers} + 4 * it) == expected[it] }
private fun refuse(message: String, code: Int): Nothing {
    System.err.print(message)
    System.err.flush()
    exitProcess(code)
}

fun main(args: Array<String>) {
    if (args.size == 4) {
        record = args[0]; nonce = args[1]; config = args[2]
        expected = args[3].split(",").map { if (Regex("[0-9]{1,3}").matches(it)) it.toInt() else -1 }.toIntArray()
    }
    val before = if (expected.size == ${width}) instrumentation() else null
    if (!ours(before) || !quiet(before!!, 0L)) refuse(${JSON.stringify(finContainerEntryUnattached)}, 2)
    if (!trigger()) refuse(${JSON.stringify(finContainerEntryUntriggered)}, 4)
    val after = instrumentation()
    if (!ours(after) || !quiet(after!!, ${R.armed}L) || !covered(after)) refuse(${JSON.stringify(finContainerEntryUncovered)}, 3)
    measure()
    System.out.flush()
}

// The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
private fun trigger(): Boolean = try { Api.countNone(arrayOf<BigInteger>()) == BigInteger.ZERO } catch (error: RuntimeException) { false }
private fun n(digits: String) = BigInteger(digits)
private fun report(step: String, status: String) {
    val bytes = instrumentation() ?: throw IllegalStateException("fin container record is unreadable")
    print(step + " " + status + " " + entries(bytes).joinToString(" ") + "\\n")
}
private fun show(value: Any?): String? = when (value) {
    is BigInteger -> value.toString()
    is String -> if (printablePattern.matches(value)) value else null
    is Array<*> -> if (value.all { it is BigInteger }) value.joinToString(",") else null
    else -> null
}
private fun status(call: () -> Any?): String = try {
    show(call())?.let { "ok:" + it } ?: "ok:unexpected"
} catch (error: IllegalArgumentException) {
    val match = rejectedPattern.matchEntire(error.message ?: "")
    if (match != null) "rejected:" + match.groupValues[1] + ":" + match.groupValues[2] else "error:IllegalArgumentException"
} catch (error: RuntimeException) { "error:" + error.javaClass.simpleName }
private fun measure() {
    report("start", "ok")
${rows("kotlin", (step, call) => `    report(${JSON.stringify(step)}, status { Api.${call} })`).join("\n")}
}
`;

const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
const sharedLibrary = /\.so(?:\.[0-9]+)*$/u;
const hashDirectory = async directory => Object.fromEntries(await Promise.all((await readdir(directory)).filter(name => sharedLibrary.test(name)).sort()
	.map(async name => [name, sha256(await readFile(join(directory, name)))])));
const listings = async directory => {
	const out = {};
	for(const name of Object.keys(await hashDirectory(directory)))
		out[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(directory, name)], directory, tools)).stdout;
	return out;
};
const failed = async run => {
	try
	{ await run; }
	catch(error)
	{
		const status = /exited with status (\d+)/u.exec(error.message);
		if(!status) throw error;
		return { code: Number(status[1]), stdout: error.details.stdout, stderr: error.details.stderr };
	}
	return { code: 0 };
};

/**
 * The separate C raw-adapter observation of one verified library directory. Every column must have one
 * nm definition there; the probe links every verified library, refuses without its interposer and then
 * initializes the component and calls each adapter directly.
 *
 * @param root0 - The installed library directory and its identities.
 * @param root0.probeRoot - Task-owned directory for the probe.
 * @param root0.directory - Directory of the verified installed libraries.
 * @param root0.componentId - Actual component identity.
 * @param root0.columns - The ten verified columns.
 * @param root0.leanPrefix - Pinned Lean installation that supplies lean.h, matching the bundled runtime.
 */
export const observeFinContainerRawAdapters = async ({ probeRoot, directory, componentId, columns, leanPrefix }) => {
	const before = await hashDirectory(directory);
	const definedBy = finContainerDefiners(componentId, await listings(directory));
	const source = finContainerEntryRawProbe(componentId, columns), instrument = finContainerEntryInterposer(columns);
	await saveLakeFile(probeRoot, "raw.c", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libentry.so"], probeRoot, tools);
	// Every verified library stays linked, so each adapter resolves in the installed bytes themselves.
	const link = ["-L", directory, "-Wl,--no-as-needed", ...Object.keys(before).map(name => `-l:${name}`), `-Wl,-rpath,${directory}`, "-ldl"];
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "raw.c", ...link, "-o", "raw"], probeRoot, tools);
	const missing = await failed(runCopied(join(probeRoot, "raw"), [], probeRoot, tools));
	assert.deepEqual(missing, { code: 2, stdout: "", stderr: finContainerEntryRawMissing }, "the raw probe refuses without its interposer");
	const run = await runCopied(join(probeRoot, "raw"), [], probeRoot, { ...tools, LD_PRELOAD: join(probeRoot, "libentry.so") });
	assert.equal(run.stderr, "");
	readFinContainerEntry(run.stdout, finContainerEntryRawExpected);
	assert.deepEqual(await hashDirectory(directory), before, "the raw probe leaves the installed libraries unchanged");
	return { stdout: run.stdout, identities: { probeSha256: sha256(source), interposerSha256: sha256(instrument), definers: columns.map(column => definedBy[column]), missingInstrumentRefused: true } };
};

const ldPreloaded = async ({ probeRoot, directory, columns, componentId, compile, argv, cwd, env }) => {
	const definedBy = finContainerDefiners(componentId, await listings(directory));
	const instrument = finContainerEntryInterposer(columns);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-o", "libentry.so"], probeRoot, tools);
	assert.match((await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(probeRoot, "libentry.so")], probeRoot, tools)).stdout, /^[0-9a-f]+ T fin_container_entry_count$/mu);
	await compile();
	const missing = await failed(runCopied(argv[0], argv.slice(1), cwd, env));
	assert.equal(missing.code, 2, "the public probe refuses without its interposer"); assert.equal(missing.stdout, "");
	assert.match(missing.stderr, /^fin_container_entry_count is not resolvable in this process\n$/u);
	const run = await runCopied(argv[0], argv.slice(1), cwd, { ...env, LD_PRELOAD: join(probeRoot, "libentry.so") });
	assert.equal(run.stderr, "");
	readFinContainerEntry(run.stdout, finContainerEntryExpected);
	return { stdout: run.stdout, instrument: "LD_PRELOAD", identities: { interposerSha256: sha256(instrument), definers: columns.map(column => definedBy[column]), missingInstrumentRefused: true } };
};

const gdbVersion = async cwd => ({ version: (await runCopied(finContainerGdbCommand, ["--version"], cwd, tools)).stdout.split("\n")[0], sha256: sha256(await readFile(await realpath(finContainerGdbCommand))) });
const refused = (run, code, stderr) => {
	assert.equal(run.code, code, run.output);
	assert.equal(run.stdout ?? "", "");
	if(stderr !== null) assert.equal(run.stderr, stderr);
};

/**
 * Strict-root GDB public observation with its refusal controls: no GDB, a planted record, a foreign root
 * and misplaced definers each refuse before any row.
 *
 * @param root0 - Verified library directory and the host probe command.
 * @param root0.probeRoot - Task-owned directory.
 * @param root0.directory - Verified installed library directory the host loads.
 * @param root0.componentId - Actual component identity.
 * @param root0.argv - Probe command from the record arguments.
 * @param root0.cwd - Working directory.
 * @param root0.env - Clean environment that finds the installed package.
 */
const strictGdb = async ({ probeRoot, directory, componentId, argv, cwd, env }) => {
	assert.ok(existsSync(finContainerGdbCommand), `GDB is required at ${finContainerGdbCommand}; set LEAN_BRIDGE_GDB, and ptrace must be permitted`);
	const command = ({ record, nonce, configSha256, definerIndices }) => [...argv, record, nonce, configSha256, definerIndices.join(",")];
	const observer = await observeFinContainerGdbDispatch({ probeRoot: join(probeRoot, "gdb"), nativeDirectory: directory, componentId, argv: command, cwd, env });
	const missing = await observer.run({ gdb: false });
	refused(missing, 2, finContainerEntryUnattached); assert.equal(existsSync(missing.record), false);
	refused(await observer.run({ before: record => writeFile(record, "stale") }), finContainerGdbExit.refusedRecord, null);
	refused(await observer.run({ root: probeRoot }), 3, finContainerEntryUncovered);
	// Each column configured in a library that does not define it is foreign and never armed.
	const names = observer.identity.libraries;
	assert.ok(names.length > 1, "a misplaced-definer control needs a second verified library");
	const misplaced = Object.fromEntries(observer.identity.columns.map((column, k) => [column, names.find(name => name !== observer.identity.definers[k])]));
	const wrong = await observeFinContainerGdbDispatch({ probeRoot: join(probeRoot, "misplaced"), nativeDirectory: directory, componentId, argv: command, cwd, env, definers: misplaced });
	const misarmed = await wrong.run();
	refused(misarmed, 3, finContainerEntryUncovered);
	assert.deepEqual([readFinContainerGdbRecord(await readFile(misarmed.record)).armed, readFinContainerGdbRecord(await readFile(misarmed.record)).foreign], [0, width]);
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, `instrumented probe failed (2 unattached, 3 uncovered, 4 trigger failed, 70 stale record, 71 instrumentation, 72 signal): ${accepted.output}`);
	assert.equal(accepted.stderr, "");
	const observed = readFinContainerEntry(accepted.stdout, finContainerEntryExpected);
	const armed = await assertFinContainerGdbRun(observer, accepted, observed);
	const identities = {
		scriptSha256: sha256(finContainerGdbScript)
		, configSha256: observer.configSha256
		, definers: observer.identity.definers
		, breakpoints: armed
		, gdb: await gdbVersion(cwd)
		, missingInstrumentRefused: true
		, staleRecordRefused: true
		, foreignRootRefused: true
		, misplacedDefinersRefused: true
	};
	return { stdout: accepted.stdout, instrument: "gdb-breakpoints", identities };
};

/**
 * Extracted-root GDB public observation with its refusal controls: no GDB, a planted parent, a temporary
 * directory outside the run's parent and preloaded copies of the verified libraries.
 *
 * @param root0 - Verified resource directory and the JVM probe command.
 * @param root0.probeRoot - Task-owned directory.
 * @param root0.directory - The JAR's verified native resources, extracted by the test.
 * @param root0.componentId - Actual component identity.
 * @param root0.argv - Probe command from the record arguments and the temporary directory.
 * @param root0.cwd - Working directory.
 * @param root0.env - Clean environment.
 */
const extractedGdb = async ({ probeRoot, directory, componentId, argv, cwd, env }) => {
	assert.ok(existsSync(finContainerGdbCommand), `GDB is required at ${finContainerGdbCommand}; set LEAN_BRIDGE_GDB, and ptrace must be permitted`);
	const observer = await observeExtractedFinContainerDispatch({ probeRoot: join(probeRoot, "gdb"), resourceDirectory: directory, componentId, argv, cwd, env });
	const missing = await observer.run({ gdb: false });
	refused(missing, 2, finContainerEntryUnattached); assert.equal(existsSync(missing.record), false);
	refused(await observer.run({ before: (record, parent) => writeFile(join(parent, "planted"), "") }), finContainerGdbExit.refusedRecord, null);
	const outside = join(probeRoot, "outside"); await mkdir(outside);
	const poisoned = await observer.run({ tmpdir: outside });
	assert.equal(poisoned.code, finContainerGdbExit.instrumentation, poisoned.output);
	assert.match(poisoned.output, /fin instrumentation refused: deployment refused: \S+ loaded from outside a direct extraction child of the parent/u);
	const preloaded = await observer.run({ extra: { LD_PRELOAD: Object.keys(observer.hashes).map(name => join(directory, name)).join(":") } });
	assert.equal(preloaded.code, finContainerGdbExit.instrumentation, preloaded.output);
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, `instrumented probe failed (2 unattached, 3 uncovered, 4 trigger failed, 70 stale record or parent, 71 instrumentation or refused deployment, 72 signal): ${accepted.output}`);
	assert.equal(accepted.stderr, "");
	const observed = readFinContainerEntry(accepted.stdout, finContainerEntryExpected);
	const { breakpoints: armed } = await assertExtractedFinContainerGdbRun(observer, accepted, observed);
	const identities = {
		scriptSha256: sha256(finContainerGdbExtractedScript)
		, configSha256: observer.configSha256
		, definers: observer.identity.definers
		, hashes: observer.hashes
		, breakpoints: armed
		, gdb: await gdbVersion(cwd)
		, loadTrigger: finContainerEntryLoadTrigger
		, missingInstrumentRefused: true
		, plantedParentRefused: true
		, outsideRootRefused: true
		, preloadedCopiesRefused: true
	};
	return { stdout: accepted.stdout, instrument: "gdb-breakpoints-extracted-root", identities };
};

const one = list => {
	assert.equal(list.length, 1, list.join(","));
	return list[0];
};

/**
 * Measure one installed host profile: its public calls, then the separate C raw-adapter calls of the same
 * verified libraries, both against model-derived columns. Installed bytes are rechecked afterwards.
 *
 * @param root0 - The installed consumer and its build.
 * @param root0.profile - One of finContainerEntryProfiles.
 * @param root0.consumer - Consumer root where installCopiedConsumer installed this profile.
 * @param root0.command - The host command installCopiedConsumer returned.
 * @param root0.packages - Verified package-set entries for this profile's target.
 * @param root0.handoff - Relocated archive directory.
 * @param root0.model - The build's native model.
 * @param root0.environment - Producer toolchain selection.
 */
export const observeFinContainerEntry = async ({ profile, consumer, command, packages, handoff, model, environment }) => {
	assert.ok(finContainerEntryProfiles.includes(profile), profile);
	const root = join(consumer, profile), probeRoot = join(consumer, `${profile}-entry`), pkg = packages.find(item => item.role === "component");
	let directory, component = model.component, publicHost, verify;
	if(profile === "php-native")
	{
		const vendor = join(root, "vendor");
		directory = join(vendor, one([...new Set((await readdir(vendor, { recursive: true })).filter(path => /\/native\/linux-x64\/[^/]+\.so$/u.test(path)).map(dirname))]));
		const before = await hashDirectory(directory);
		verify = async () => assert.deepEqual(await hashDirectory(directory), before);
		const columns = finContainerEntryColumns(model, component);
		const source = phpFinContainerEntryProbe();
		const argv = [command, "-n", "-d", "extension=ffi", "-d", "ffi.enable=1", join(probeRoot, "entry.php"), root];
		const compile = async () => {
			await saveLakeFile(probeRoot, "entry.php", source);
			assert.match((await runCopied(command, ["-n", "-l", "entry.php"], probeRoot, tools)).stdout, /^No syntax errors detected in entry\.php\n$/u);
		};
		publicHost = await ldPreloaded({ probeRoot, directory, columns, componentId: component.id, argv, cwd: root, env: copiedCleanEnvironment, compile });
		publicHost.identities.probeSha256 = sha256(source);
		publicHost.caller = String.raw`public PHP functions LeanFincontainers\mirror_all, sum_huge, or_default, present and label through Composer autoload and PHP FFI into the bundled C adapters`;
	}
	else if(profile === "wit-wasi")
	{
		const installed = join(root, `${pkg.name}-${pkg.version}-wit-wasi`), receiptPath = join(installed, "lean-bridge-package.json"), receiptBytes = await readFile(receiptPath);
		const receipt = JSON.parse(receiptBytes);
		await verifyNativeFiles(installed, receipt.files);
		verify = async () => { await verifyNativeFiles(installed, receipt.files); assert.deepEqual(await readFile(receiptPath), receiptBytes); };
		component = receipt.component ?? component;
		directory = join(installed, "lib");
		const columns = finContainerEntryColumns(model, component), source = witFinContainerEntryProbe(pkg.name);
		const environmentForCompile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		const compile = async () => {
			await saveLakeFile(probeRoot, "entry.c", source);
			const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", `${pkg.name}-wit`], root, environmentForCompile)).stdout.trim().split(/\s+/u);
			await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", join(probeRoot, "entry.c"), ...flags, "-ldl", "-o", join(probeRoot, "entry")], root, environmentForCompile);
		};
		publicHost = await ldPreloaded({ probeRoot, directory, columns, componentId: component.id, argv: [join(probeRoot, "entry")], cwd: root, env: copiedCleanEnvironment, compile });
		publicHost.identities.probeSha256 = sha256(source);
		publicHost.caller = `public WIT exports mirror-all, sum-huge, or-default, present and label through the installed ${pkg.name}_wasmtime_call host API, the embedded Wasmtime component and its host imports into the bundled C adapters`;
	}
	else if(profile === "ruby")
	{
		const gems = join(root, "gems"), env = { ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems };
		const installed = (await runCopied(command, ["-e", `print Gem::Specification.find_by_name(${JSON.stringify(pkg.name)}, ${JSON.stringify(pkg.version)}).full_gem_path`], root, env)).stdout;
		assert.ok(installed.startsWith(`${gems}/`), installed);
		const receiptPath = join(installed, "lean-bridge/package-receipt.json"), receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes);
		await verifyNativeFiles(installed, receipt.files);
		verify = async () => { await verifyNativeFiles(installed, receipt.files); assert.deepEqual(await readFile(receiptPath), receiptBytes); };
		directory = join(installed, one([...new Set(Object.keys(receipt.files).filter(path => sharedLibrary.test(path)).map(dirname))]));
		finContainerEntryColumns(model, component);
		const source = rubyFinContainerEntryProbe();
		await saveLakeFile(probeRoot, "entry.rb", source);
		assert.equal((await runCopied(command, ["-c", join(probeRoot, "entry.rb")], probeRoot, tools)).stdout, "Syntax OK\n");
		publicHost = await strictGdb({ probeRoot, directory, componentId: component.id, argv: [command, join(probeRoot, "entry.rb")], cwd: root, env });
		publicHost.identities.probeSha256 = sha256(source);
		publicHost.caller = "public Ruby methods LeanBridge::Fincontainers.mirror_all, .sum_huge, .or_default, .present and .label through the verified RTLD_DEEPBIND gem loader and Fiddle into the bundled C adapters";
	}
	else if(profile === "dotnet")
	{
		const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(probeRoot, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
		const source = dotnetFinContainerEntryProbe(), project = join(probeRoot, "probe");
		await saveLakeFile(project, "Probe.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Probe.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
		await saveLakeFile(project, "NuGet.Config", `<configuration><packageSources><clear/><add key="prepared" value="${join(root, "feed")}"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>`);
		await saveLakeFile(project, "Probe.cs", source);
		await runCopied(command, ["restore", "--configfile", "NuGet.Config"], project, env);
		await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], project, env);
		// The generated loader's own choice: runtimes/linux-x64/native under the application, else the application directory.
		const out = join(project, "out");
		directory = [join(out, "runtimes/linux-x64/native"), out].find(path => existsSync(path) && readdirSync(path).some(name => sharedLibrary.test(name)));
		const nupkg = join(root, "packages", pkg.name.toLowerCase(), pkg.version, "runtimes/linux-x64/native");
		const packaged = await hashDirectory(nupkg);
		assert.ok(Object.keys(packaged).length > 0);
		for(const [name, digest] of Object.entries(packaged)) assert.equal(sha256(await readFile(join(directory, name))), digest, `${name} is the package's own bytes`);
		verify = async () => { assert.deepEqual(await hashDirectory(nupkg), packaged); for(const [name, digest] of Object.entries(packaged)) assert.equal(sha256(await readFile(join(directory, name))), digest, name); };
		finContainerEntryColumns(model, component);
		publicHost = await strictGdb({ probeRoot, directory, componentId: component.id, argv: [command, join(out, "Probe.dll")], cwd: project, env });
		publicHost.identities.probeSha256 = sha256(source);
		publicHost.identities.loadTrigger = finContainerEntryLoadTrigger;
		publicHost.caller = "public .NET methods LeanBridge.Fincontainers.Api.MirrorAll, .SumHuge, .OrDefault, .Present and .Label through the verified RTLD_DEEPBIND NuGet loader and DllImport into the bundled C adapters";
	}
	else
	{
		const jar = join(root, "component.jar"), artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
		assert.equal(sha256(await readFile(jar)), artifact.sha256, "the installed JAR is the handoff's exact bytes");
		const resources = join(probeRoot, "resources");
		await mkdir(resources, { recursive: true });
		await runCopied("/usr/bin/unzip", ["-q", jar, "META-INF/lean-bridge/native/linux-x64/*", "-d", resources], probeRoot, tools);
		directory = join(resources, "META-INF/lean-bridge/native/linux-x64");
		verify = async () => assert.equal(sha256(await readFile(jar)), artifact.sha256);
		finContainerEntryColumns(model, component);
		const source = profile === "java" ? javaFinContainerEntryProbe() : kotlinFinContainerEntryProbe(), build = join(probeRoot, "probe");
		let classPath, main;
		if(profile === "java")
		{
			await saveLakeFile(build, "Probe.java", source);
			await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-Xlint:all", "-cp", jar, "-d", join(build, "classes"), "Probe.java"], build);
			classPath = `${jar}:${join(build, "classes")}`; main = "Probe";
		}
		else
		{
			await saveLakeFile(build, "Probe.kt", source);
			await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", jar, "Probe.kt", "-include-runtime", "-d", join(build, "probe.jar")], build, { ...environment, JAVA_HOME: dirname(dirname(command)) });
			classPath = `${jar}:${join(build, "probe.jar")}`; main = "ProbeKt";
		}
		const argv = ({ record, nonce, configSha256, definerIndices, tmpdir }) => [command, "--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${tmpdir}`, "-cp", classPath, main, record, nonce, configSha256, definerIndices.join(",")];
		publicHost = await extractedGdb({ probeRoot, directory, componentId: component.id, argv, cwd: root, env: copiedCleanEnvironment });
		publicHost.identities.probeSha256 = sha256(source);
		publicHost.caller = `public ${profile === "java" ? "Java" : "Kotlin"} calls of org.leanbridge.fincontainers.Api.mirrorAll, .sumHuge, .orDefault, .present and .label through the verified extracting RTLD_DEEPBIND JAR loader and FFM downcalls into the bundled C adapters`;
	}
	const columns = finContainerEntryColumns(model, component);
	const rawAdapter = await observeFinContainerRawAdapters({ probeRoot: join(probeRoot, "raw"), directory, componentId: component.id, columns, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX });
	await verify();
	const libraries = await hashDirectory(directory);
	return finContainerEntryReport({ publicHost, rawAdapter, columns, componentId: component.id, libraries: { directory: relative(consumer, directory), sha256: libraries, handoff: basename(handoff) } });
};

/** Stable digests of every generated probe and instrument source, for reports and review. */
export const finContainerEntrySourceDigests = () => ({
	php: sha256(phpFinContainerEntryProbe())
	, wit: sha256(witFinContainerEntryProbe("fincontainers"))
	, ruby: sha256(rubyFinContainerEntryProbe())
	, dotnet: sha256(dotnetFinContainerEntryProbe())
	, java: sha256(javaFinContainerEntryProbe())
	, kotlin: sha256(kotlinFinContainerEntryProbe())
	, strictScript: sha256(finContainerGdbScript)
	, extractedScript: sha256(finContainerGdbExtractedScript)
});
