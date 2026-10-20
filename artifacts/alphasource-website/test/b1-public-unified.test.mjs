import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const nav=read("src/components/Navbar.tsx"), footer=read("src/components/Footer.tsx");
const site=read("src/b1-site.css");
test("shared navigation has all eight destinations and no header logo",()=>{
 for(const [label,href] of [["Home","/"],["About","/about/"],["alphaScreen","/alphascreen"],["How It Works","/alphascreen/how-it-works"],["Pricing","/alphascreen/pricing"],["FAQ","/faq"],["Support","/support"],["Get in touch","/#contact"]])
   assert.ok(nav.includes(JSON.stringify(label)+", href: "+JSON.stringify(href)));
 assert.doesNotMatch(nav,/<img|nav-logo/);
 assert.match(nav,/<PublicSignInPanel/); assert.match(footer,/<PublicSignInPanel/);
 const panel=read("src/components/PublicSignInPanel.tsx");
 assert.match(panel,/@radix-ui\/react-dialog/); assert.match(panel,/onCloseAutoFocus/);
 assert.doesNotMatch(panel,/supabase|loginAdmin|resetPasswordForEmail/);
});
test("existing auth methods, redirect builders and recovery calls remain in their owners",()=>{
 for(const call of ["await login(normalizedEmail, password)","await loginWithPasskey()",'buildPwResetUrl({ origin: "client" })',"supabase.auth.resetPasswordForEmail"])assert.ok(nav.includes(call));
 for(const call of ["await loginAdmin(normalizedEmail, password)",'buildPwResetUrl({ origin: "admin" })',"supabase.auth.resetPasswordForEmail"])assert.ok(footer.includes(call));
 assert.match(nav,/get\("signin"\) === "client"/); assert.match(footer,/get\("signin"\) === "admin"/);
});
test("all SPA document routes retain exact and trailing-slash host rewrites without a catch-all",()=>{
 const m=JSON.parse(read("render-routes.json"));
 assert.equal(m.catchAll,null);
 const rules=[...m.publicRedirects,...m.publicRewrites,...m.spaShellRewrites,...m.dynamicSpaRewrites];
 const known=new Set(["/",...rules.map(x=>x.source)]);
 const source=read("src/App.tsx")+read("src/pages/sales/SalesApp.tsx");
 for(const [,path] of source.matchAll(/<Route path="([^"]+)"/g)){
   assert.ok(known.has(path),"missing "+path);
   if(path!=="/")assert.ok(known.has(path.replace(/\/$/,"")+"/"),"missing slash "+path);
 }
 assert.ok(rules.every(x=>!x.source.includes("*")),"unknown nested paths must not get catch-all 200");
 assert.match(read("scripts/verify-routes.mjs"),/Unknown routes must not be rewritten to HTTP 200/);
 assert.match(read("scripts/prerender-public-routes.mjs"),/"404.html"/);
});
test("public motion is fail-open without flattening disabled or decorative opacity",()=>{
 assert.doesNotMatch(site,/\[style\*="opacity:"\]/);
 for(const name of ["AboutPage","FaqPage","SupportPage","AlphaScreenPage","AlphaScreenRetailPages","PrivacyPage","TermsPage"])
   assert.doesNotMatch(read("src/pages/"+name+".tsx"),/opacity:\s*0\b/);
 assert.match(site,/prefers-reduced-motion/);
 assert.match(site,/\.b1-public-scope \.dark \.dark\\:bg-/);
});
function luminance(hex){const c=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test("B1 text and placeholder tokens meet AA at their light and dark surfaces",()=>{
 for(const [text,bg]of [["4a5373","ffffff"],["4a5373","f4f6fb"],["076987","f4f6fb"],["b3c0dd","101a38"],["b3c0dd","050a1f"],["7ef0d0","0b1336"],["f8fafc","0b1336"]]){
 const a=luminance(text),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,text+"/"+bg);
 }
});

test("legacy accent utility mappings use the theme-aware public token",()=>{
 assert.ok(site.includes("color: var(--as-accent) !important;"));
 assert.doesNotMatch(site,/color: #076987 !important/);
 assert.match(site,/--as-accent: #7ef0d0/);
});
