document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('chineseCheckersCanvas');
    const ctx = canvas.getContext('2d');
    const statusPanel = document.getElementById('statusPanel');
    const resetBtn = document.getElementById('resetGameBtn');
    const difficultySelect = document.getElementById('difficultySelect');

    // Configuración del tablero
    const RADIUS = 13; // Radio visual de las casillas
    let nodes = [];    // Malla de puntos de la estrella
    let turn = 'PLAYER'; // 'PLAYER' (Azul - Abajo) | 'AI' (Roja - Arriba)
    let selectedNode = null;
    let possibleMoves = [];
    let gameActive = true;
    let aiDifficulty = 2;

    // Coordenadas axiales de las 6 direcciones continuas
    const DIRECTIONS = [
        { r: -1, q: 0 }, { r: -1, q: 1 },
        { r: 0, q: -1 },  { r: 0, q: 1 },
        { r: 1, q: -1 },  { r: 1, q: 0 }
    ];

    // Meta para el Jugador (Punta Superior) y Meta para la IA (Punta Inferior)
    const TARGET_PLAYER_R = -4; 
    const TARGET_AI_R = 4;

    function initGame() {
        nodes = [];
        buildStarGraph();
        assignInitialPieces();
        turn = 'PLAYER';
        selectedNode = null;
        possibleMoves = [];
        gameActive = true;
        updateStatus();
        draw();
    }

    // Construye la geometría exacta de la estrella usando coordenadas de cuadrícula axial
    function buildStarGraph() {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const stepX = RADIUS * 2.2;
        const stepY = RADIUS * 1.9;

        for (let r = -8; r <= 8; r++) {
            for (let q = -8; q <= 8; q++) {
                if (isValidStarPosition(r, q)) {
                    // Conversión axial a coordenadas cartesianas (X, Y)
                    const x = cx + (q + r / 2) * stepX;
                    const y = cy + r * stepY;
                    nodes.push({
                        r, q, x, y,
                        piece: null, // 'P' (Player), 'AI' (Bot), o null
                        zone: getZone(r, q)
                    });
                }
            }
        }
    }

    function isValidStarPosition(r, q) {
        // Filtro matemático de la estrella de 6 puntas de 121 nodos
        const p1 = Math.abs(r) <= 4 && Math.abs(q) <= 4 && Math.abs(r + q) <= 4;
        const p2 = (r >= -4 && r <= 4) && (q >= -8 && q <= 8) && (Math.abs(r + q) <= 4);
        const p3 = (q >= -4 && q <= 4) && (r >= -8 && r <= 8) && (Math.abs(r + q) <= 8);
        return p1 || (r <= -5 && q >= 1 && r + q <= -4) || (r >= 5 && q <= -1 && r + q >= 4) ||
               (q <= -5 && r >= 1 && r + q <= -4) || (q >= 5 && r <= -1 && r + q >= 4) ||
               (r + q <= -5 && r >= -4 && q >= -4) || (r + q >= 5 && r <= 4 && q <= 4);
    }

    function getZone(r, q) {
        if (r >= 5) return 'PLAYER_START'; // Punta Inferior (Jugador)
        if (r <= -5) return 'AI_START';     // Punta Superior (IA)
        return 'NEUTRAL';
    }

    function assignInitialPieces() {
        nodes.forEach(node => {
            if (node.zone === 'PLAYER_START') node.piece = 'P';
            else if (node.zone === 'AI_START') node.piece = 'AI';
            else node.piece = null;
        });
    }

    // --- LÓGICA DE MOVIMIENTOS Y SALTOS ENCADENADOS ---
    function getNode(r, q) {
        return nodes.find(n => n.r === r && n.q === q);
    }

    function getStepMoves(node) {
        const moves = [];
        DIRECTIONS.forEach(d => {
            const target = getNode(node.r + d.r, node.q + d.q);
            if (target && !target.piece) {
                moves.push(target);
            }
        });
        return moves;
    }

    function getJumpMoves(startNode) {
        const jumps = [];
        const visited = new Set();

        function findJumps(currentNode) {
            DIRECTIONS.forEach(d => {
                const neighbor = getNode(currentNode.r + d.r, currentNode.q + d.q);
                // Si hay una pieza adyacente sobre la cual saltar
                if (neighbor && neighbor.piece) {
                    const landing = getNode(currentNode.r + 2 * d.r, currentNode.q + 2 * d.q);
                    // Si la casilla detrás está libre y no ha sido visitada en esta cadena de saltos
                    if (landing && !landing.piece && !visited.has(`${landing.r},${landing.q}`)) {
                        visited.add(`${landing.r},${landing.q}`);
                        jumps.push(landing);
                        findJumps(landing); // Recursión para saltos múltiples
                    }
                }
            });
        }

        findJumps(startNode);
        return jumps;
    }

    function getLegalMovesForNode(node) {
        const steps = getStepMoves(node);
        const jumps = getJumpMoves(node);
        return [...steps, ...jumps];
    }

    // --- INTERACCIÓN Y RENDERIZADO ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Renderizar conexiones/líneas entre nodos
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        nodes.forEach(node => {
            DIRECTIONS.forEach(d => {
                const neighbor = getNode(node.r + d.r, node.q + d.q);
                if (neighbor && (node.r < neighbor.r || (node.r === neighbor.r && node.q < neighbor.q))) {
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(neighbor.x, neighbor.y);
                    ctx.stroke();
                }
            });
        });

        // Renderizar casillas
        nodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, RADIUS, 0, Math.PI * 2);

            if (node.piece === 'P') {
                ctx.fillStyle = '#2196F3'; // Azul Jugador
            } else if (node.piece === 'AI') {
                ctx.fillStyle = '#F44336'; // Rojo Bot
            } else {
                ctx.fillStyle = node.zone === 'PLAYER_START' ? '#1565C0' : (node.zone === 'AI_START' ? '#C62828' : '#2a2a2a');
            }

            ctx.fill();
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Resaltar selección y posibles destinos
            if (selectedNode === node) {
                ctx.strokeStyle = '#FFEB3B';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            if (possibleMoves.includes(node)) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, RADIUS / 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 235, 59, 0.6)';
                ctx.fill();
            }
        });
    }

    canvas.addEventListener('click', (e) => {
        if (!gameActive || turn !== 'PLAYER') return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

        // Buscar nodo presionado
        const clickedNode = nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < RADIUS);

        if (clickedNode) {
            if (clickedNode.piece === 'P') {
                selectedNode = clickedNode;
                possibleMoves = getLegalMovesForNode(clickedNode);
                draw();
            } else if (selectedNode && possibleMoves.includes(clickedNode)) {
                executeMove(selectedNode, clickedNode);
            }
        }
    });

    function executeMove(fromNode, toNode) {
        toNode.piece = fromNode.piece;
        fromNode.piece = null;
        selectedNode = null;
        possibleMoves = [];

        draw();

        if (checkWinCondition()) return;

        turn = turn === 'PLAYER' ? 'AI' : 'PLAYER';
        updateStatus();

        if (turn === 'AI') {
            setTimeout(makeAIMove, 500);
        }
    }

    // --- INTELIGENCIA ARTIFICIAL DE SALTO LARGO ---
    function evaluateNodeDistance(node, isAI) {
        // Calcula qué tan cerca está la ficha de su zona objetivo
        return isAI ? (node.r - TARGET_AI_R) : (TARGET_PLAYER_R - node.r);
    }

    function makeAIMove() {
        if (!gameActive) return;

        const aiNodes = nodes.filter(n => n.piece === 'AI');
        let bestMove = null;
        let maxProgress = -Infinity;

        aiNodes.forEach(fromNode => {
            const moves = getLegalMovesForNode(fromNode);
            moves.forEach(toNode => {
                // Avance vertical y hacia la punta destino
                const currentDist = evaluateNodeDistance(fromNode, true);
                const newDist = evaluateNodeDistance(toNode, true);
                let progress = newDist - currentDist;

                // Añadir una pequeña penalización para evitar que regrese a su propio triángulo si ya salió
                if (fromNode.zone !== 'AI_START' && toNode.zone === 'AI_START') {
                    progress -= 5;
                }

                // Dificultad: Variación en la profundidad del análisis de avances
                if (aiDifficulty === 1) progress += (Math.random() * 2 - 1); // Ruido aleatorio en fácil
                
                if (progress > maxProgress) {
                    maxProgress = progress;
                    bestMove = { from: fromNode, to: toNode };
                }
            });
        });

        if (bestMove) {
            executeMove(bestMove.from, bestMove.to);
        } else {
            // Si la IA está acorralada y no tiene movimiento avance, fuerzo un movimiento libre
            turn = 'PLAYER';
            updateStatus();
        }
    }

    // --- FIN DE PARTIDA ---
    function checkWinCondition() {
        const playerWon = nodes.filter(n => n.zone === 'AI_START').every(n => n.piece === 'P');
        const aiWon = nodes.filter(n => n.zone === 'PLAYER_START').every(n => n.piece === 'AI');

        if (playerWon) {
            statusPanel.innerText = "¡Increíble! Has llenado la punta opuesta y GANASTE. 🏆";
            gameActive = false;
            return true;
        }
        if (aiWon) {
            statusPanel.innerText = "¡La IA ha conquistado tu zona! Has perdido. 🔴";
            gameActive = false;
            return true;
        }
        return false;
    }

    function updateStatus() {
        if (!gameActive) return;
        statusPanel.innerText = turn === 'PLAYER' ? "Turno de las Azules (Tu turno) 🔵" : "Pensando la IA (Rojas) 🔴...";
    }

    difficultySelect.addEventListener('change', (e) => {
        aiDifficulty = parseInt(e.target.value);
    });

    resetBtn.addEventListener('click', initGame);

    initGame();
});