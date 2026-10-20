import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const css=read('b1-site.css'),home=read('pages/B1HomePage.tsx'),screen=read('pages/AlphaScreenPage.tsx'),retail=read('pages/AlphaScreenRetailPages.tsx'),pricing=read('pages/AlphaScreenPricingPage.tsx'),about=read('pages/AboutPage.tsx');
test('public-only navy/lilac tokens, no unscoped dashboard styling',()=>{
 for(const [token,value] of [['lilac','#A380F6'],['lilac-ink','#7657C8'],['navy-page','#050a1f'],['navy-card','#0b1336']])assert.ok(css.includes('--b1-'+token+': '+value));
 assert.match(css,/--as-page: var\(--b1-navy-page\)/);assert.match(css,/--as-surface: var\(--b1-navy-card\)/);
 assert.match(css,/\.b1-page-section/);assert.match(css,/\.public-site-rest\.dark main section\.b1-screen-hero/);
 assert.doesNotMatch(css,/\.public-site-rest\.dark main section \{ background-image: none/);
});
test('plain labels replace only the requested pills',()=>{
 assert.doesNotMatch(home,/Featured solution|className="badge"/);
 assert.equal((about.match(/className="b1-mesh-label mb-5"/g)||[]).length,3);
 assert.doesNotMatch(about,/>\s*About Us\s*</);
 assert.equal((screen.match(/className="b1-eyebrow(?: b1-eyebrow-on-dark)? mb-/g)||[]).length,3);
 assert.match(screen,/b1-explore-links/);assert.match(retail,/!workflow &&/);
 assert.match(retail,/workflow && <span className="b1-patent-text">Patent Pending/);
});
test('About, workflow, FAQ and Support heroes remain navy in both themes',()=>{
 for(const page of ['AboutPage','FaqPage','SupportPage'])assert.match(read('pages/'+page+'.tsx'),/<section className="[^"]*b1-inner-dark-hero/);
 assert.match(retail,/workflow \? "b1-workflow-hero b1-inner-dark-hero" : ""/);
 assert.match(css,/\.public-site-rest\.dark main \.b1-inner-dark-hero \{[\s\S]*?var\(--b1-navy-page\) !important/);
 assert.match(css,/\.b1-inner-dark-hero :is\(h1,\[data-alphascreen-wordmark\]\) \{ color: #fff !important/);
 assert.match(css,/\.b1-inner-dark-hero p \{ color: #c8d3e9 !important/);
});
test('option B preserves actual video attributes without browser chrome',()=>{
 assert.match(screen,/className="b1-video-card"/);assert.match(screen,/className="b1-video-footer/);
 assert.doesNotMatch(screen,/alphaScreen Demo|#FF5F57|#FFBD2E|#28C840/);
 assert.match(screen,/<video[\s\S]*?autoPlay\s+muted\s+loop\s+playsInline/);
 const demoCta=screen.match(/<a[^>]+data-testid="alphascreen-video-demo-cta"/)[0];
 assert.doesNotMatch(demoCta,/bg-\[/,'video CTA must not inherit the legacy dark-mode fill adapter');
 assert.match(screen,/b1-screen-demo-mesh/);assert.match(css,/\.b1-screen-demo-mesh::before \{\s*opacity: \.15; background-size: 420px/);
});
test('mesh exclusions and solid enterprise CTA are explicit in every interaction state',()=>{
 assert.match(css,/\.b1-enterprise-contact:is\(:focus-visible,:active\)[\s\S]*?background: var\(--b1-lilac\) !important; color: var\(--b1-navy-page\) !important/);
 assert.match(css,/\.b1-enterprise-contact:hover \{ background: #956BF2 !important/);
 assert.match(css,/#pricing-demo \.b1-night-band::before \{ content: none/);
 assert.doesNotMatch(pricing,/b1-night-band b1-mesh-panel rounded-3xl/);
 assert.match(home,/screen r b1-mesh-panel b1-mesh-top-right/);
});
test('homepage Meet alphaScreen shares the video glow only in dark mode',()=>{
 const shared=/\.b1-public-scope \.b1-video-card,\s*\.b1-public-scope \.public-site-shell\.dark \.b1-home \.screen \{\s*box-shadow: ([^;]+);/g;
 const shadows=[...css.matchAll(shared)].map(m=>m[1]);
 assert.equal(shadows.length,2,'desktop and mobile share the exact video edge');
 assert.match(shadows[0],/0 0 70px rgba\(150,115,235,\.28\)/);
 assert.match(shadows[1],/0 0 40px rgba\(150,115,235,\.28\)/);
 assert.match(shadows[0],/0 0 0 1px rgba\(127,227,214,\.35\)/);
});
function luminance(hex){return hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0)}
test('lilac pairs and maximum light-label mesh contribution meet AA',()=>{
 const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 for(const [f,b] of [['A380F6','050a1f'],['A380F6','0b1336'],['7657C8','ffffff'],['7657C8','f4f6fb'],['050a1f','A380F6'],['050a1f','956BF2'],['ffffff','0A1547']])assert.ok(ratio(f,b)>=4.5,f+'/'+b);
 // 95% ink-gradient layer covers even an opaque white mesh intersection.
 for(const stop of ['087565','076987']){const max=stop.match(/../g).map(x=>Math.round(parseInt(x,16)*.95+255*.05).toString(16).padStart(2,'0')).join('');assert.ok(ratio(max,'f4f6fb')>=4.5,max)}
});
