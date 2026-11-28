/** @file Relate CPython/Ruby async execution records to original installed releases. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {basename,join} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";

const json = async path => JSON.parse(await readFile(path));
const digest = async path => sha256(await readFile(path));
const fixture = path => digest(join("tests/fixtures",path));
const report = name => json(join("docs/evidence",name+".json"));
const dir = process.env;
const routes = ["ordinary","reviewed"];
const rowFor = (rows,route) => {
	const matches = rows.filter(row => row.route === route);
	assert.equal(matches.length,1,route); return matches[0];
};

test("asyncio: original Timers, retained callbacks and leased stream installations on both CPython ABIs", {
	skip: !dir.LEAN_BRIDGE_PYTHON_PARKED_PULL_ORIGINAL && "set original Timers, callback and lease directories"
}, async () => {
	const callback = await report("python-retained-tasks-20261122");
	const leases = await report("python-resource-leases-20261123");
	assert.equal(callback.consumerSha256,await fixture("python-retained-tasks/installed.py"));
	assert.equal(callback.lifecycleObserverSha256,await fixture("python-retained-tasks/audit.py"));
	for(const tag of ["cp311","cp312"])
	{
		const abi = "cpython-"+tag.slice(2);
		const cb = join(dir.LEAN_BRIDGE_PY_ASYNC_RETAINED,abi);
		const batch = await json(join(cb,"acceptance.json"));
		assert.equal(batch.interpreter,abi);
		assert.equal(batch.consumerSha256,callback.consumerSha256);
		assert.equal(batch.auditSha256,callback.lifecycleObserverSha256);
		const old = join(dir.LEAN_BRIDGE_PY_ASYNC_LEASES,tag,"acceptance.json");
		const control = leases.interpreters[abi];
		const terminal = await report("python-stream-terminal-20261126/"+abi);
		assert.equal(await digest(old),control.acceptanceSha256);
		assert.equal(terminal.originalAcceptanceSha256,control.acceptanceSha256);
		assert.deepEqual(await json(old),control.installed);
		assert.equal(terminal.clientSha256,await fixture("python-task-resources/terminal.py"));
		assert.equal(terminal.observerSha256,control.installed.clients["observe.py"]);
		for(const route of routes)
		{
			const installed = join(dir.LEAN_BRIDGE_PYTHON_PARKED_PULL_ORIGINAL,"tasks",tag+"-"+tag+"-linux_x86_64",route);
			const saved = await json(join(installed,"acceptance.json"));
			const parked = await report("python-parked-pull-20261126/"+tag+"-"+route);
			assert.equal(parked.route,route); assert.equal(parked.tag,tag);
			assert.equal(saved.route,route); assert.ok(saved.offline && saved.relocated);
			assert.match(saved.stdout,/compiled streams: demand, exhaustion, scoped break, error ordering, pending close\/cancel, late result and loop shutdown/u);
			assert.match(saved.stdout,/real Lean tasks: completion, typed startup and returned errors, ordered cancellation, late result/u);
			assert.equal(await digest(join(installed,"package-set-receipt.json")),parked.packageSetSha256);
			const pkg = await json(join(installed,"package-set-receipt.json"));
			assert.equal(pkg.profiles[0].bindingIrSha256,parked.bindingIrSha256);
			assert.deepEqual(pkg.packages.flatMap(p=>p.artifacts),parked.archives);
			const part = parked.archives.find(a=>basename(a.path).startsWith("lean_timers-"));
			assert.equal(await digest(join(installed,basename(part.path))),part.sha256);
			assert.equal(await fixture("python-lean-tasks/streams.py"),await digest(join(installed,"streams.py")));
			assert.equal(await fixture("python-lean-tasks/cancel_pull.py"),parked.clientSha256);
			assert.equal(await fixture("python-task-resources/observe.py"),parked.observerSha256);
			const loops = await report("python-loop-ownership-20261127/"+tag+"-"+route+".loops");
			for(const key of ["route","tag","packageSetSha256","bindingIrSha256","archives","verified","observerSha256"])
				assert.deepEqual(loops[key],parked[key],key);
			assert.equal(loops.clientSha256,await fixture("python-lean-tasks/loop_ownership.py"));
			assert.deepEqual(loops.observed,{
				foreignLoop: {rejected: ["anext","aclose"],settled: [41],finalizers: 1,owners: 0}
				, refusedReader: {registrationAttempts: 1,finalizersBeforeClose: 1,fresh: 73,owners: 0}
			});
			assert.equal(parked.observed,"parked cooperative and noncooperative pulls: one cancellation, finalized before aclose, no late item, zero owner and selector delta");
			const r = rowFor(batch.routes,route), wheel = rowFor(callback.wheels.filter(w=>w.interpreter===abi),route);
			assert.equal(r.receiptSha256,wheel.receiptSha256);
			const handoff = join(cb,route,"handoff");
			assert.equal(await digest(join(handoff,"package-set-receipt.json")),r.receiptSha256);
			assert.equal(await digest(join(handoff,r.componentArchive.path)),wheel.sha256);
			assert.equal(r.runtimeArchive.sha256,callback.sharedRuntime.sha256);
			assert.equal(r.bindingIrSha256,callback.bindingIrSha256);
			assert.equal(r.sourceTreeSha256,callback.sourceTrees[route]);
			const end = rowFor(terminal.rows,route);
			const original = rowFor(control.installed.rows,route).packages;
			assert.deepEqual(end.packages.map(p=>p.name),["lease-desk","lease-depot"]);
			assert.deepEqual(end.packages,original.filter(p=>p.route===route));
			// The replay verified the lookalike wheel but its two application
			// load orders deliberately did not use it as a task owner.
			const files = original.flatMap(p=>[basename(p.component.path),basename(p.runtime.path)]);
			assert.deepEqual(Object.keys(end.verified).sort(),[...new Set(files)].sort());
			assert.deepEqual(end.calls.map(c=>c.order),[["lease_desk","lease_depot"],["lease_depot","lease_desk"]]);
			for(const call of end.calls) assert.equal(call.result,
				"exhaustion and typed failure finalized before aclose; early close finalized on request; last error owner usable, zero owner and descriptor delta");
		}
	}
});

test("Ruby Fiber: both primary gems, nested retained calls and a late pull after external cancellation", {
	skip: !dir.LEAN_BRIDGE_RUBY_PARKED_ORIGINAL && "set original Pulse, Feedback and lease directories"
}, async () => {
	const pulse = await report("ruby-fiber-tasks-20261122"), relay = await report("ruby-retained-tasks-20261122");
	const leases = await report("ruby-resource-leases-20261122");
	const captures = [
		[dir.LEAN_BRIDGE_RUBY_PARKED_ORIGINAL,pulse]
		, [dir.LEAN_BRIDGE_RB_ASYNC_RETAINED,relay]
		, [dir.LEAN_BRIDGE_RB_ASYNC_LEASES,leases]
	];
	for(const [base,record] of captures)
	{
		const path = join(base,"acceptance.json");
		assert.equal(await digest(path),record.acceptanceSha256);
		if(record === leases) assert.deepEqual(await json(path),record.installed);
		else assert.deepEqual((await json(path)).routes,record.routes);
	}
	assert.equal(leases.installed.clientSha256,await fixture("ruby-task-resources/consumer.rb"));
	assert.equal(relay.coInstallation.clientSha256,await fixture("ruby-retained-tasks/compose.rb"));
	assert.equal(await digest(join(dir.LEAN_BRIDGE_RB_ASYNC_RETAINED,"composition.json")),relay.coInstallationSha256);
	for(const route of routes)
	{
		const plain = rowFor(pulse.routes,route), cb = rowFor(relay.routes,route);
		const paired = rowFor(relay.coInstallation.reports,route);
		assert.equal(paired.primaryArchiveSha256,cb.archive.sha256);
		assert.equal(paired.primaryReceiptSha256,cb.receiptSha256);
		assert.equal(plain.clients["consumer.rb"],await fixture("ruby-task-lab/consumer.rb"));
		assert.equal(cb.clients["consumer.rb"],await fixture("ruby-retained-tasks/consumer.rb"));
		assert.equal(plain.profile,"native-ruby-task-v1");
		assert.equal(cb.profile,plain.profile);
		assert.match(plain.output,/fiber readiness, cancellation, typed errors, stream backpressure, retirement and cleanup passed$/u);
		assert.match(cb.output,/nested dispatch, original exceptions, fibers, cancellation, retirement and cleanup passed$/u);
		const p = await report("ruby-parked-pull-20261126/"+route), peer = rowFor(pulse.routes,"stream-only");
		assert.equal(p.route,route); assert.equal(p.clientSha256,await fixture("ruby-task-lab/parked.rb"));
		assert.equal(p.schedulerSha256,await fixture("ruby-task-lab/scheduler.rb"));
		assert.equal(p.schedulerSha256,plain.clients["scheduler.rb"]); assert.equal(p.schedulerSha256,cb.clients["scheduler.rb"]);
		assert.equal(p.packageSetSha256,plain.receiptSha256); assert.equal(p.peerPackageSetSha256,peer.receiptSha256);
		assert.equal(p.gemSha256,plain.archive.sha256); assert.equal(p.peerGemSha256,peer.archive.sha256);
		const message = "parked Ruby fiber: original interruption, cursor cancellation, peer delivery, one finalizer, no late item or leaked owner";
		assert.deepEqual(p.checks,{"peer-first": message,"pulse-first": message});
		for(const [record,names] of [[paired,["ruby_feedback","ruby_relay"]],[rowFor(leases.installed.rows,route),["ruby_lease_desk","ruby_lease_depot"]]])
		{
			assert.deepEqual(record.orders.map(o=>o.order),[names,[...names].reverse()]);
			for(const o of record.orders)
			{
				assert.equal(o.liveIdentities,0); assert.equal(o.runtimeInitializations,1);
			}
		}
	}
});
