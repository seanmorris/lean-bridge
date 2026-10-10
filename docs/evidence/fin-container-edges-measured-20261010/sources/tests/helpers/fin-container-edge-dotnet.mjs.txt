/**
 * Observe every edge call in the unchanged C# consumer through typed public forwarders.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer } from "./fin-container-edges.mjs";

export const finContainerEdgeDotnetChecks = 14089;

/** C# permits Some(null); its public API rejects that carrier before native dispatch. */
export const finContainerEdgeDotnetExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, status) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(status === "ok")
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, status, Object.freeze([...counts])]));
	};
	for(const status of ["ok", "fin", "ok"]) add("present", status);
	for(const status of ["ok", "ok", "fin"]) add("flatten", status);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "ok");
	for(let value = 0; value < 3; value++)
		for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "fin");
	for(let value = 0; value < 3; value++) add("optionalDigits", "ok");
	for(let row = 0; row < 3; row++)
	{
		add("present", "fin"); add("optionalDigits", "fin");
		for(let column = 0; column < 3; column++) add("flatten", "fin");
	}
	add("present", "ok"); add("flatten", "ok");
	for(const method of ["emptyArray", "emptyList", "optionalDigits"]) add(method, "null");
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "value");
	for(let value = 0; value < 3; value++) add("optionalDigits", "value");
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, "fin"); add(method, "ok"); }
	return rows;
})());

/**
 * Validate every status and counter snapshot, including the original assertion total.
 *
 * @param stdout - Unmodified process output.
 */
export const readFinContainerEdgeDotnet = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), `fin-container-ok:${finContainerEdgeDotnetChecks}`);
	assert.equal(lines.length, finContainerEdgeDotnetExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-dotnet [1-9][0-9]* [A-Za-z]+ (?:ok|fin|null|value)(?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, status, counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeDotnetExpected[index], `.NET edge call ${index + 1}`);
		return row;
	});
};

/**
 * Preserve all original assertions and exception identities; only forward the six measured APIs.
 *
 * @param model - Verified native model.
 * @param component - Original component identity.
 * @param assembly - Absolute receipt-pinned assembly in the guarded probe deployment.
 */
export const finContainerEdgeDotnetProbe = async (model, component, assembly) => {
	finContainerEdgeColumns(model, component);
	assert.ok(typeof assembly === "string" && isAbsolute(assembly) && !assembly.includes("\0"));
	let consumer = await finContainerEdgeConsumer("dotnet");
	for(const name of finContainerEdgeEntries)
	{
		const method = name[0].toUpperCase() + name.slice(1);
		assert.ok(consumer.includes(`Api.${method}(`));
		consumer = consumer.replaceAll(`Api.${method}(`, `EdgeApi.${method}(`);
	}
	const marker = "    static void Main() {";
	assert.equal(consumer.split(marker).length, 2);
	consumer = consumer.replace(marker, "    static void Main(string[] args) {\n        EdgeCounter.Initial(args);");
	const counter = `static class EdgeCounter {
    static string[] arguments = [];
    static long step;
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    static void Refuse(int code, string message) {
        Console.Error.WriteLine(message); Environment.Exit(code);
        throw new Exception("Environment.Exit returned");
    }
    static byte[]? Record() {
        try {
            var bytes = System.IO.File.ReadAllBytes(arguments[0]);
            return bytes.Length == 328 ? bytes : null;
        } catch (System.IO.IOException) { return null; }
          catch (UnauthorizedAccessException) { return null; }
    }
    static string Text(byte[] bytes, int offset, int length) => System.Text.Encoding.ASCII.GetString(bytes, offset, length);
    static bool Ours(byte[]? bytes) => bytes is not null && BitConverter.IsLittleEndian
        && Text(bytes, 0, 8) == "LBFEDGDB" && BitConverter.ToUInt32(bytes, 8) == 1
        && BitConverter.ToUInt32(bytes, 12) == 8 && Text(bytes, 16, 64) == arguments[2]
        && Text(bytes, 80, 32) == arguments[1] && BitConverter.ToInt64(bytes, 112) == Environment.ProcessId
        && BitConverter.ToUInt32(bytes, 120) == 1;
    public static void Initial(string[] args) {
        arguments = args;
        if (args.Length != 4) Refuse(2, "edge record is not attached with empty counters");
        var bytes = Record();
        if (!Ours(bytes)) Refuse(2, "edge record is not attached with empty counters");
        for (int offset = 124; offset < 328; offset += 4) {
            int expected = offset >= 200 && offset < 232 ? -1 : 0;
            if (BitConverter.ToInt32(bytes!, offset) != expected) Refuse(2, "edge record is not attached with empty counters");
        }
        var loaded = typeof(Api).Assembly;
        if (loaded.Location != ${JSON.stringify(assembly)} || typeof(Option<BigInteger>).Assembly != loaded
            || loaded.GetType("LeanBridge.Fincontainers.Interop.Runtime")?.Assembly != loaded
            || loaded.GetType("LeanBridge.Fincontainers.Interop.Native")?.Assembly != loaded)
            Refuse(6, "unexpected .NET public assembly location");
    }
    static long[] Counts() {
        var bytes = Record();
        if (!Ours(bytes) || BitConverter.ToUInt32(bytes!, 124) != 255
            || BitConverter.ToUInt32(bytes!, 128) != 0 || BitConverter.ToUInt32(bytes!, 132) != 0)
            Refuse(3, ".NET edge definitions are not completely armed");
        var expected = arguments[3].Split(',');
        if (expected.Length != 8) Refuse(3, ".NET edge definitions are not completely armed");
        var counts = new long[8];
        for (int i = 0; i < 8; ++i) {
            if (BitConverter.ToUInt64(bytes!, 136 + i * 8) != 1
                || BitConverter.ToInt32(bytes!, 200 + i * 4).ToString(System.Globalization.CultureInfo.InvariantCulture) != expected[i]
                || BitConverter.ToUInt32(bytes!, 232 + i * 4) != 0)
                Refuse(3, ".NET edge definitions are not completely armed");
            counts[i] = BitConverter.ToInt64(bytes!, 264 + i * 8);
            if (counts[i] < 0) Refuse(3, ".NET edge definitions are not completely armed");
        }
        return counts;
    }
    static void Recorded(int index, string name, string status, long[] before) {
        var after = Counts();
        for (int column = 0; column < 8; ++column) {
            long delta = status == "ok" && (column == index + 2 || (index >= 4 && column == index - 4)) ? 1 : 0;
            if (after[column] != before[column] + delta) Refuse(5, "wrong .NET edge dispatch count");
        }
        Console.WriteLine("edge-dotnet " + (++step).ToString(System.Globalization.CultureInfo.InvariantCulture)
            + " " + name + " " + status + " " + string.Join(" ", after.Select(n => n.ToString(System.Globalization.CultureInfo.InvariantCulture))));
    }
    public static T Call<T>(int index, string name, Func<T> action) {
        var before = Counts();
        if (step == 0 && before.Any(value => value != 0)) Refuse(5, "nonempty .NET edge counters before first call");
        T result;
        try { result = action(); }
        catch (Exception error) {
            string status;
            if (error.GetType() == typeof(ArgumentNullException)) status = "null";
            else if (error.GetType() == typeof(ArgumentOutOfRangeException) && ((ArgumentOutOfRangeException)error).ParamName == "value"
                && error.Message == new ArgumentOutOfRangeException("value", "Lean Nat cannot be negative").Message) status = "value";
            else if (error.GetType() == typeof(ArgumentException)
                && System.Text.RegularExpressions.Regex.IsMatch(error.Message, "\\\\Aarg[0-9]+(?:\\\\[[0-9]+\\\\]|\\\\?)* is not below its Fin [0-9]+ bound\\\\z")) status = "fin";
            else throw;
            Recorded(index, name, status, before);
            throw;
        }
        Recorded(index, name, "ok", before);
        return result;
    }
}
`;
	const signatures = [
		["BigInteger[]", "BigInteger[]"], ["BigInteger[]", "BigInteger[]"]
		, ["Option<BigInteger>", "Option<BigInteger>"]
		, ["Option<BigInteger[]>", "Option<BigInteger[]>"]
		, ["Option<BigInteger>[]", "BigInteger[]"]
		, ["BigInteger[][]", "Option<BigInteger[]>"]
	];
	const forwarders = finContainerEdgeEntries.map((name, index) => {
		const method = name[0].toUpperCase() + name.slice(1);
		return `    public static ${signatures[index][1]} ${method}(${signatures[index][0]} value)
        => EdgeCounter.Call(${index}, "${name}", () => Api.${method}(value));`;
	}).join("\n");
	const api = `static class EdgeApi {
${forwarders}
}
`;
	return { consumer, counter, api, source: consumer + "\n" + counter + api };
};
