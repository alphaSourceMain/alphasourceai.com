import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const page=read("src/pages/AlphaScreenPricingPage.tsx"), css=read("src/b1-site.css"), nav=read("src/components/Navbar.tsx");
test("one static pricing band replaces redundant hero and section header",()=>{
 assert.equal((page.match(/<h1\b/g)||[]).length,1);
 assert.match(page,/<h1 id="pricing-title">Choose the membership that fits your <span className="pr-gt">hiring needs\.<\/span><\/h1>/);
 assert.match(page,/<p className="pr-band__sub">Select Essential or Pro to start membership signup, or choose Enterprise for custom volume and rollout support\.<\/p>/);
 assert.match(page,/<AlphaScreenLockup treatment="teal" wordmarkTone="white"/);
 assert.match(page,/markClassName="h-10 w-10" wordmarkClassName="text-\[38px\]"/);
 assert.match(css,/\.pr-band__wm \[data-alphascreen-wordmark\] \{ color: #fff !important; line-height: 1;/);
 assert.doesNotMatch(page,/AlphaScreenBreathingLockup|Start with the membership|Included interview volume|>Memberships<|pricing-hero/);
 assert.ok(page.indexOf('className="pr-dock"')<page.indexOf('id="packages"'));
 assert.equal((page.match(/setCardCommitmentMonths\(months\)/g)||[]).length,1);
 assert.match(page,/aria-pressed=\{cardCommitmentMonths === months\}/);
 assert.match(page,/commitmentMonths=\{cardCommitmentMonths\}/);
});
test("dock keeps focus, light active palette and structural centering under reduced motion",()=>{
 assert.match(css,/\.pr-dock button:focus-visible \{ outline-color: #087565 !important/);
 assert.match(css,/\.pr-dock button:is\(\[aria-pressed="true"\]/);
 assert.match(css,/main \.pr-dock \{ transform: translate\(-50%,50%\) !important/);
 assert.match(css,/prefers-reduced-motion: reduce\) and \(max-width: 420px\)/);
 assert.match(css,/main \.pr-dock \{ transform: translate\(-50%,60%\) !important/);
 assert.match(css,/#packages \{ padding-top: 80px/);
});
test("only shared header triggers get button texture and preserve it in interaction states",()=>{
 assert.equal((nav.match(/b1-nav-signin/g)||[]).length,2);
 assert.match(css,/\.b1-nav \.b1-nav-signin:is\(:hover,:focus-visible,:active\)/);
 assert.match(css,/background-image: url\(\/brand\/b1\/mesh-btn\.svg\), var\(--b1-g\)/);
 assert.match(css,/\.b1-nav \.b1-nav-signin:focus-visible \{\s*outline: 2px solid #7ef0d0/);
 assert.doesNotMatch(css,/\.b1-btn-g \{[^}]*mesh-btn/);
});
test("new pricing contact panel overrides light-theme utility text on its dark surface",()=>{
 assert.match(css,/#pricing-demo \.b1-night-band h2 \{ color: #fff !important/);
 assert.match(css,/#pricing-demo \.b1-night-band p \{ color: #c8d3e9 !important/);
 assert.match(css,/#pricing-demo \.b1-night-band p:first-child \{ color: #5eead4 !important/);
});
function luminance(hex){const c=hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test("pricing text and header gradient endpoint pairs meet AA",()=>{
 // 25364e conservatively bounds the dark band gradients plus 10% white mesh.
 for(const [text,bg]of [["ffffff","25364e"],["c8d3e9","25364e"],["b3c0dd","25364e"],["22b8e8","25364e"],["22d3b6","25364e"],["087565","ffffff"],["4a5373","f8f9fd"],["ffffff","0a1547"],["050a1f","19e3b1"],["050a1f","18b4f0"]]){
  const a=luminance(text),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,text+"/"+bg);
 }
});
