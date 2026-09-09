/**
 * Introduce the bridge and its executable, inspectable algorithm collection.
 *
 * @file
 */

import { Link } from "react-router";
import { DemoCards } from "../components/DemoCards";

/** Describe the prerendered landing page. */
export const meta = () => [{ title: "Lean Bridge | Checked Lean, ordinary application code" }, { name: "description", content: "Run twelve verified algorithms, inspect their Lean proofs, and learn how to package and consume Lean code." }];

/** Show audience-specific entry points without loading an algorithm runtime. */
export default function Home()
{
	return <main className="site-main home-page" id="main-content">
		<header className="home-hero"><p className="eyebrow">Lean 4 → WebAssembly</p><h1>Prove it in Lean.<br /><em>Use it in your application.</em></h1>
			<p className="lede">Compile checked Lean code for other languages. Explore twelve working algorithms, inspect their proofs, and follow the path from a Lean library to a downstream package.</p>
			<div className="hero-actions"><Link className="action-link" to="/demos/">Explore the demos →</Link><Link className="text-link" to="/docs/">Read the documentation →</Link></div>
		</header>
		<section className="audience-section" aria-labelledby="start-title"><div className="section-heading"><p className="eyebrow">Choose your starting point</p><h2 id="start-title">One library. Three perspectives.</h2></div>
			<div className="three-up"><Link to="/docs/lean/"><span className="card-number">01 / Author</span><h3>I write Lean</h3><p>Check a theorem, choose supported exports, and build a package from your Lean project.</p><span className="text-link">Package a Lean library →</span></Link>
				<Link to="/docs/consume/"><span className="card-number">02 / Consume</span><h3>I build applications</h3><p>Find the supported runtime for your language and call a Lean package from application code.</p><span className="text-link">Use a Lean package →</span></Link>
				<Link to="/docs/publish/"><span className="card-number">03 / Publish</span><h3>I ship libraries</h3><p>Follow package preparation, checks, receipts, and the supported publication flow.</p><span className="text-link">Follow the release pipeline →</span></Link></div>
		</section>
		<section className="business-explainer" aria-labelledby="business-title"><div className="section-heading"><p className="eyebrow">What the proofs change</p><h2 id="business-title">Lean checks the core before the browser runs it.</h2></div>
			<div className="explainer-points three-up"><article><h3>Lean rejects changes that break a proof</h3><p>When a code change invalidates a proof, Lean reports an error. The build stops before producing the demo artifact.</p><Link to="/docs/concepts/change-risk/">See a rejected change →</Link></article><article><h3>Reviewers can trace each claim</h3><p>Each demo names its guarantees and exposes the Lean source, theorem names, source hashes, and build receipt.</p><Link to="/docs/concepts/auditable-claims/">Audit a claim →</Link></article><article><h3>The browser uses generic cores</h3><p>The Lean APIs accept graphs, sequences, requests, or boxes. JavaScript turns each interactive example into inputs for its reusable core.</p><Link to="/docs/concepts/reusable-cores/">Reuse a core →</Link></article></div>
			<p className="explainer-summary">Tests check selected inputs and outputs. These demos add Lean proofs for named properties of each core algorithm. The build checks those proofs before compiling the same Lean implementation to WebAssembly.</p>
			<p className="concept-links"><Link to="/docs/concepts/">Explore the concepts →</Link><Link to="/docs/concepts/benchmarks/">Read the benchmarks →</Link><Link to="/docs/concepts/adoption/">Plan an adoption →</Link></p>
		</section>
		<section aria-labelledby="gallery-title"><div className="section-heading"><p className="eyebrow">Run and inspect</p><h2 id="gallery-title">Verified demos</h2><p>Change the inputs. Watch the result. Read the proof behind it.</p></div><DemoCards /></section>
	</main>;
}
