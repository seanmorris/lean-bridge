/** @file Exercise both Java and Kotlin input projections against compiled Lean. */
import assert from "node:assert/strict";
import {join} from "node:path";
import test from "node:test";
import {generateOwnedJvmCalls} from "../../src/backends/jvm/owned-calls.mjs";
import {generateOwnedJvmPackage} from "../../src/backends/jvm/owned-package.mjs";
import {runCopied} from "./copied-fixture-install.mjs";
import {compileMixedQuote} from "./mixed-quote-project.mjs";
import {mixedFunctionFieldsIr} from "./owned-aggregate-fixture.mjs";
import {compileOwnedJvmCallNative,compileOwnedJvmCallSources} from "./owned-jvm-call-fixture.mjs";

test("JVM mixed inputs have typed fields without changing leased output types", () => {
	const ir=mixedFunctionFieldsIr(), pkg=generateOwnedJvmPackage(ir);
	const fn=pkg.functions.find(f=>f.publicName==="applyTariffWithHostFields");
	assert.deepEqual(fn.hostRecordSlots.map(s=>s.index),[0,1]);
	assert.deepEqual(pkg.contract.hostInputRecords,[{type: fn.parameters[0],input: "TariffInput",lifetime: "call",fields: ["quote","rebate"]}]);
	for(const k of [false,true])
	{
		assert.equal(pkg.parameterType(fn,0,k),pkg.parameterType(fn,1,k));
		assert.match(pkg.parameterType(fn,0,k),/\.TariffInput$/u);
		const orig=pkg.functions.find(f=>f.publicName==="applyTariff");
		assert.match(pkg.parameterType(orig,0,k),/\.Tariff$/u);
	}
});

test("compiled Lean receives two mixed input records from Java and Kotlin", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const bin=await compileMixedQuote(t,"jvm-mixed-record-inputs.json");
	const model=generateOwnedJvmCalls(bin.model.bindingIr), ns=model.namespace;
	await compileOwnedJvmCallNative(bin,{valueCopies: Boolean(model.c.copies?.length)});
	const fn=model.exportCalls.find(f=>f.publicName==="compareCardsWithHostFields");
	assert.deepEqual(fn.hostRecordSlots.map(s=>s.index),[0,1]);
	const java=model.methodName(fn,"Java"),kt=model.methodName(fn,"Kotlin");
	const files={...model.files};
	files["Mixed.java"]=`package ${ns};
import java.lang.foreign.*;
import static java.lang.foreign.ValueLayout.JAVA_LONG;
public final class Mixed {
    public static void main(String[] args) throws Throwable {
        try (var arena=Arena.ofShared()) {
            var symbols=SymbolLookup.libraryLookup(args[0],arena);
            var bindings=new _OwnedBindings(symbols,()->{});
            var ids=Linker.nativeLinker().downcallHandle(symbols.find("probe_identities").orElseThrow(),FunctionDescriptor.of(JAVA_LONG));
            var live=Linker.nativeLinker().downcallHandle(symbols.find("probe_live").orElseThrow(),FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current();
            long base=(long)ids.invokeExact(), allocations=(long)live.invokeExact();
            int[] visits=new int[4];
            var a=new PriceCardInput(x->{visits[0]++;return x*2;},x->{visits[1]++;return x+1;},"A\\0é",2);
            var b=PriceCardInput.builder().quote(x->{visits[2]++;return x*3;}).rebate(x->{visits[3]++;return x+7;}).base(5).label("β").build();
            var bad=new PriceCardInput(x->0,x->0,"ok",-1);
            try { bindings.${java}(a,bad); throw new AssertionError(); } catch (IllegalArgumentException expected) {}
            if (!java.util.Arrays.equals(visits,new int[4])) throw new AssertionError("partial dispatch");
            if (bindings.${java}(a,b)!=78 || !java.util.Arrays.equals(visits,new int[]{1,1,1,1})) throw new AssertionError("Java fields");
            KotlinMixed.run(bindings);
            if ((long)ids.invokeExact()!=base || (long)live.invokeExact()!=allocations) throw new AssertionError("field leak");
            bindings.runtime.current().close();
            if ((long)ids.invokeExact()!=0 || (long)live.invokeExact()!=0) throw new AssertionError("shutdown leak");
            System.out.println("Java 78; Kotlin 78; zero live owners");
        }
    }
}`;
	files["KotlinMixed.kt"]=`package ${ns}
import ${ns}.kotlin.PriceCardInput
internal object KotlinMixed {
    @JvmStatic fun run(bindings: _OwnedBindings) {
        val visits=IntArray(4)
        val a=PriceCardInput(quote={x->visits[0]++; x*2},rebate={x->visits[1]++; x+1},label="A\\u0000é",base=2)
        val b=PriceCardInput.builder().quote{x->visits[2]++; x*3}.rebate{x->visits[3]++; x+7}.base(5).label("β").build()
        val bad=PriceCardInput({0},{0},"ok",-1)
        check(runCatching { bindings.${kt}(a,bad) }.exceptionOrNull() is IllegalArgumentException)
        check(visits.contentEquals(IntArray(4)))
        check(bindings.${kt}(a,b)==78L && visits.contentEquals(intArrayOf(1,1,1,1)))
    }
}`;
	const tool=await compileOwnedJvmCallSources(bin.directory,files);
	const result=await runCopied(tool.java,["--enable-native-access=ALL-UNNAMED"
		, "-cp"
		, "classes:"+tool.stdlib
		, ns+".Mixed"
		, join(bin.directory,"libprobe.so")],bin.directory);
	assert.equal(result.stdout.trim(),"Java 78; Kotlin 78; zero live owners");
});
