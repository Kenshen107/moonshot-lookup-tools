// Attacking more than one opponent (2026-10-19, owner's request). In a pod every attacker has its own target player (`o.atkTo`);
// the attackers that go at the same player form a group. Each group gets its own block step (the defender chooses blocks for the
// attackers coming at them), then all damage is dealt together (combatDamage reads `atkTo`). In a duel nothing changes: `atkTo` is never set.
const atkDef = atk => (atk.atkTo != null && G.players[atk.atkTo] && !G.players[atk.atkTo].out) ? G.players[atk.atkTo] : opp(G.players[atk.owner]);
// The attackers on the table grouped by the player they go at, in seat order after the attacker
function attackGroups(P) {
    const by = new Map();
    G.attackers.map(onBf).filter(Boolean).forEach(o => {
        const d = (G.players.length > 2 && o.atkTo != null && G.players[o.atkTo] && !G.players[o.atkTo].out) ? o.atkTo : opp(P).i;
        if (!by.has(d)) by.set(d, []);
        by.get(d).push(o.uid);
    });
    const n = G.players.length;
    return [...by.entries()].sort((a, b) => ((a[0] - P.i + n) % n) - ((b[0] - P.i + n) % n)).map(([d, uids]) => ({ d, uids }));
}
// The block step for every defender. Returns false if the game ended. `hardRemoval`: a hard computer defender first kills a big attacker (the human attacker's flow).
async function chooseBlocksAll(P, { hardRemoval = false, aiPause = 0, idlePause = 0 } = {}) {
    const all = G.attackers.slice(), primary = G.defender, merged = {};
    for (const g of attackGroups(P)) {
        const D = G.players[g.d];
        G.defender = D.i; G.attackers = g.uids.slice(); G.blocks = {};
        if (hardRemoval && D.isAI && D.aiLevel === 'hard') { await aiRemoveAttacker(D); if (G.over) return false; }
        if (odricActive()) { /* Odric, Master Tactician: the attacker chooses the blocks */ }
        else if (D.isAI) { if (aiPause) await pause(aiPause); G.blocks = aiChooseBlocks(D, P); }
        else if (D.bf.some(o => isCreature(o) && !o.tapped) || D.hand.some(o => canCastNow(D, o) && canPay(D, o))) {
            G.busy = false;
            await new Promise(resolve => { G.mode = { type: 'block', who: D.i, picked: null, resolve }; renderGame(); });
            G.busy = true;
            if (G.over) return false;
        } else if (idlePause) await pause(idlePause);
        Object.assign(merged, G.blocks);
        if (G.over) return false;
    }
    G.attackers = all; G.blocks = merged; G.defender = primary;
    return true;
}
// The computer: after choosing who it attacks, it sends enough attackers at a second player it can finish off
function aiAssignTargets(P, attackers) {
    if (G.players.length < 3 || !attackers.length) return;
    attackers.forEach(o => { o.atkTo = G.defender; });
    const rest = attackers.slice().sort((a, b) => pow(b) - pow(a));
    const others = foes(P).filter(F => F.i !== G.defender && !(typeof hasPeace === 'function' && hasPeace(P.i, F.i))).sort((a, b) => a.life - b.life);
    for (const F of others) {
        if (rest.length < 2) break;
        const blockers = F.bf.filter(o => isCreature(o) && !o.tapped).length;
        // the biggest attackers get blocked; count what is left over
        for (let k = blockers + 1; k < rest.length; k++) { // always leave at least one attacker for the main target
            const through = rest.slice(blockers, k).reduce((a, o) => a + Math.max(0, pow(o)), 0);
            if (through >= F.life) { rest.slice(0, k).forEach(o => { o.atkTo = F.i; }); rest.splice(0, k); log(`${P.name} sends ${k} creature${k === 1 ? '' : 's'} at ${F.name}, who is low enough to finish.`); break; }
        }
    }
}
// A person's attack with several opponents: each attacker is sent at a player, one of their planeswalkers or a battle
function choosePodTargets(sel, foesList, pws) {
    sel.forEach(o => { delete o.attackPW; o.atkTo = foe().i; });
    return new Promise(resolve => {
        const opt = o => foesList.map(F => `<option value="p:${F.i}"${o.atkTo === F.i && !o.attackPW ? ' selected' : ''}>⚔️ ${esc(F.name)}</option>`).join('') + pws.map(w => `<option value="${w.uid}"${o.attackPW === w.uid ? ' selected' : ''}>${esc(w.card.name)} (${isBattle(w) ? `battle, defense ${w.ctr.defense || 0}` : `loyalty ${w.ctr.loyalty || 0}`}, ${esc(G.players[w.owner].name)})</option>`).join('');
        window.__atkT = (uid, v) => { const o = onBf(uid); if (!o) return; if (String(v).startsWith('p:')) { o.atkTo = Number(v.slice(2)); delete o.attackPW; } else { const w = onBf(Number(v)); if (w) { o.attackPW = w.uid; o.atkTo = isBattle(w) ? o.atkTo : w.owner; } } };
        window.__atkAll = v => { sel.forEach(o => window.__atkT(o.uid, v)); document.querySelectorAll('#atkTargets select').forEach(el => { el.value = v; }); };
        window.__atkOk = ok => { closeModal(); if (!ok) sel.forEach(o => { delete o.attackPW; delete o.atkTo; }); resolve(ok); };
        showModal(`<h2>Who does each creature attack?</h2><p class="note">Send your attackers at different opponents, or at their planeswalkers. Each opponent blocks only the creatures coming at them.</p>
            <div class="row" style="gap:6px; flex-wrap:wrap; justify-content:center; margin-bottom:8px;">${foesList.map(F => `<button class="btn small" onclick="__atkAll('p:${F.i}')">All → ${esc(F.name.split(',')[0])}</button>`).join('')}</div>
            <div id="atkTargets" class="row" style="flex-direction:column; align-items:stretch; gap:8px; max-height:50vh; overflow:auto;">${sel.map(o => `<label class="row" style="justify-content:space-between; gap:8px;"><span>${esc(o.card.name)} (${pow(o)}/${tou(o)})</span><select onchange="__atkT(${o.uid}, this.value)">${opt(o)}</select></label>`).join('')}</div>
            <div class="row" style="justify-content:center; margin-top:10px; gap:8px;"><button class="btn" onclick="__atkOk(false)">Cancel</button><button class="btn primary" onclick="__atkOk(true)">Attack</button></div>`);
    });
}
