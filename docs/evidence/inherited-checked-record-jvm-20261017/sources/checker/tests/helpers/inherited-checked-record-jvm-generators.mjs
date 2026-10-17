/**
 * Reuse the closed historical JVM generator loader under the inherited-record
 * evidence vocabulary.
 *
 * @file
 */
import {
	nominalSubtypeJvmGenerator
	, nominalSubtypeJvmOriginal
} from "./nominal-subtype-jvm-generators.mjs";

export {
	nominalSubtypeJvmGenerator as inheritedCheckedRecordJvmGenerator
	, nominalSubtypeJvmOriginal as inheritedCheckedRecordJvmOriginal
};
