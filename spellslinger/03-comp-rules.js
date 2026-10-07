// =====================================================================
// The Comprehensive Rules. A copy is kept in rules/ by a weekly GitHub
// job (tools/fetch_rules.py): rules/cr.json has every rule by number,
// the section titles and the glossary. The game uses it for the 📖 Rules
// tab, keyword explanations on cards and the rule numbers in the log.
// =====================================================================
let crData = null;
let crPromise = null;
function loadRules() {
    if (!crPromise) {
        crPromise = fetch('rules/cr.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => { crData = d; return d; });
        crPromise.catch(() => { crPromise = null; });
    }
    return crPromise;
}
const CR_SOURCE = 'https://magic.wizards.com/en/rules';

function ruleHTML(num, text) {
    return `<div class="cr-rule" id="cr-${esc(num)}"><a class="cr-num" href="#" onclick="openRule('${esc(num)}'); return false;">${esc(num)}</a> ${esc(text).replace(/\n/g, '<br>').replace(/\b(\d{3}\.\d+[a-z]?)\b/g, m => `<a href="#" onclick="openRule('${m}'); return false;">${m}</a>`)}</div>`;
}

async function renderRulesView() {
    const info = $('crInfo'), out = $('crResults');
    try { await loadRules(); } catch (e) {
        info.innerHTML = `The rules copy isn't here yet. It's fetched from <a href="${CR_SOURCE}" target="_blank" rel="noopener">Wizards' rules page</a> by a weekly job; until then, read them there.`;
        out.innerHTML = '';
        return;
    }
    info.innerHTML = `Effective ${esc(crData.effective || '?')} · ${Object.keys(crData.rules).length.toLocaleString()} rules and ${Object.keys(crData.glossary).length} glossary terms, copied ${esc(crData.fetched)} from <a href="${CR_SOURCE}" target="_blank" rel="noopener">Wizards of the Coast's rules page</a>. The rules are Wizards'; this copy keeps their wording.`;
    const q = $('crSearch').value.trim();
    if (!q) {
        out.innerHTML = `<div class="cr-sections">${Object.entries(crData.sections).map(([n, t]) => `<a href="#" onclick="openRule('${n}.1'); return false;">${n}. ${esc(t)}</a>`).join('')}</div>`;
        return;
    }
    const ql = q.toLowerCase();
    let html = '';
    if (/^\d{3}(\.\d+[a-z]?)?$/.test(q)) {
        const hits = Object.entries(crData.rules).filter(([n]) => n === q || n.startsWith(q.includes('.') ? q : `${q}.`) || n.startsWith(`${q}`) && /[a-z]$/.test(n));
        html = hits.slice(0, 80).map(([n, t]) => ruleHTML(n, t)).join('');
    } else {
        const gloss = Object.entries(crData.glossary).filter(([term]) => term.toLowerCase().includes(ql)).slice(0, 8);
        const rules = Object.entries(crData.rules).filter(([, t]) => t.toLowerCase().includes(ql)).slice(0, 60);
        html = (gloss.length ? `<h3 class="cr-h">Glossary</h3>${gloss.map(([term, t]) => `<div class="cr-rule"><strong>${esc(term)}</strong><br>${esc(t).replace(/\n/g, '<br>').replace(/\b(\d{3}\.\d+[a-z]?)\b/g, m => `<a href="#" onclick="openRule('${m}'); return false;">${m}</a>`)}</div>`).join('')}` : '')
            + (rules.length ? `<h3 class="cr-h">Rules${rules.length === 60 ? ' (first 60)' : ''}</h3>${rules.map(([n, t]) => ruleHTML(n, t)).join('')}` : '');
    }
    out.innerHTML = html || '<p class="note">Nothing found.</p>';
}

// Show one rule (and the rules around it) - from the log, a card or a link.
async function openRule(num) {
    try { await loadRules(); } catch (e) { toast('The rules copy isn\'t available yet.'); return; }
    const base = num.replace(/[a-z]$/, '');
    const list = Object.entries(crData.rules).filter(([n]) => n === base || (n.startsWith(base) && /^[a-z]$/.test(n.slice(base.length))));
    const sec = crData.sections[num.slice(0, 3)];
    showModal(`<h2 style="font-size:1.2rem;">Rule ${esc(num)}${sec ? ` · ${esc(sec)}` : ''}</h2>
        <div style="text-align:left; max-height:60vh; overflow:auto;">${list.map(([n, t]) => ruleHTML(n, t)).join('') || '<p class="note">That rule isn\'t in this copy.</p>'}</div>
        <p class="note" style="margin-top:8px;">Comprehensive Rules effective ${esc(crData.effective || '?')}, from Wizards of the Coast.</p>
        <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}

// The official glossary wording for a card's keywords
async function keywordHelpHTML(card) {
    const R = rulesFor(card);
    const kws = [...R.kw];
    if (!kws.length) return '';
    try { await loadRules(); } catch (e) { return ''; }
    const rows = kws.map(k => {
        const term = Object.keys(crData.glossary).find(t => t.toLowerCase() === k);
        return term ? `<div><strong>${esc(term)}:</strong> ${esc(crData.glossary[term].split('\n')[0])}</div>` : '';
    }).filter(Boolean);
    return rows.length ? `<div class="kw-help">${rows.join('')}<div class="muted">From the Comprehensive Rules glossary.</div></div>` : '';
}
async function fillKeywordHelp(card) {
    const el = $('kwHelp');
    if (!el) return;
    el.innerHTML = await keywordHelpHTML(card);
}

