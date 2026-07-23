// Motor Lógico de Ajedrez Nativo con Reglas FIDE y API de Stockfish
document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('chessboard');
    const statusPanel = document.getElementById('statusPanel');
    const moveLog = document.getElementById('moveLog');
    const setupModal = document.getElementById('setupModal');
    const modeIndicator = document.getElementById('modeIndicator');
    
    // Configuración Inicial de Estado
    let boardState = [];
    let turn = 'w'; // 'w' = Blancas, 'b' = Negras
    let selectedSquare = null;
    let possibleMoves = [];
    let isVsBot = false;
    let botDifficulty = 1; 
    let gameActive = false;

    // Historial para reglas avanzadas (En Passant / Castling)
    let moveHistory = [];
    let castleRights = { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } };
    let enPassantTarget = null; // Guarda coordenadas de casilla vulnerable [r, c]

    // Mapeo oficial Unicode de piezas de ajedrez
    const unicodePieces = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    };

    // Configuración estructural del menú modal
    const modePVP = document.getElementById('modePVP');
    const modeBot = document.getElementById('modeBot');
    const difficultySection = document.getElementById('difficultySection');
    const startGameBtn = document.getElementById('startGameBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');

    if (modePVP && modeBot && difficultySection) {
        modePVP.addEventListener('click', () => {
            modePVP.classList.add('active');
            modeBot.classList.remove('active');
            difficultySection.classList.add('hidden');
            isVsBot = false;
        });

        modeBot.addEventListener('click', () => {
            modeBot.classList.add('active');
            modePVP.classList.remove('active');
            difficultySection.classList.remove('hidden');
            isVsBot = true;
        });
    }

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const level = e.target.getAttribute('data-level') || e.target.value;
            botDifficulty = parseInt(level) || 1; 
        });
    });

    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            if (setupModal) setupModal.classList.add('hidden');
            if (modeIndicator) {
                modeIndicator.innerText = `Modo: ${isVsBot ? 'Contra Bot (Nivel ' + botDifficulty + ')' : 'Local 1v1'}`;
            }
            initGame();
        });
    }

    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', () => {
            if (setupModal) setupModal.classList.remove('hidden');
        });
    }

    // Inicializar Tablero Base FIDE
    function initGame() {
        boardState = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
        turn = 'w';
        selectedSquare = null;
        possibleMoves = [];
        moveHistory = [];
        enPassantTarget = null;
        castleRights = { w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } };
        gameActive = true;
        
        if (moveLog) moveLog.innerHTML = '';
        updateStatus();
        renderBoard();
    }

    function renderBoard() {
        if (!boardElement) return;
        boardElement.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = r;
                square.dataset.col = c;

                const piece = boardState[r][c];
                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.classList.add('piece');
                    pieceElement.innerHTML = unicodePieces[piece] || '';
                    pieceElement.style.color = piece === piece.toUpperCase() ? '#ffffff' : '#1a1a1a';
                    square.appendChild(pieceElement);
                }

                if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
                    square.classList.add('selected');
                }
                if (possibleMoves.some(m => m.row === r && m.col === c)) {
                    square.classList.add('hint');
                }

                square.addEventListener('click', () => handleSquareClick(r, c));
                boardElement.appendChild(square);
            }
        }
    }

    function handleSquareClick(r, c) {
        if (!gameActive || (isVsBot && turn === 'b')) return;

        const clickedPiece = boardState[r][c];
        const isOwnPiece = clickedPiece && (turn === 'w' ? clickedPiece === clickedPiece.toUpperCase() : clickedPiece === clickedPiece.toLowerCase());

        const move = possibleMoves.find(m => m.row === r && m.col === c);
        if (move) {
            executeMove(selectedSquare.row, selectedSquare.col, r, c, move.type);
            return;
        }

        if (isOwnPiece) {
            selectedSquare = { row: r, col: c };
            possibleMoves = getStrictLegalMoves(r, c); // Filtro estricto contra Jaques
            renderBoard();
        } else {
            selectedSquare = null;
            possibleMoves = [];
            renderBoard();
        }
    }

    // --- LÓGICA DE DETECCIÓN DE AMENAZAS (FIDE) ---
    function findKing(board, color) {
        const targetKing = color === 'w' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === targetKing) return { row: r, col: c };
            }
        }
        return null;
    }

    function isSquareAttacked(board, r, c, attackerColor) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (!piece) continue;
                
                const isAttacker = attackerColor === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
                if (!isAttacker) continue;

                const pseudoMoves = calculatePseudoLegalMoves(board, row, col, attackerColor);
                if (pseudoMoves.some(m => m.row === r && m.col === c)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Filtra los movimientos para que el jugador nunca pueda quedar o mantenerse en Jaque
    function getStrictLegalMoves(r, c) {
        const pseudoMoves = calculatePseudoLegalMoves(boardState, r, c, turn);
        const legalMoves = [];
        const enemyColor = turn === 'w' ? 'b' : 'w';

        pseudoMoves.forEach(move => {
            // Clonar tablero para simular la jugada
            const tempBoard = boardState.map(row => [...row]);
            const piece = tempBoard[r][c];

            if (move.type === 'enPassant') {
                const dir = turn === 'w' ? -1 : 1;
                tempBoard[move.row - dir][move.col] = null;
            }
            
            tempBoard[move.row][move.col] = piece;
            tempBoard[r][c] = null;

            const kingPos = findKing(tempBoard, turn);
            if (kingPos) {
                const isKingCheck = isSquareAttacked(tempBoard, kingPos.row, kingPos.col, enemyColor);
                
                // Validación especial para enroque (no pasar por casillas atacadas)
                if (move.type && move.type.startsWith('castle')) {
                    const currentKingCheck = isSquareAttacked(boardState, r, c, enemyColor);
                    const passCol = move.type === 'castleKing' ? 5 : 3;
                    const passCheck = isSquareAttacked(boardState, r, passCol, enemyColor);
                    
                    if (!isKingCheck && !currentKingCheck && !passCheck) {
                        legalMoves.push(move);
                    }
                } else if (!isKingCheck) {
                    legalMoves.push(move);
                }
            }
        });

        return legalMoves;
    }

    function calculatePseudoLegalMoves(board, r, c, playerColor) {
        const piece = board[r][c];
        if (!piece) return [];
        
        let moves = [];
        const type = piece.toLowerCase();
        const isWhite = playerColor === 'w';
        const dir = isWhite ? -1 : 1;

        if (type === 'p') {
            if (board[r + dir] && !board[r + dir][c]) {
                moves.push({ row: r + dir, col: c, type: 'normal' });
                const startRow = isWhite ? 6 : 1;
                if (r === startRow && board[r + 2 * dir] && !board[r + 2 * dir][c]) {
                    moves.push({ row: r + 2 * dir, col: c, type: 'double' });
                }
            }
            const capCols = [c - 1, c + 1];
            capCols.forEach(cc => {
                if (cc >= 0 && cc < 8 && board[r + dir]) {
                    const target = board[r + dir][cc];
                    if (target && (isWhite ? target === target.toLowerCase() : target === target.toUpperCase())) {
                        moves.push({ row: r + dir, col: cc, type: 'normal' });
                    }
                    if (enPassantTarget && enPassantTarget.row === r + dir && enPassantTarget.col === cc) {
                        moves.push({ row: r + dir, col: cc, type: 'enPassant' });
                    }
                }
            });
        }

        if (type === 'n') {
            const nMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
            nMoves.forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const target = board[nr][nc];
                    if (!target || (isWhite ? target === target.toLowerCase() : target === target.toUpperCase())) {
                        moves.push({ row: nr, col: nc, type: 'normal' });
                    }
                }
            });
        }

        if (type === 'r' || type === 'b' || type === 'q') {
            let directions = [];
            if (type === 'r' || type === 'q') directions.push([0, 1], [0, -1], [1, 0], [-1, 0]);
            if (type === 'b' || type === 'q') directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

            directions.forEach(([dr, dc]) => {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const target = board[nr][nc];
                    if (!target) {
                        moves.push({ row: nr, col: nc, type: 'normal' });
                    } else {
                        if (isWhite ? target === target.toLowerCase() : target === target.toUpperCase()) {
                            moves.push({ row: nr, col: nc, type: 'normal' });
                        }
                        break;
                    }
                    nr += dr; nc += dc;
                }
            });
        }

        if (type === 'k') {
            const kMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
            kMoves.forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const target = board[nr][nc];
                    if (!target || (isWhite ? target === target.toLowerCase() : target === target.toUpperCase())) {
                        moves.push({ row: nr, col: nc, type: 'normal' });
                    }
                }
            });

            const rights = castleRights[playerColor];
            const kingRow = isWhite ? 7 : 0;
            if (r === kingRow && c === 4 && rights) {
                if (rights.kingSide && !board[kingRow][5] && !board[kingRow][6]) {
                    moves.push({ row: kingRow, col: 6, type: 'castleKing' });
                }
                if (rights.queenSide && !board[kingRow][3] && !board[kingRow][2] && !board[kingRow][1]) {
                    moves.push({ row: kingRow, col: 2, type: 'castleQueen' });
                }
            }
        }

        return moves;
    }

    function executeMove(fromR, fromC, toR, toC, moveType) {
        const piece = boardState[fromR][fromC];
        
        if (moveType === 'enPassant') {
            const dir = turn === 'w' ? -1 : 1;
            boardState[toR - dir][toC] = null;
        } else if (moveType === 'castleKing') {
            const kingRow = fromR;
            boardState[kingRow][5] = boardState[kingRow][7];
            boardState[kingRow][7] = null;
        } else if (moveType === 'castleQueen') {
            const kingRow = fromR;
            boardState[kingRow][3] = boardState[kingRow][0];
            boardState[kingRow][0] = null;
        }

        boardState[toR][toC] = piece;
        boardState[fromR][fromC] = null;

        if (piece.toLowerCase() === 'p' && (toR === 0 || toR === 7)) {
            boardState[toR][toC] = turn === 'w' ? 'Q' : 'q';
        }

        if (piece === 'K') { castleRights.w.kingSide = false; castleRights.w.queenSide = false; }
        if (piece === 'k') { castleRights.b.kingSide = false; castleRights.b.queenSide = false; }
        if (fromR === 7 && fromC === 7) castleRights.w.kingSide = false;
        if (fromR === 7 && fromC === 0) castleRights.w.queenSide = false;
        if (fromR === 0 && fromC === 7) castleRights.b.kingSide = false;
        if (fromR === 0 && fromC === 0) castleRights.b.queenSide = false;

        if (moveType === 'double') {
            enPassantTarget = { row: (fromR + toR) / 2, col: fromC };
        } else {
            enPassantTarget = null;
        }

        logMove(piece, fromR, fromC, toR, toC);

        turn = turn === 'w' ? 'b' : 'w';
        selectedSquare = null;
        possibleMoves = [];
        
        if (checkGameOver()) return;

        updateStatus();
        renderBoard();

        if (gameActive && isVsBot && turn === 'b') {
            setTimeout(makeBotMove, 600);
        }
    }

    // --- DETECTOR DE JAQUE MATE / TABLAS RE REALES ---
    function checkGameOver() {
        let currentMovesCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = boardState[r][c];
                if (p && (turn === 'w' ? p === p.toUpperCase() : p === p.toLowerCase())) {
                    currentMovesCount += getStrictLegalMoves(r, c).length;
                }
            }
        }

        if (currentMovesCount === 0) {
            const kingPos = findKing(boardState, turn);
            const enemyColor = turn === 'w' ? 'b' : 'w';
            let inCheck = false;
            if (kingPos) {
                inCheck = isSquareAttacked(boardState, kingPos.row, kingPos.col, enemyColor);
            }

            if (statusPanel) {
                if (inCheck) {
                    statusPanel.innerText = `¡Jaque Mate! Ganaron las ${turn === 'w' ? 'Negras ⚫' : 'Blancas ⚪'}`;
                } else {
                    statusPanel.innerText = "Partida terminada: Tablas por Ahogado 🤝";
                }
            }
            gameActive = false;
            return true;
        }
        return false;
    }

    function logMove(piece, fromR, fromC, toR, toC) {
        if (!moveLog) return;
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
        const notation = `${piece.toUpperCase() !== 'P' ? piece.toUpperCase() : ''}${files[fromC]}${rows[fromR]}→${files[toC]}${rows[toC]}`;
        
        if (turn === 'w') {
            const p = document.createElement('p');
            p.innerText = `${moveHistory.length + 1}. ${notation}`;
            moveLog.appendChild(p);
            moveHistory.push(notation); // Guarda el par completo de la ronda al mover blancas
        } else {
            const lastLog = moveLog.lastElementChild;
            if (lastLog) {
                lastLog.innerText += `  |  ${notation}`;
            }
        }
        moveLog.scrollTop = moveLog.scrollHeight;
    }

    function updateStatus() {
        if (!statusPanel) return;
        const kingPos = findKing(boardState, turn);
        const enemyColor = turn === 'w' ? 'b' : 'w';
        const inCheck = kingPos ? isSquareAttacked(boardState, kingPos.row, kingPos.col, enemyColor) : false;

        if (turn === 'w') {
            statusPanel.innerText = inCheck ? "⚠️ ¡Tu Rey está en JAQUE! (Blancas)" : "Turno de las Blancas ⚪";
        } else {
            statusPanel.innerText = inCheck ? "⚠️ ¡JAQUE! Pensando..." : "Pensando las Negras ⚫";
        }
    }

    // GENERADOR FEN COMPLETO (Estándar FIDE para la API)
    function generateFullFEN() {
        let fenRows = [];
        for (let r = 0; r < 8; r++) {
            let emptyCount = 0;
            let fenRow = '';
            for (let c = 0; c < 8; c++) {
                const piece = boardState[r][c];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fenRow += emptyCount;
                        emptyCount = 0;
                    }
                    fenRow += piece;
                }
            }
            if (emptyCount > 0) fenRow += emptyCount;
            fenRows.push(fenRow);
        }

        // Derechos de enroque
        let castling = '';
        if (castleRights.w.kingSide) castling += 'K';
        if (castleRights.w.queenSide) castling += 'Q';
        if (castleRights.b.kingSide) castling += 'k';
        if (castleRights.b.queenSide) castling += 'q';
        if (castling === '') castling = '-';

        // Peón al paso en formato oficial (ej: e3)
        let epTargetStr = '-';
        if (enPassantTarget && typeof enPassantTarget === 'object') {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
            epTargetStr = files[enPassantTarget.col] + rows[enPassantTarget.row];
        }

        return `${fenRows.join('/')} ${turn} ${castling} ${epTargetStr} 0 ${moveHistory.length + 1}`;
    }

    async function makeBotMove() {
        const currentFen = generateFullFEN();
        const depthMap = { 1: 4, 2: 8, 3: 14 }; // Profundidades calibradas para un comportamiento óptimo
        
        try {
            const response = await fetch(`https://chess-api.com/v1/chess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: currentFen, depth: depthMap[botDifficulty] })
            });
            const data = await response.json();
            
            if (data && data.bestmove) {
                const fromStr = data.bestmove.substring(0,2);
                const toStr = data.bestmove.substring(2,4);

                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
                
                const fromC = files.indexOf(fromStr[0]);
                const fromR = rows.indexOf(fromStr[1]);
                const toC = files.indexOf(toStr[0]);
                const toR = rows.indexOf(toStr[1]);

                if (boardState[fromR] && boardState[fromR][fromC]) {
                    let mType = 'normal';
                    const piece = boardState[fromR][fromC];
                    if (piece.toLowerCase() === 'k' && Math.abs(fromC - toC) === 2) {
                        mType = toC > fromC ? 'castleKing' : 'castleQueen';
                    }
                    executeMove(fromR, fromC, toR, toC, mType);
                    return;
                }
            }
            fallbackRandomMove(); 
        } catch (error) {
            console.error("Error consultando Stockfish API, usando fallback:", error);
            fallbackRandomMove();
        }
    }

    function fallbackRandomMove() {
        let allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = boardState[r][c];
                if (piece && piece === piece.toLowerCase()) {
                    const moves = getStrictLegalMoves(r, c);
                    moves.forEach(m => allMoves.push({ fromR: r, fromC: c, toR: m.row, toC: m.col, type: m.type }));
                }
            }
        }

        if (allMoves.length > 0) {
            const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
            executeMove(randomMove.fromR, randomMove.fromC, randomMove.toR, randomMove.toC, randomMove.type);
        } else {
            checkGameOver();
        }
    }
});