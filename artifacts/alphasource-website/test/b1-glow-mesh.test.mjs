import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const home=read("src/pages/B1HomePage.tsx"),css=read("src/pages/b1-home.css"),site=read("src/b1-site.css");

test("approved glow and mesh assets are byte-identical supplied artwork",()=>{
 for(const [name,hash] of [["alpha-v4.svg","4d3e4bfeec838983c938fa501b793dcecf104cb67de260be5a09fce78192c551"],["mesh-text.svg","4697c13abb68a9494e69a16ea6452025fcc5f3e83f565de75d1f45e6c15c7cc5"],["mesh-btn.svg","73c632192153a15d1d3a86618e9e4a45e8f50565995806b47570cf4f886c1b09"]]){
   const asset=read("public/brand/b1/"+name);
   assert.equal(createHash("sha256").update(asset).digest("hex"),hash);
   assert.doesNotMatch(asset,/<script\b|<foreignObject\b|(?:href|src)=["'](?:https?:|data:|javascript:)/i);
 }
});
test("hero artwork is stationary, decorative and uses the supplied layered alpha",()=>{
 assert.match(home,/className="as-alpha" aria-hidden="true"/);
 assert.equal((home.match(/src="\/brand\/b1\/alpha-v4\.svg"/g)||[]).length,3);
 assert.match(home,/className="as-alpha-mark"[^>]*fetchPriority="high"/);
 assert.doesNotMatch(home,/className="mark"|AI-powered solutions/);
 assert.doesNotMatch(css,/b1-float/);
 assert.match(css,/\.b1-home \.b1-hero-surface \{ overflow: visible; \}/);
 assert.match(css,/\.b1-home \{ overflow-x: clip; \}/);
});
test("only counter-transforms animate during the soft 5.5 second sweep",()=>{
 for(const name of ["win","in"]){
   assert.ok(css.includes(`animation: as-sweep-${name} 5.5s ease-in-out infinite`));
   const frames=css.match(new RegExp(`@keyframes as-sweep-${name} \\{([^\\n]+)\\}`))?.[1];
   assert.ok(frames);
   assert.doesNotMatch(frames,/filter|mask|background|shadow|width|height|left|top|opacity/);
 }
 assert.match(css,/as-alpha-glow--base \{ opacity: \.2; \}/);
 assert.match(css,/inset: -140px; overflow: hidden; opacity: \.6/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{\s*\.b1-home \.as-alpha-sweep \{ display: none; \}\s*\.b1-home \.as-alpha-glow--base \{ opacity: \.4; \}/);
});
test("mesh remains confined to approved hero, panels and public404 surfaces",()=>{
 assert.match(css,/--g: linear-gradient\(120deg, #19e3b1, #18b4f0\)/);
 assert.match(css,/\.b1-home header\.hero \.gt \{\s*background-image: url\(\/brand\/b1\/mesh-text\.svg\), var\(--g\)/);
 assert.match(css,/\.b1-home header\.hero \.btn-g \{\s*background-image: url\(\/brand\/b1\/mesh-btn\.svg\), var\(--g\)/);
 assert.match(site,/\.b1-public-scope \.b1-mesh-panel::before/);
 assert.match(site,/z-index: -1; pointer-events: none/);
 assert.match(site,/opacity: \.10/);
 assert.doesNotMatch(site,/\.b1-night-band::before/);
 assert.match(site,/\.b1-public-scope \.not-found-page \.text-8xl/);
 assert.match(site,/linear-gradient\(90deg,#22D3B6,#22B8E8\)/);
 assert.equal((home.match(/b1-mesh-panel/g)||[]).length,1);
 for(const name of ["AboutPage","AlphaScreenPage","AlphaScreenPricingPage"])
   assert.equal((read("src/pages/"+name+".tsx").match(/b1-mesh-panel/g)||[]).length,1);
});
