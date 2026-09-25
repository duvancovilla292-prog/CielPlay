// ============================================================
// Código de Colores — CielPlay
// Modo Bot: el jugador crea el código, el bot lo adivina.
// Modo Multijugador: cada jugador crea un código y los demás
// se turnan para adivinarlo.
// ============================================================

// Cada color es un identificador único (id) con su emoji/hex para pintar la UI
const COLOR_POOL = [
    { id: 'rojo',    name: 'Rojo',     hex: '#ff5964' },
    { id: 'verde',   name: 'Verde',    hex: '#3ddc97' },
    { id: 'azul',    name: 'Azul',     hex: '#3aa0ff' },
    { id: 'amarillo',name: 'Amarillo', hex: '#ffd23f' },
    { id: 'purpura', name: 'Púrpura',  hex: '#9d4edf' },
    { id: 'naranja', name: 'Naranja',  hex: '#ff8c42' },
    { id: 'negro',   name: 'Negro',    hex: '#3a4150' },
    { id: 'blanco',  name: 'Blanco',   hex: '#f0f4f8' },
];

const DIFFICULTIES = {
    facil:   { length: 4, poolSize: 6, repeat: false },
    normal:  { length: 5, poolSize: 8, repeat: false },
    dificil: { length: 4, poolSize: 8, repeat: true  },
    extremo: { length: 6, poolSize: 8, repeat: true  },
};

function colorById(id) { return COLOR_POOL.find(c => c.id === id); }

// ---------- Utilidades del juego ----------
function computeFeedback(secret, guess) {
    let fijas = 0;
    const secretRest = [];
    const guessRest = [];
    for (let i = 0; i < secret.length; i++) {
        if (guess[i] === secret[i]) fijas++;
        else { secretRest.push(secret[i]); guessRest.push(guess[i]); }
    }
    let picas = 0;
    const counts = {};
    secretRest.forEach(s => counts[s] = (counts[s] || 0) + 1);
    guessRest.forEach(g => { if (counts[g] > 0) { picas++; counts[g]--; } });
    return { fijas, picas };
}

function generateCandidates(options, length, allowRepeat) {
    const results = [];
    const combo = new Array(length);
    const used = new Set();
    (function backtrack(pos) {
        if (pos === length) { results.push(combo.slice()); return; }
        for (let i = 0; i < options.length; i++) {
            if (!allowRepeat && used.has(i)) continue;
            combo[pos] = options[i];
            used.add(i);
            backtrack(pos + 1);
            used.delete(i);
        }
    })(0);
    return results;
}

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function renderHistoryChips(ids) {
    return ids.map(id => {
        const c = colorById(id);
        return `<span class="color-swatch" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:3px;background:${c.hex};border-radius:50%;" title="${c.name}"></span>`;
    }).join('');
}

// ---------- Componente reutilizable: entrada de código de colores ----------
function createCodeInput({ slotsEl, keypadEl, options, length, allowRepeat, onUpdate }) {
    let value = [];
    const keyButtons = [];

    slotsEl.innerHTML = '';
    for (let i = 0; i < length; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot color-slot';
        slotsEl.appendChild(slot);
    }

    keypadEl.innerHTML = '';
    options.forEach(colorId => {
        const color = colorById(colorId);
        const btn = document.createElement('button');
        btn.className = 'key-btn color-key';
        btn.type = 'button';
        btn.innerHTML = `<span class="color-swatch" style="background:${color.hex};"></span><small>${color.name}</small>`;
        btn.addEventListener('click', () => {
            if (value.length >= length) return;
            if (!allowRepeat && value.includes(colorId)) return;
            value.push(colorId);
            render();
        });
        keypadEl.appendChild(btn);
        keyButtons.push({ btn, colorId });
    });

    function render() {
        const slots = slotsEl.children;
        for (let i = 0; i < slots.length; i++) {
            if (i < value.length) {
                const c = colorById(value[i]);
                slots[i].innerHTML = `<span class="color-swatch" style="width:30px;height:30px;background:${c.hex};"></span>`;
                slots[i].classList.add('filled');
            } else {
                slots[i].innerHTML = '';
                slots[i].classList.remove('filled');
            }
        }
        keyButtons.forEach(({ btn, colorId }) => {
            const full = value.length >= length;
            const usedUp = !allowRepeat && value.includes(colorId);
            btn.disabled = usedUp || full;
        });
        onUpdate(value.length === length, value.slice());
    }

    render();

    return {
        getValue: () => value.slice(),
        clear: () => { value = []; render(); },
    };
}

// ============================================================
// NAVEGACIÓN ENTRE PANTALLAS
// ============================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ============================================================
// ESTADO DE CONFIGURACIÓN
// ============================================================
let selectedMode = 'bot';
let selectedDiff = 'facil';
let numPlayers = 2;
let playerNames = ['Jugador 1', 'Jugador 2'];

document.querySelectorAll('#mode-choice .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#mode-choice .choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.dataset.mode;
        document.getElementById('players-field').style.display = selectedMode === 'multi' ? 'block' : 'none';
    });
});

document.querySelectorAll('#difficulty-choice .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#difficulty-choice .choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDiff = btn.dataset.diff;
    });
});

function renderNameInputs() {
    while (playerNames.length < numPlayers) playerNames.push(`Jugador ${playerNames.length + 1}`);
    playerNames = playerNames.slice(0, numPlayers);
    const grid = document.getElementById('players-names');
    grid.innerHTML = '';
    for (let i = 0; i < numPlayers; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 16;
        input.value = playerNames[i];
        input.addEventListener('input', () => { playerNames[i] = input.value.trim() || `Jugador ${i + 1}`; });
        grid.appendChild(input);
    }
}
renderNameInputs();

document.getElementById('players-minus').addEventListener('click', () => {
    numPlayers = Math.max(2, numPlayers - 1);
    document.getElementById('players-count').textContent = numPlayers;
    renderNameInputs();
});
document.getElementById('players-plus').addEventListener('click', () => {
    numPlayers = Math.min(6, numPlayers + 1);
    document.getElementById('players-count').textContent = numPlayers;
    renderNameInputs();
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    if (selectedMode === 'bot') startBotMode();
    else startMultiMode();
});

// ============================================================
// MODO BOT
// ============================================================
let botState = null;

function startBotMode() {
    showScreen('screen-bot');
    document.getElementById('bot-step-secret').style.display = 'block';
    document.getElementById('bot-step-play').style.display = 'none';
    document.getElementById('bot-result').style.display = 'none';
    document.getElementById('bot-play-again').style.display = 'none';
    document.getElementById('bot-history-body').innerHTML = '';

    const diff = DIFFICULTIES[selectedDiff];
    const options = COLOR_POOL.slice(0, diff.poolSize).map(c => c.id);

    let secretComplete = false;
    const secretInput = createCodeInput({
        slotsEl: document.getElementById('bot-secret-slots'),
        keypadEl: document.getElementById('bot-secret-keypad'),
        options, length: diff.length, allowRepeat: diff.repeat,
        onUpdate: (complete) => {
            secretComplete = complete;
            document.getElementById('bot-secret-confirm').disabled = !complete;
        }
    });

    document.getElementById('bot-secret-clear').onclick = () => secretInput.clear();

    document.getElementById('bot-secret-confirm').onclick = () => {
        if (!secretComplete) return;
        const secret = secretInput.getValue();
        botState = {
            secret,
            diff,
            options,
            candidates: generateCandidates(options, diff.length, diff.repeat),
            attempts: 0,
            solved: false,
            autoplay: false,
        };
        document.getElementById('bot-step-secret').style.display = 'none';
        document.getElementById('bot-step-play').style.display = 'block';
        document.getElementById('bot-attempt-count').textContent = '0 intentos';
    };
}

function botTakeGuess() {
    if (!botState || botState.solved) return;
    if (botState.candidates.length === 0) {
        botState.candidates = generateCandidates(botState.options, botState.diff.length, botState.diff.repeat);
    }
    const guess = randomFrom(botState.candidates);
    const { fijas, picas } = computeFeedback(botState.secret, guess);
    botState.attempts++;

    const row = document.createElement('tr');
    row.innerHTML = `<td>${botState.attempts}</td><td>${renderHistoryChips(guess)}</td><td>${fijas}</td><td>${picas}</td>`;
    document.getElementById('bot-history-body').appendChild(row);
    document.getElementById('bot-history-body').parentElement.parentElement.scrollTop = 999999;
    document.getElementById('bot-attempt-count').textContent = `${botState.attempts} intento${botState.attempts === 1 ? '' : 's'}`;

    if (fijas === botState.diff.length) {
        botState.solved = true;
        botState.autoplay = false;
        document.getElementById('bot-autoplay').textContent = '▶ Reproducir automático';
        const banner = document.getElementById('bot-result');
        banner.style.display = 'block';
        banner.className = 'result-banner';
        banner.textContent = `🤖 ¡El bot adivinó tu código en ${botState.attempts} intento${botState.attempts === 1 ? '' : 's'}!`;
        document.getElementById('bot-play-again').style.display = 'block';
        document.getElementById('bot-nextstep').disabled = true;
        document.getElementById('bot-autoplay').disabled = true;
        return;
    }

    botState.candidates = botState.candidates.filter(c => {
        const fb = computeFeedback(c, guess);
        return fb.fijas === fijas && fb.picas === picas;
    });

    if (botState.autoplay) {
        setTimeout(botTakeGuess, 550);
    }
}

document.getElementById('bot-nextstep').addEventListener('click', botTakeGuess);
document.getElementById('bot-autoplay').addEventListener('click', () => {
    if (!botState || botState.solved) return;
    botState.autoplay = !botState.autoplay;
    document.getElementById('bot-autoplay').textContent = botState.autoplay ? '⏸ Pausar' : '▶ Reproducir automático';
    if (botState.autoplay) botTakeGuess();
});
document.getElementById('bot-play-again').addEventListener('click', () => {
    document.getElementById('bot-nextstep').disabled = false;
    document.getElementById('bot-autoplay').disabled = false;
    showScreen('screen-setup');
});

// ============================================================
// MODO MULTIJUGADOR
// ============================================================
let multiState = null;

function startMultiMode() {
    showScreen('screen-multi');
    const diff = DIFFICULTIES[selectedDiff];
    multiState = {
        diff,
        options: COLOR_POOL.slice(0, diff.poolSize).map(c => c.id),
        players: playerNames.slice(0, numPlayers),
        scores: {},
        round: 0,
        secret: null,
        guesserOrder: [],
        guesserIdx: 0,
        attempts: 0,
    };
    multiState.players.forEach(p => multiState.scores[p] = 0);
    renderScoreboard();
    goToPassScreen();
}

function renderScoreboard() {
    const board = document.getElementById('multi-scoreboard');
    board.innerHTML = '';
    multiState.players.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'score-chip';
        chip.innerHTML = `${p} · <span class="pts">${multiState.scores[p]} pts</span>`;
        board.appendChild(chip);
    });
}

function hideAllMultiSections() {
    ['multi-pass', 'multi-code-entry', 'multi-guessing', 'multi-round-result', 'multi-final']
        .forEach(id => document.getElementById(id).style.display = 'none');
}

function goToPassScreen() {
    if (multiState.round >= multiState.players.length) { showFinalScreen(); return; }
    hideAllMultiSections();
    const master = multiState.players[multiState.round];
    document.getElementById('multi-round-num').textContent = `${multiState.round + 1} / ${multiState.players.length}`;
    document.getElementById('multi-pass-title').querySelector('.highlight').textContent = master;
    document.getElementById('multi-pass-hint').textContent = `${master} va a crear un código secreto. Los demás jugadores no deben mirar la pantalla.`;
    document.getElementById('multi-pass').style.display = 'block';
    document.getElementById('multi-pass-ready').onclick = goToCodeEntry;
}

let multiSecretComplete = false;
let multiSecretInput = null;

function goToCodeEntry() {
    hideAllMultiSections();
    const master = multiState.players[multiState.round];
    document.getElementById('multi-master-name').textContent = master;
    document.getElementById('multi-code-entry').style.display = 'block';

    multiSecretComplete = false;
    document.getElementById('multi-secret-confirm').disabled = true;
    multiSecretInput = createCodeInput({
        slotsEl: document.getElementById('multi-secret-slots'),
        keypadEl: document.getElementById('multi-secret-keypad'),
        options: multiState.options, length: multiState.diff.length, allowRepeat: multiState.diff.repeat,
        onUpdate: (complete) => {
            multiSecretComplete = complete;
            document.getElementById('multi-secret-confirm').disabled = !complete;
        }
    });
}

document.getElementById('multi-secret-clear').addEventListener('click', () => multiSecretInput && multiSecretInput.clear());
document.getElementById('multi-secret-confirm').addEventListener('click', () => {
    if (!multiSecretComplete) return;
    multiState.secret = multiSecretInput.getValue();
    multiState.attempts = 0;
    multiState.guesserOrder = multiState.players.filter((_, i) => i !== multiState.round);
    multiState.guesserIdx = 0;
    document.getElementById('multi-history-body').innerHTML = '';
    goToPassBeforeGuessing();
});

function goToPassBeforeGuessing() {
    hideAllMultiSections();
    const master = multiState.players[multiState.round];
    document.getElementById('multi-round-num').textContent = `${multiState.round + 1} / ${multiState.players.length}`;
    document.getElementById('multi-pass-title').querySelector('.highlight').textContent = 'los demás jugadores';
    document.getElementById('multi-pass-hint').textContent = `Código guardado. ${master} debe dejar de mirar la pantalla; el resto ya puede intentar adivinar.`;
    document.getElementById('multi-pass').style.display = 'block';
    document.getElementById('multi-pass-ready').onclick = goToGuessing;
}

let multiGuessComplete = false;
let multiGuessInput = null;

function goToGuessing() {
    hideAllMultiSections();
    document.getElementById('multi-guessing').style.display = 'block';
    const guesser = multiState.guesserOrder[multiState.guesserIdx];
    const master = multiState.players[multiState.round];
    document.getElementById('multi-guesser-name').textContent = guesser;
    document.getElementById('multi-target-name').textContent = master;

    multiGuessComplete = false;
    document.getElementById('multi-guess-confirm').disabled = true;
    multiGuessInput = createCodeInput({
        slotsEl: document.getElementById('multi-guess-slots'),
        keypadEl: document.getElementById('multi-guess-keypad'),
        options: multiState.options, length: multiState.diff.length, allowRepeat: multiState.diff.repeat,
        onUpdate: (complete) => {
            multiGuessComplete = complete;
            document.getElementById('multi-guess-confirm').disabled = !complete;
        }
    });
}

document.getElementById('multi-guess-clear').addEventListener('click', () => multiGuessInput && multiGuessInput.clear());
document.getElementById('multi-guess-confirm').addEventListener('click', () => {
    if (!multiGuessComplete) return;
    const guesser = multiState.guesserOrder[multiState.guesserIdx];
    const guess = multiGuessInput.getValue();
    const { fijas, picas } = computeFeedback(multiState.secret, guess);
    multiState.attempts++;

    const row = document.createElement('tr');
    row.innerHTML = `<td>${multiState.attempts}</td><td>${guesser}</td><td>${renderHistoryChips(guess)}</td><td>${fijas}</td><td>${picas}</td>`;
    document.getElementById('multi-history-body').appendChild(row);

    if (fijas === multiState.diff.length) {
        multiState.scores[guesser]++;
        renderScoreboard();
        endRound(`🎉 ¡${guesser} adivinó el código de ${multiState.players[multiState.round]} en ${multiState.attempts} intento${multiState.attempts === 1 ? '' : 's'}! +1 punto.`, false);
        return;
    }
    multiState.guesserIdx = (multiState.guesserIdx + 1) % multiState.guesserOrder.length;
    goToGuessing();
});

document.getElementById('multi-give-up').addEventListener('click', () => {
    endRound(`El código secreto era: ${renderHistoryChips(multiState.secret)}. Nadie sumó puntos esta ronda.`, true);
});

function endRound(message, isReveal) {
    hideAllMultiSections();
    const banner = document.getElementById('multi-round-result');
    banner.style.display = 'block';
    banner.className = isReveal ? 'result-banner lose' : 'result-banner';
    banner.innerHTML = message;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary';
    nextBtn.style.marginTop = '16px';
    nextBtn.style.display = 'block';
    nextBtn.textContent = multiState.round + 1 >= multiState.players.length ? 'Ver resultados finales' : 'Siguiente jugador';
    nextBtn.onclick = () => {
        banner.removeChild(nextBtn);
        multiState.round++;
        goToPassScreen();
    };
    banner.appendChild(nextBtn);
}

function showFinalScreen() {
    hideAllMultiSections();
    document.getElementById('multi-final').style.display = 'block';
    const table = document.getElementById('multi-final-table');
    const ranked = [...multiState.players].sort((a, b) => multiState.scores[b] - multiState.scores[a]);
    const topScore = multiState.scores[ranked[0]];
    table.innerHTML = '';
    ranked.forEach(p => {
        const row = document.createElement('div');
        row.className = 'final-row' + (multiState.scores[p] === topScore && topScore > 0 ? ' winner' : '');
        row.innerHTML = `<span>${p}</span><span>${multiState.scores[p]} pts</span>`;
        table.appendChild(row);
    });
}

document.getElementById('multi-again').addEventListener('click', () => {
    multiState.round = 0;
    goToPassScreen();
});
document.getElementById('multi-restart').addEventListener('click', () => showScreen('screen-setup'));
