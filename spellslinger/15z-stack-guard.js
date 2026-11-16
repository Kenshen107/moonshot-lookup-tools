// Stuck stack (2026-11-16, owner's pod record: in a long Nog game the landfall triggers "just kept stacking without resolving" from turn 36 to the end of the game).
// What happened: `runStack` is a single loop (`G.stackRunning`); when one of its awaits never finished (a choice that was asked while another choice was open, so the
// first one was orphaned), every later trigger was only put on the stack and nothing ever resolved it. The record shows the player playing another land while the
// first land's triggers were still waiting, which the rules don't allow (305.1 / 116.2a: lands only with an empty stack). Two fixes:
// (1) `humanPlayLand` refuses while anything is on the stack or a choice is open, so a second choice can't be started on top of the first one;
// (2) a watchdog: if the stack has been waiting 6 seconds with nothing open (no choice, no modal, no play-by-play showing), `runStack` is restarted.
'use strict';
{
    const hp = humanPlayLand;
    humanPlayLand = async function (uid) {
        if (G && !G.over && G.stack.length) { toast('A land can only be played when the stack is empty: let it resolve first.'); return; }
        if (G && !G.over && G.mode && ['target', 'respond', 'pay'].includes(G.mode.type)) { toast('Finish the current choice first.'); return; }
        return hp.apply(this, arguments);
    };
}
let stackStuckTicks = 0;
function stackGuardTick(limit = 6) {
    try {
        if (typeof G === 'undefined' || !G || G.over || !G.stack || !G.stack.length || !G.stackRunning || G.mode || window.__ask || document.querySelector('#modalHost .modal') || (typeof actBusy === 'function' && actBusy())) { stackStuckTicks = 0; return false; }
        if (++stackStuckTicks < limit) return false;
        stackStuckTicks = 0; G.stackRunning = false;
        log('⚠️ The stack was stuck - resuming it.');
        runStack();
        return true;
    } catch (e) { return false; }
}
setInterval(() => { if (!AUTOPLAY && !window.__LAB) stackGuardTick(); }, 1000);
