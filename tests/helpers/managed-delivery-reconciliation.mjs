/** @file Match installed managed task, cancellation and iterator evidence without rebuilding a package. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";

const fixtures = "tests/fixtures", evidence = "docs/evidence", routes = ["ordinary","reviewed"];
const json = async name => JSON.parse(await readFile(join(evidence,name+".json")));
const digest = async name => sha256(await readFile(join(fixtures,name)));
const capture = async name => {
	const record = await json(name);
	assert.equal(sha256(canonicalJson(record.installed)),record.acceptanceSha256);
	assert.deepEqual(record.installed.rows.map(r=>r.route).sort(), routes);
	return record.installed;
};
const rowFor = (record,route) => record.rows.find(r=>r.route===route);
const original = (pkg,route) => {
	assert.match(pkg.receiptSha256,/^[0-9a-f]{64}$/u);
	assert.equal(Boolean(pkg.reviewedSourceSha256),route==="reviewed");
	if(route==="reviewed") assert.match(pkg.reviewedSourceSha256,/^[0-9a-f]{64}$/u);
};

test("CLR task/cancellation/async-enumerator evidence belongs to both installed NuGet routes", async () => {
	const tasks = await capture("dotnet-tasks-20261122"), callbacks = await capture("dotnet-retained-tasks-20261122");
	const leases = await capture("dotnet-resource-leases-20261122");
	const audit = await digest("dotnet-sync-io/Audit.cs");
	for(const [record,client] of [[tasks,"dotnet-tasks"],[callbacks,"dotnet-retained-tasks"]])
	{
		assert.equal(record.clients["Program.cs"],await digest(client+"/Program.cs"));
		assert.equal(record.clients["Audit.cs"],audit);
	}
	for(const route of routes)
	{
		const row = rowFor(tasks,route), feedback = rowFor(callbacks,route);
		const parked = await json("dotnet-parked-pull-20261126/"+route);
		const terminal = await json("dotnet-stream-terminal-20261126/"+route);
		assert.deepEqual(parked.installed,row.installed);
		assert.equal(parked.consumerSha256,await digest("dotnet-tasks/Parked.cs"));
		assert.equal(parked.observerSha256,audit);
		// The terminal replay retained the package identities; assembly and
		// linker inspections are present only in the original install record.
		const packages = rowFor(leases,route).packages.filter(p=>["Acme.Desk","Acme.Depot"].includes(p.name)).map(({
			assembly,assemblySha256,contracts,ledger,nativeSha256,sdk,...identity
		})=>identity);
		assert.deepEqual(packages.map(p=>p.name),["Acme.Desk","Acme.Depot"]);
		assert.deepEqual(terminal.packages,packages);
		assert.equal(terminal.consumerSha256,await digest("dotnet-task-resources/Terminal.cs"));
		assert.equal(terminal.observerSha256,audit);
		original(row.installed.find(p=>p.name==="Acme.Pulse"),route);
		original(feedback.installed.find(p=>p.route===route),route);
		for(const [records,expression] of [
			[row.calls,/genuine await, cancellation, pull backpressure, disposal and retirement; shared owner, 2 components, 0 live identities/u],
			[parked.observations,/parked token cancellation finalized before disposal; disposal woke a second blocked pull; no late items or live owners/u],
			[terminal.observations.map(r=>r.observed),/end, typed failure and cancellation finalized before explicit disposal; last error owner usable, zero owner and descriptor delta/u],
			[feedback.calls,/nested owner reentry, exception identity, revocation, cancellation and shared trap; 2 components, 0 live identities/u]
		])
		{
			assert.equal(records.length,2);
			assert.equal(new Set(records.map(s=>s.split(":")[0])).size,2);
			for(const observation of records) assert.match(observation,expression);
		}
	}
});

test("separate Java and Kotlin executions match both installed Maven routes and their parked-pull peers", async () => {
	const tasks = await capture("jvm-tasks-20261123"), callbacks = await capture("jvm-retained-tasks-20261123");
	for(const [record,dir] of [[tasks,"jvm-tasks"],[callbacks,"jvm-retained"]])
	{
		for(const file of ["Installed.java","Installed.kt"]) assert.equal(record.clients[file],await digest(dir+"/"+file));
		assert.equal(record.clients["Observe.java"],await digest("jvm-tasks/Observe.java"));
	}
	for(const route of routes)
	{
		const parked = await json("jvm-parked-pull-20261126/"+route);
		assert.deepEqual(parked.component,tasks.packages.find(p=>p.route===route));
		assert.deepEqual(parked.peer,tasks.packages.find(p=>p.route==="peer"));
		original(parked.component,route);
		original(callbacks.packages.find(p=>p.route===route),route);
		assert.equal(parked.observerSha256,tasks.clients["Observe.java"]);
		assert.equal(parked.results.length,4);
		const base = rowFor(tasks,route), cb = rowFor(callbacks,route);
		assert.match(base.observed.exit,/normal JVM exit with a non-cooperative pending Lean task/u);
		for(const [language,main,file] of [["Java","Installed","Parked.java"],["Kotlin","InstalledKt","ParkedFlow.kt"]])
		for(const order of ["timers-first","peer-first"])
		{
			const observation = base.observed[main+"/"+order], counter = observation.stats;
			assert.equal(counter.live,0); assert.equal(counter.componentInits,2); assert.equal(counter.attached,2);
			assert.match(observation.line,language==="Java" ? /futures, cancellation.*typed failures/u
				: /cancellable suspend functions, cold Flow, backpressure, early collection exit, typed errors/u);
			const result = parked.results.find(r=>r.language===language && r.order===order);
			assert.equal(result.consumerSha256,await digest("jvm-tasks/"+file));
			assert.match(result.output,/zero live owners and descriptor delta/u);
			const retained = cb.observed[main+"/"+order.replace("timers","feedback")];
			assert.match(retained,/nested.*revocation, cancellation.*2 components, 0 live identities, descriptor delta 0/u);
		}
	}
});
