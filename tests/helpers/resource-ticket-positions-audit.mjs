/** @file Trace direct Ticket results and arguments to executions, not declaration counts. */
import assert from "node:assert/strict";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join,relative,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {auditOwnedCheckedRecordSemanticMatrix} from "./owned-checked-record-semantic-audit.mjs";
import {selectedTicketArchive} from "./resource-position-archives.mjs";

const evidence="docs/evidence",tsDir=join(evidence,"typescript-ticket-positions-20261126");
const tsClient="tests/fixtures/structured-types/ticket-positions.mts";
// Each row names an actual constructor call, a direct serial call and its value check
// in the selected downstream program. The Wasmtime job rewrites the C symbol prefix;
// the semantic audit verifies the rewritten program's digest against the execution.
const c=["OK(owned_checked_records_new_ticket("
	, "OK(owned_checked_records_serial(session, ticket"
	, "expect_serial(session, ticket, 41)"
	, "CHECK(mpz_cmp_ui(value, expected) == 0)"];
const cpp=['api::new_ticket(41, "native")',"CHECK(api::serial(ticket) == 41"];
const witnesses={
	c,"wit-wasi": c,cpp
	, perl: ["$ticket = invoke('new_ticket'","invoke('serial', $_[0])->bcmp($_[1]) == 0","serial_is($ticket, 41"]
	, python: ["ticket = api.new_ticket(41","check(api.serial(ticket) == expected","serial_is(ticket, 41"]
	, ruby: ["ticket = API.new_ticket(41","check(API.serial(ticket) == expected","serial_is(ticket, 41"]
	, rust: ["ticket = new_ticket(&BigUint::from(41u32)","serial(ticket).expect","serial_is(&mut checks, &ticket, 41"]
	, dotnet: ["ticket = Api.NewTicket(N(41)","Check(Api.Serial(ticket) == N(value)","SerialIs(ticket, 41"]
	, java: ["ticket = newTicket(n(41)","check(serial(value).equals(n(expected))","serialIs(ticket, 41"]
	, kotlin: ["Api.newTicket(n(41)","check(Api.serial(ticket) == n(41)"]
	, "php-native": ["$ticket = new_ticket(Big::of(41)","check(serial($value)->isEqualTo","serial_is($ticket, 41"]
	, "php-wasm": ["$ticket = new_ticket(Big::of(41)","check(serial($ticket)->isEqualTo","serial_is($ticket, 41"]
};
const readJson=async file=>JSON.parse(await readFile(file));
const routeNames=["ordinary","reviewed"];
const assertSource=(text,checks,label)=>{
	for(const fragment of checks) assert.ok(text.includes(fragment),label+": missing "+fragment);
};

test("Ticket crosses the export boundary directly on both installed routes for every profile",async()=>{
	const selection=await readJson(join(evidence,"owned-checked-record-aligned-matrix-replay-20261026.json"));
	const revision=selection.replay.revision,matrix=auditOwnedCheckedRecordSemanticMatrix({revision});
	assert.deepEqual(matrix,await readJson(join(evidence,"owned-checked-record-semantic-audit-20261026.json")));
	const profiles={};
	for(const lane of matrix.lanes)
	{
		const archive=await selectedTicketArchive(lane.lane),base=dirname(lane.index.path);
		const original=await archive.read(relative(base,lane.report.path));
		assert.equal(sha256(original),lane.report.sha256);
		const report=JSON.parse(original);
		const save=(profile,route,row)=>{
			assert.ok(lane.profiles.includes(profile));
			profiles[profile]??={};assert.ok(!profiles[profile][route]);profiles[profile][route]=row;
		};
		for(const src of lane.sources.filter(s=>s.mode!=="result-only"))
		{
			const buf=await archive.read("sources/consumer/"+src.path);assert.equal(sha256(buf),src.sha256);
			const source=buf.toString(),js=lane.lane==="javascript";
			if(js)
			{
				const full=source.slice(source.indexOf("const fullProbe ="),source.indexOf("const resultOnlyProbe ="));
				assertSource(full,['const ticket = api.newTicket(20n, "checked")',"check(api.serial(ticket) === 20n)"],src.path);
				assertSource(source,["resultOnly ? resultOnlyProbe : fullProbe"
					, 'saveLakeFile(consumer, "probe.mjs", probeSource)'
					, 'import {run,close} from "./probe.mjs"','["call.mjs"]'
					, "assert.deepEqual(observed, expected(resultOnly))"
					, "checkOwnedJavaScriptBrowsers({"
					, "probeSource, expected: observed, productionReact: true"],src.path);
			} else assertSource(source,witnesses[src.profile],src.path);
			for(const route of routeNames)
			{
				const tag=route+"-full",wasm=lane.lane==="php-wasm";
				const entry=wasm?report.reports.find(e=>e.mode==="full").observations.find(e=>e.reviewed===(route==="reviewed"))
					:report.reports.find(e=>e.route===tag);
				const record=lane.routes.find(r=>r.route===tag).profiles[src.profile];
				const receipt=wasm?sha256(canonicalJson(entry.packageSetReceipt)):entry.retainedPackageSet.receiptSha256;
				assert.match(receipt,/^[0-9a-f]{64}$/u);assert.equal(js?entry.sourceRemovedBeforeInstall:entry.sourceFreeInstallation,true);
				assert.equal(wasm?entry.handoffRemoved:entry.relocatedInstallation,true);
				const row={receipt,source: src.sha256,report: lane.report.sha256,checks: record.checks};
				if(!js)
				{
					save(src.profile,route,{...row,executedSource: record.consumerSha256});continue;
				}
				assert.equal(entry.installedNode,true);save("node-javascript",route,row);
				assert.equal(entry.browser.externalNetworkBlocked,true);assert.equal(entry.browser.installedSourcesRemoved,true);
				const browsers={page: "browser-javascript",react: "browser-react",worker: "browser-worker"};
				for(const [variant,profile] of Object.entries(browsers))
				{
					const runs=entry.browser.executions.filter(e=>e.profile===variant&&e.variant==="production");
					assert.deepEqual(runs.map(r=>r.engine).sort(),["chromium","firefox","webkit"]);
					for(const r of runs)
					{
						assert.ok(r.version);assert.ok(r.reruns>=1);
						assert.equal(r.checks,record.checks);
					}
					save(profile,route,{...row,browsers: Object.fromEntries(runs.map(r=>[r.engine,r.version]))});
				}
				// tsc --noEmit in the historical job is not a TypeScript runtime result.
				const typed=await readJson(join(tsDir,route+".json"));
				assert.equal(typed.receipt,receipt);assert.equal(typed.route,route);assert.equal(typed.revision,revision);
				assert.equal(typed.bindingIrSha256,entry.bindingIrSha256);
				assert.equal(typed.sourceSha256,sha256(await readFile(tsClient)));
				assert.deepEqual(typed.artifacts,Object.fromEntries(entry.packageSetReceipt.packages.map(
					p=>[p.role,p.artifacts[0].sha256])));
				assert.deepEqual(typed.observed,{serial: ((1n<<90n)+7n).toString(),staleRejected: true,retained: true,closed: true});
				save("node-typescript",route,{receipt,source: typed.sourceSha256,report: sha256(canonicalJson(typed))});
			}
		}
	}
	assert.deepEqual(Object.keys(profiles).sort(),matrix.lanes.flatMap(l=>l.profiles).sort());
	for(const row of Object.values(profiles))
	{
		assert.deepEqual(Object.keys(row),routeNames);assert.notEqual(row.ordinary.receipt,row.reviewed.receipt);
	}
	const out={revision,profiles,positions: ["export-parameter","export-result"]};
	const path=join(evidence,"resource-ticket-positions-20261126.json");
	if(process.env.LEAN_BRIDGE_TICKET_AUDIT_OUTPUT)
	{
		const dir=resolve(process.env.LEAN_BRIDGE_TICKET_AUDIT_OUTPUT);await mkdir(dir,{recursive: true});
		await writeFile(join(dir,"resource-ticket-positions-20261126.json"),canonicalJson(out));
	} else assert.deepEqual(out,await readJson(path));
});
