/**
 * Introduce the bridge and its executable, inspectable algorithm collection.
 *
 * @file
 */

import { Link } from "react-router";
import { DemoCards } from "../components/DemoCards";

/** Describe the prerendered landing page. */
export const meta = () => [{ title: "Lean Bridge | Checked Lean, ordinary application code" }, { name: "description", content: "Run verified algorithms, inspect their Lean proofs, and learn how to package and consume Lean code." }];

/** Show audience-specific entry points without loading an algorithm runtime. */
export default function Home()
{
	return <main className="site-main home-page" id="main-content">
		<header className="home-hero"><p className="eyebrow">Lean 4 → WebAssembly</p><h1>Prove it in Lean.<br /><em>Use it in your application.</em></h1>
			<p className="lede">Compile checked Lean code for other languages. Explore the working demos, inspect their proofs, and follow the path from a Lean library to a downstream package.</p>
			<div className="hero-actions"><Link className="action-link" to="/demos/">Explore the demos →</Link><Link className="text-link" to="/docs/">Read the documentation →</Link></div>
		</header>
		<section className="audience-section" aria-labelledby="start-title"><div className="section-heading"><p className="eyebrow">Choose your workflow</p><h2 id="start-title">Build a package or use one.</h2></div>
			<div className="three-up workflow-cards"><Link to="/docs/lean/"><span className="card-number">01 / Build and publish</span><h3>Share your Lean library</h3><p>Create a library or adapt an existing one, check its proofs, and publish packages for other languages.</p><span className="text-link">Build and publish a package →</span></Link>
				<Link to="/docs/consume/"><span className="card-number">02 / Use a package</span><h3>Use it in your application</h3><p>Install a published package with your language’s tools, import its API, and call it from your application.</p><span className="text-link">Use a published package →</span></Link></div>
		</section>
		<section className="business-explainer" aria-labelledby="business-title"><div className="section-heading"><p className="eyebrow">What the proofs change</p><h2 id="business-title">Lean checks the core before the browser runs it.</h2></div>
			<div className="explainer-points three-up"><article><h3>Lean rejects changes that break a proof</h3><p>When a code change invalidates a proof, Lean reports an error. The build stops before producing the demo artifact.</p><Link to="/docs/concepts/change-risk/">See a rejected change →</Link></article><article><h3>Reviewers can trace each claim</h3><p>Each demo names its guarantees and exposes the Lean source, theorem names, source hashes, and build receipt.</p><Link to="/docs/concepts/auditable-claims/">Audit a claim →</Link></article><article><h3>The browser uses generic cores</h3><p>The Lean APIs accept graphs, sequences, requests, or boxes. JavaScript turns each interactive example into inputs for its reusable core.</p><Link to="/docs/concepts/reusable-cores/">Reuse a core →</Link></article></div>
			<p className="explainer-summary">Tests check selected inputs and outputs. These demos add Lean proofs for named properties of each core algorithm. The build checks those proofs before compiling the same Lean implementation to WebAssembly.</p>
			<p className="concept-links"><Link to="/docs/concepts/">Explore the concepts →</Link><Link to="/docs/concepts/benchmarks/">Read the benchmarks →</Link><Link to="/docs/concepts/adoption/">Plan an adoption →</Link></p>
		</section>
		<section aria-labelledby="gallery-title"><div className="section-heading"><p className="eyebrow">Run and inspect</p><h2 id="gallery-title">Verified demos</h2><p>Change the inputs. Watch the result. Read the proof behind it.</p></div><DemoCards /></section>
	</main>;
}
