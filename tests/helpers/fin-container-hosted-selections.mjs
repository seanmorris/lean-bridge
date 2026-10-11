/**
 * Original hosted jobs, artifacts and mandatory Fin selections at one integration revision.
 *
 * @file
 */
export const finHostedRevision = "20539c53406f365d90e07251fd141c14ebf5fb0e";
export const finHostedRun = 38111996698;
export const finHostedRoot = "docs/evidence/fin-container-hosted-20261011";
export const finHostedJobs = Object.freeze([
	{ lane: "c-family", jobId: 114389301545, artifactId: 11699645419, name: "Native consumer (c-family)", sha256: "e75fc06d90ae7ac118194c14ffc9fab2bb1725c23f84b113284fb91c57156311" }
	, { lane: "python", jobId: 114389301525, artifactId: 11695444154, name: "Native consumer (python)", sha256: "a3db71054839f666fede5866ae8e93c75d2e931b6ac47ac046b2ca1fbbf43e60" }
	, { lane: "rust", jobId: 114389301830, artifactId: 11695830524, name: "Native consumer (rust)", sha256: "14401d19428c6ae55f216da2547c0d312f2541c5f64307d38e4d22d0d7852afa" }
	, { lane: "ruby", jobId: 114389301586, artifactId: 11695658633, name: "Managed consumer (ruby)", sha256: "a4d07a03723d94a0b02f01dd3f71f2da146aa6d1e5949b4b6b71117532a6552b" }
	, { lane: "dotnet", jobId: 114389301516, artifactId: 11697523086, name: "Managed consumer (dotnet)", sha256: "2d21f32a2537d76daaccc2b41740335d492874f8f17a5405445d09b5259b6f9b" }
	, { lane: "jvm", jobId: 114389301495, artifactId: 11696388251, name: "Managed consumer (jvm)", sha256: "e6673f45f2fd2af6ad0d53c90e58bd1b4e45dd35f0108c18d8b5326e00cf0c85" }
	, { lane: "php-native", jobId: 114389301536, artifactId: 11693819670, name: "Native PHP", sha256: "65bdfe6f50cdfb62617e2a11b86dc1b44be5ef7be28538716ab37cbab566b265" }
	, { lane: "wit-wasi", jobId: 114389301742, artifactId: 11696564930, name: "WIT and WASI Component Model", sha256: "627f83167f7034320f3c32870a42c5312d8b5d004636123925a96ad989fd0d4e" }
]);
export const finHostedSelections = Object.freeze([
	{ lane: "c-family", label: "c-family", profiles: ["c", "cpp"], edge: "c-cpp" }
	, { lane: "python", label: "python311", profiles: ["python"], edge: "python311", python: "3.11" }
	, { lane: "python", label: "python312", profiles: ["python"], edge: "python312", python: "3.12" }
	, { lane: "rust", label: "rust", profiles: ["rust"], edge: "rust" }
	, { lane: "ruby", label: "ruby", profiles: ["ruby"], edge: "ruby" }
	, { lane: "dotnet", label: "dotnet", profiles: ["dotnet"], edge: "dotnet" }
	, { lane: "jvm", label: "jvm", profiles: ["java", "kotlin"], edge: "java-kotlin" }
	, { lane: "php-native", label: "php-native", profiles: ["php-native"], edge: "php-native" }
	, { lane: "wit-wasi", label: "wit-wasi", profiles: ["wit-wasi"], edge: "wit-wasi" }
]);
