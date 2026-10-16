/** Menu styles. System fonts only (COEP blocks Google Fonts): Bahnschrift on Windows, DIN/condensed fallbacks elsewhere. */
export const MENU_CSS = `
#menu{--ink:#eef0ea;--dim:#a8b0a6;--faint:#6d756c;--accent:#d9a441;--glass:rgba(12,15,14,.72);--line:rgba(238,240,234,.12);
 --display:"Bahnschrift","DIN Alternate","DIN Condensed","Barlow Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif;
 --text:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif;
 position:fixed;inset:0;z-index:20;color:var(--ink);font-family:var(--text);pointer-events:auto;
 opacity:1;transition:opacity .6s ease, visibility 0s linear 0s;user-select:none}
#menu.hidden{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .5s ease, visibility 0s linear .5s}
#menu .mn-vignette{position:absolute;inset:0;pointer-events:none;
 background:radial-gradient(120% 90% at 65% 45%,transparent 35%,rgba(5,7,6,.55) 75%,rgba(5,7,6,.85) 100%),
 linear-gradient(90deg,rgba(6,8,7,.78) 0%,rgba(6,8,7,.45) 30%,transparent 55%)}
#menu.is-paused .mn-vignette{background:radial-gradient(120% 90% at 65% 45%,rgba(5,7,6,.35) 20%,rgba(5,7,6,.8) 100%),
 linear-gradient(90deg,rgba(6,8,7,.85) 0%,rgba(6,8,7,.55) 35%,rgba(6,8,7,.25) 60%);backdrop-filter:blur(3px) saturate(.7)}
#menu .mn-left{position:absolute;left:clamp(24px,7vw,120px);top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:clamp(24px,5vh,56px);max-width:440px}
#menu .mn-kicker{font:600 12px/1 var(--display);letter-spacing:.32em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:12px}
#menu .mn-kicker span{display:inline-block;width:28px;height:2px;background:var(--accent)}
#menu h1{margin:14px 0 10px;font:700 clamp(54px,9vw,112px)/.86 var(--display);font-stretch:condensed;letter-spacing:.01em;text-transform:uppercase;
 color:var(--ink);text-shadow:0 2px 30px rgba(0,0,0,.45)}
#menu .mn-sub{font-size:15px;color:var(--dim);letter-spacing:.01em}
#menu .mn-paused{display:none;margin-top:16px;font:600 13px/1 var(--display);letter-spacing:.4em;text-transform:uppercase;color:var(--ink);
 padding:8px 12px;border:1px solid var(--line);width:max-content}
#menu.is-paused .mn-paused{display:block}
#menu.is-paused h1{font-size:clamp(40px,6vw,72px)}
#menu .mn-nav{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
#menu .mn-btn{position:relative;font:600 22px/1 var(--display);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);
 background:none;border:0;padding:12px 0 12px 0;cursor:pointer;transition:color .18s ease,padding .22s cubic-bezier(.2,.7,.2,1)}
#menu .mn-btn::before{content:"";position:absolute;left:0;top:50%;width:0;height:2px;background:var(--accent);transform:translateY(-50%);
 transition:width .22s cubic-bezier(.2,.7,.2,1)}
#menu .mn-btn:hover,#menu .mn-btn:focus-visible,#menu .mn-btn.active{color:var(--ink);padding-left:30px;outline:none}
#menu .mn-btn:hover::before,#menu .mn-btn:focus-visible::before,#menu .mn-btn.active::before{width:18px}
#menu .mn-btn.primary{color:var(--ink);font-size:30px;margin-bottom:6px}
#menu .mn-btn.primary::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:1px;background:linear-gradient(90deg,var(--accent),transparent);opacity:.6}
#menu .mn-btn.quiet{font-size:16px;color:var(--faint);margin-top:14px}
#menu .mn-btn.quiet:hover{color:var(--ink)}
#menu .mn-btn.small{font-size:13px;margin-top:18px}
#menu .mn-panel{position:absolute;right:clamp(16px,5vw,80px);top:50%;transform:translateY(-50%);width:min(520px,calc(100vw - 32px));max-height:min(78vh,720px);
 display:flex;flex-direction:column;background:var(--glass);border:1px solid var(--line);border-radius:4px;backdrop-filter:blur(14px) saturate(1.1);
 box-shadow:0 30px 80px rgba(0,0,0,.45);opacity:0;translate:16px 0;transition:opacity .25s ease,translate .3s cubic-bezier(.2,.7,.2,1)}
#menu .mn-panel[hidden]{display:none}
#menu .mn-panel.in{opacity:1;translate:0 0}
#menu .mn-panel header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid var(--line)}
#menu .mn-panel h2{margin:0;font:600 18px/1 var(--display);letter-spacing:.24em;text-transform:uppercase}
#menu .mn-x{background:none;border:1px solid var(--line);color:var(--dim);width:30px;height:30px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer}
#menu .mn-x:hover{color:var(--ink);border-color:var(--accent)}
#menu .mn-body{padding:14px 22px 22px;overflow:auto;scrollbar-width:thin;scrollbar-color:#4a524a transparent}
#menu .mn-stations{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#menu .mn-btn.station{font-size:15px;letter-spacing:.12em;text-align:left;padding:16px 14px;border:1px solid var(--line);border-radius:3px;background:rgba(255,255,255,.02)}
#menu .mn-btn.station:hover{padding-left:14px;border-color:var(--accent);background:rgba(217,164,65,.08)}
#menu .mn-btn.station::before{display:none}
#menu .mn-controls{columns:2 200px;column-gap:28px}
#menu .mn-controls>div{break-inside:avoid;margin-bottom:16px}
#menu .mn-controls h3{margin:0 0 6px;font:600 12px/1 var(--display);letter-spacing:.28em;text-transform:uppercase;color:var(--accent)}
#menu .mn-controls .row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 0;font-size:13.5px;color:var(--dim);border-bottom:1px solid rgba(255,255,255,.04)}
#menu kbd{font:600 11.5px/1 var(--display);letter-spacing:.06em;color:var(--ink);padding:4px 7px;border:1px solid var(--line);border-bottom-width:2px;border-radius:3px;background:rgba(255,255,255,.04);white-space:nowrap}
#menu .mn-settings .row{display:grid;grid-template-columns:150px 1fr 54px;align-items:center;gap:14px;padding:10px 0;font-size:14px;color:var(--dim);border-bottom:1px solid rgba(255,255,255,.05)}
#menu .mn-settings output{text-align:right;font:600 14px/1 var(--display);color:var(--ink);letter-spacing:.04em}
#menu input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;height:20px;cursor:pointer}
#menu input[type=range]::-webkit-slider-runnable-track{height:2px;background:linear-gradient(90deg,var(--accent),rgba(238,240,234,.25))}
#menu input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-6px;border-radius:50%;background:var(--ink);border:2px solid var(--accent)}
#menu input[type=range]::-moz-range-track{height:2px;background:rgba(238,240,234,.25)}
#menu input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--ink);border:2px solid var(--accent)}
#menu .toggle{cursor:pointer}
#menu .toggle input{position:absolute;opacity:0;pointer-events:none}
#menu .toggle i{grid-column:3;justify-self:end;width:38px;height:20px;border-radius:10px;background:rgba(255,255,255,.12);position:relative;transition:background .2s}
#menu .toggle i::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--dim);transition:transform .2s,background .2s}
#menu .toggle input:checked+i{background:rgba(217,164,65,.45)}
#menu .toggle input:checked+i::after{transform:translateX(18px);background:var(--ink)}
#menu .toggle input:focus-visible+i{outline:1px solid var(--accent)}
#menu .mn-tip{position:absolute;left:clamp(24px,7vw,120px);right:clamp(24px,7vw,120px);bottom:clamp(20px,5vh,44px);display:flex;gap:14px;align-items:baseline;
 font-size:14px;color:var(--dim);max-width:760px}
#menu .mn-tip b{font:600 11px/1 var(--display);letter-spacing:.3em;text-transform:uppercase;color:var(--accent);flex:none}
#menu .mn-tip span{opacity:0;transform:translateY(4px);transition:opacity .35s ease,transform .35s ease}
#menu .mn-tip span.in{opacity:1;transform:none}
#menu .mn-ver{position:absolute;right:16px;bottom:12px;font:500 11px/1 var(--display);letter-spacing:.18em;color:var(--faint)}
body:has(#menu:not(.hidden)) #perf,body:has(#menu:not(.hidden)) #ui,body.mn-blend #ui{visibility:hidden}
@media (max-height:700px){#menu h1{font-size:clamp(40px,7vw,64px);margin:8px 0 6px}#menu .mn-left{gap:16px}
 #menu .mn-btn{font-size:18px;padding:8px 0}#menu .mn-btn.primary{font-size:24px}#menu .mn-btn.quiet{margin-top:6px;font-size:14px}
 #menu .mn-tip{bottom:10px;font-size:12.5px}#menu .mn-sub{font-size:13px}}
@media (max-width:1100px) and (min-width:821px){#menu .mn-panel{width:min(520px,calc(100vw - 460px));min-width:340px}
 #menu .mn-sub{max-width:300px}}
@media (max-width:820px){#menu .mn-panel{top:auto;bottom:70px;transform:none;max-height:55vh}#menu .mn-left{justify-content:flex-start;padding-top:8vh}}
@media (prefers-reduced-motion:reduce){#menu *{transition:none!important}}
`;
