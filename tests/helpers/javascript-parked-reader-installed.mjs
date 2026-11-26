/** @file Distinguish cancelling a JS reader from stopping its noncooperative Lean worker. */
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {testThreadedNpmClients} from "./threaded-npm-consumer-matrix.mjs";

const name="@example/parked-reader";
const cfg={schemaVersion:1,modules:["Reader"],exports:["openCursor","pulls","closes","entered","finished","release","sibling"].map(n=>"Reader."+n),
	taskExports:["Reader.entered","Reader.finished","Reader.sibling"],
	asyncIterators:[{open:"Reader.openCursor",next:"Reader.next",close:"Reader.close"}],nativeEffects:[],targets:{npm:{name,version:"1.0.0"}}};
const check = result => {
	const {whileParked,...rest}=result;
	assert.deepEqual(rest,{successes:0,failures:1,late:73,finalizers:1,live:[0,0,0,0,0]});
	// return() waits on row.drain. While the cancelled pull still owns the
	// sole native worker, drop(row) has not called the Lean cursor finalizer.
	assert.deepEqual(whileParked,{drained:false,pulls:1,closes:0,nativeOwners:1});
};

testThreadedNpmClients({title:"installed npm readers reject delivery while a real Lean pull stays parked",
	fixture:resolve("tests/fixtures/javascript-parked-reader"),cfg,summary:"Closing a reader stops delivery of a pending Lean step.",
	envPrefix:"LEAN_BRIDGE_NPM_PARKED_READER",defaultOutput:"build/npm-parked-reader",check});
