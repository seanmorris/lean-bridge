/**
 * Keep installed native package receipts bound to the compiler-derived IR
 * while independently checking that it reconciles with reviewed metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertCheckedRecordValueIndexNativeInstalledBindingIr
} from "./checked-record-value-index-native-report.mjs";

const reviewed = "25831177b6b96d1bdbfaa485f828aeaefa6f8d0c574deccde5f6381a8d61ff3d";
const compiled = "00475d60226741e6a96cdc23948945de45eac560b9f64e938ace4d9ec7aa0576";

test("native installed packages retain the compiler IR after reviewed reconciliation"
	, () => {
		const report = {
			expectedBindingIrSha256: reviewed
			, builds: [
				{ bindingIrSha256: compiled }, { bindingIrSha256: compiled }
			]
		};
		assert.notEqual(report.expectedBindingIrSha256, compiled);
		assert.doesNotThrow(() => assertCheckedRecordValueIndexNativeInstalledBindingIr(
			{ bindingIrSha256: compiled }, report, "c"
		));
		assert.throws(() => assertCheckedRecordValueIndexNativeInstalledBindingIr(
			{ bindingIrSha256: reviewed }, report, "c"
		), /installed compiler Binding IR/u);
		assert.throws(() => assertCheckedRecordValueIndexNativeInstalledBindingIr(
			{ bindingIrSha256: compiled }, {
				...report, builds: [{ bindingIrSha256: compiled }
					, { bindingIrSha256: reviewed }]
			}, "cpp"
		), /Reproducible native Binding IR/u);
	}
);
