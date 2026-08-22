/**
 * Configures repository-wide JavaScript style, documentation, globals, and lint exceptions.
 *
 * @file
 */

// @ts-check

import js from '@eslint/js';
import globals from 'globals';
import jsdocPlugin, { jsdoc } from 'eslint-plugin-jsdoc';
import { recommended as smNoSaccadeRecommended } from 'sm-no-saccade-style';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'];
const browserFiles = [
	'demos/lean-dijkstra/{app,runtime,proof-viewer}.mjs'
	, 'scripts/test-browser-package-consumer.mjs'
	, 'tests/fixtures/browser-consumer/**/*.{js,mjs}'
];
const generatedSourceTemplateFiles = [
	'scripts/test-managed-native-bindings.mjs'
	, 'scripts/test-managed-registry-consumers.mjs'
	, 'scripts/test-native-consumers.mjs'
	, 'src/analyze/lean-project.mjs'
	, 'src/backends/c/generate.mjs'
	, 'src/backends/javascript/generate.mjs'
	, 'src/backends/php/php-wasm.mjs'
	, 'src/backends/python/generate.mjs'
	, 'src/backends/rust/generate.mjs'
	, 'tests/documentation.test.mjs'
	, 'tests/release-install-gate.test.mjs'
];
const documentedDeclarationContexts = [
	'ArrowFunctionExpression'
	, 'ClassDeclaration'
	, 'ClassExpression'
	, 'FunctionDeclaration'
	, 'FunctionExpression'
	, 'MethodDefinition'
	, 'PropertyDefinition'
	, 'TSAbstractMethodDefinition'
	, 'TSAbstractPropertyDefinition'
	, 'TSCallSignatureDeclaration'
	, 'TSConstructSignatureDeclaration'
	, 'TSDeclareFunction'
	, 'TSEnumDeclaration'
	, 'TSIndexSignature'
	, 'TSInterfaceDeclaration'
	, 'TSMethodSignature'
	, 'TSModuleDeclaration'
	, 'TSPropertySignature'
	, 'TSTypeAliasDeclaration'
];

const exportedArrowRequirements = {
	ArrowFunctionExpression: true
	, ClassDeclaration: false
	, ClassExpression: false
	, FunctionDeclaration: false
	, FunctionExpression: false
	, MethodDefinition: false
};

export default [
	{
		ignores: [
			'**/node_modules/**'
			, '.codex-sdl-probe.*/**'
			, '.lean-bridge-docker-nix/**'
			, '.toolchains/**'
			, 'build/**'
			, 'coverage/**'
			, 'docs/**'
			, 'demos/lean-dijkstra/runtime/lean-dijkstra.mjs'
			, 'result*/**'
		]
	}
	, js.configs.recommended
	, ...smNoSaccadeRecommended
	, jsdoc({
		config: 'flat/recommended'
		, rules: {
			// Left-rail object commas place member JSDoc between a property colon and its value.
			'jsdoc/check-alignment': 'off'
			, 'jsdoc/require-file-overview': ['error', {
				tags: {
					file: {
						initialCommentsOnly: true
						, mustExist: true
						, preventDuplicates: true
					}
				}
			}]
			, 'jsdoc/no-undefined-types': ['warn', {
				definedTypes: []
			}]
			, 'jsdoc/informative-docs': 'error'
			, 'jsdoc/no-blank-block-descriptions': 'error'
			, 'jsdoc/no-blank-blocks': 'error'
			, 'jsdoc/reject-any-type': 'off'
			, 'jsdoc/require-description': ['error', {
				contexts: documentedDeclarationContexts
			}]
			, 'jsdoc/require-description-complete-sentence': 'error'
			, 'jsdoc/require-param-description': 'error'
			, 'jsdoc/require-param-type': 'off'
			, 'jsdoc/require-returns': 'off'
			, 'jsdoc/require-yields': 'off'
			, 'jsdoc/tag-lines': ['error', 'never', {
				startLines: 1
			}]
			, 'jsdoc/require-jsdoc': ['error', {
				checkAllFunctionExpressions: true
				, enableFixer: false
				, exemptEmptyConstructors: false
				, exemptEmptyFunctions: false
				, require: {
					ArrowFunctionExpression: false
					, ClassDeclaration: true
					, ClassExpression: true
					, FunctionDeclaration: true
					, FunctionExpression: true
					, MethodDefinition: true
				}
				, contexts: [
					'PropertyDefinition'
					, 'TSAbstractMethodDefinition'
					, 'TSAbstractPropertyDefinition'
					, 'TSCallSignatureDeclaration'
					, 'TSConstructSignatureDeclaration'
					, 'TSDeclareFunction'
					, 'TSEnumDeclaration'
					, 'TSIndexSignature'
					, 'TSInterfaceDeclaration'
					, 'TSMethodSignature'
					, 'TSModuleDeclaration'
					, 'TSPropertySignature'
					, 'TSTypeAliasDeclaration'
				]
			}]
		}
	})
	, {
		plugins: {
			'jsdoc-exported-arrow': jsdocPlugin
		}
		, rules: {
			'jsdoc-exported-arrow/require-jsdoc': ['error', {
				enableFixer: false
				, publicOnly: {
					ancestorsOnly: false
					, cjs: true
					, esm: true
					, window: false
				}
				, require: exportedArrowRequirements
			}]
		}
	}
	, {
		files: sourceFiles
		, languageOptions: {
			ecmaVersion: 'latest'
			, globals: {
				...globals.nodeBuiltin
			}
			, sourceType: 'module'
		}
	}
	, {
		files: ['**/*.{cjs,cts}']
		, languageOptions: {
			globals: {
				...globals.node
			}
			, sourceType: 'commonjs'
		}
	}
	, {
		files: browserFiles
		, languageOptions: {
			globals: {
				...globals.browser
				, ...globals.worker
			}
		}
	}
	, {
		files: generatedSourceTemplateFiles
		, rules: {
			// These files contain source text for other languages and runtimes.
			'no-useless-escape': 'off'
		}
	}
	, {
		files: ['src/adoption/toolchain-preflight.mjs']
		, rules: {
			// TypeScript validates the richer checked-JavaScript types used by this module.
			'jsdoc/no-undefined-types': 'off'
			, 'jsdoc/valid-types': 'off'
		}
	}
];
