/** @file Match Perl and native PHP task clients, parked pulls and release records. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";

const read = async path => JSON.parse(await readFile(join("docs/evidence",path+".json")));
const digest = async path => sha256(await readFile(join("tests/fixtures",path)));
const routes = ["ordinary","reviewed"];
const matchFiles = async (dir, record, names) => {
	for(const name of names) assert.equal(record.sources[name],await digest(dir+"/"+name),dir+"/"+name);
};
const keyset = (rows, select, expected) => assert.deepEqual(rows.map(select).sort(),[...expected].sort());
const hash = /^[0-9a-f]{64}$/u;

test("both CPAN routes match the actual task, retained callback and competing-reader clients on four ABIs",async () => {
	const pulse=await read("perl-tasks-20261123"),relay=await read("perl-retained-workers-20261123");
	await matchFiles("perl-tasks",pulse,["installed.t","example.pl","peer.t","retired.t","affinity.t"]);
	await matchFiles("perl-retained-tasks",relay,["installed.t","example.pl","compose.t","registration.t","retired.t"]);
	for(const record of [pulse,relay]) await matchFiles("perl-sync-io",record,["Observe.xs","build-observer.pl"]);
	assert.deepEqual(pulse.sharedRuntime,relay.sharedRuntime);
	const abis=["5.36.3/0","5.36.3/1","5.38.2/0","5.38.2/1"];
	for(const route of routes) {
		const parked=await read("perl-parked-pull-20261126/"+route);
		assert.equal(parked.clientSha256,await digest("perl-tasks/parked.pl")); assert.equal(parked.route,route);
		assert.equal(parked.packageSetSha256,pulse.packages.find(p=>p.route===route).receiptSha256);
		assert.equal(parked.peerPackageSetSha256,pulse.packages.find(p=>p.route==="peer").receiptSha256);
		assert.equal(parked.sharedRuntimeSha256,pulse.sharedRuntime.sha256);
		const interpKey=r=>r.version+"/"+Number(r.arch.endsWith("thread-multi"));
		keyset(parked.interpreters,interpKey,abis);
		for(const record of [pulse,relay]) {
			const pkg=record.packages.find(p=>p.route===route), rows=record.rows.filter(r=>r.route===route);
			assert.match(pkg.receiptSha256,hash); assert.equal(Boolean(pkg.reviewedSourceSha256),route==="reviewed");
			assert.equal(pkg.profile.id,"native-perl-task-v1");
			const rowKey=r=>r.version+"/"+r.threaded;
			keyset(rows,rowKey,abis);
			for(const row of rows) {
				const counts=Object.fromEntries(Object.entries(row.observations).map(([k,v])=>[k,v.tests]));
				for(const field of Object.values(row.observations)) assert.match(field.tapSha256,hash);
				if(record===relay) {
					assert.deepEqual(counts,{"primary-first":8,"relay-first":8,registration:18,public:66,retirement:6});
					assert.match(row.installedXsSha256,hash); continue;
				}
				assert.deepEqual(counts,{affinity:12,"peer-first":13,"pulse-first":13,public:130,retirement:8});
				const run=parked.interpreters.find(p=>interpKey(p)===rowKey(row));
				assert.equal(run.xs.pulse,row.installedXsSha256);
				const outcome="blocked pull: reader cancel and cursor close each finalized once; usable peer, no late value, zero live owners and descriptor delta";
				assert.deepEqual(run.checks,{"pulse-first":outcome,"peer-first":outcome});
			}
		}
	}
});

test("both native Composer routes cover task settlement, callback failure, iterator ownership and cancelling a blocked read",async () => {
	const tasks=await read("php-task-delivery-20261123"),callbacks=await read("php-retained-tasks-20261123");
	const leases=await read("php-task-leases-20261123"), phps=["8.2.35","8.5.10"];
	for(const [record,dir] of [[tasks,"php-tasks"],[callbacks,"php-retained-tasks"],[leases,"php-task-resources"]]) {
		await matchFiles(dir,record,["installed.php","shutdown.php","example.php"]);
		assert.deepEqual(record.scheduler,tasks.scheduler);
	}
	const checkOrders=(rows,first)=>keyset(rows,r=>r.php+"/"+r.order,phps.flatMap(p=>[p+"/"+first,p+"/peer-first"]));
	for(const route of routes) {
		for(const record of [tasks,callbacks]) {
			const pkg=record.packages[route],rows=record.reports.filter(r=>r.route===route);
			keyset(rows,r=>r.php,phps); assert.match(pkg.archive.sha256,hash);
			assert.notEqual(pkg.receiptSha256,record.packages[route==="reviewed"?"ordinary":"reviewed"].receiptSha256);
			for(const r of rows) {
				assert.equal(r.receipt,pkg.receiptSha256); assert.ok(r.example && r.shutdown); assert.equal(r.live,0);
				if(record===tasks) assert.equal(r.checks,r.php==="8.2.35"?92:90);
				else { assert.equal(r.checks,66); assert.equal(r.fdDelta,0); }
			}
		}
		const owners=leases.reports.filter(r=>r.route===route);
		checkOrders(owners,"depot-first");
		for(const r of owners) {
			assert.equal(r.checks,59); assert.equal(r.descriptorDelta,0); assert.deepEqual(r.final,[3,1,3,0]);
			assert.ok(r.shutdown && r.modifiedLedgerRefused);
		}
		// This gated Pulse is a different build of the author fixture. Do not
		// equate its receipts with those of the scalar and leased task packages.
		const parked=await read("php-parked-pull-20261126/"+route);
		assert.equal(parked.route,route); assert.deepEqual(parked.scheduler,tasks.scheduler);
		assert.equal(parked.clientSha256,await digest("php-tasks/parked.php"));
		assert.deepEqual(parked.packages.map(p=>p.name),["lean-bridge/pulse","lean-bridge/signals"]);
		for(const p of parked.packages) { assert.match(p.receiptSha256,hash); assert.match(p.archive.sha256,hash); }
		checkOrders(parked.results,"pulse-first");
		for(const r of parked.results) {
			assert.equal(r.owners,0); assert.equal(r.fdDelta,0);
			const outcome={closes:1,items:0,peer:42,pulls:1};
			assert.deepEqual(r.paths,{token:outcome,close:outcome});
		}
	}
});
