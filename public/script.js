// API base URL
const API_BASE = '/api';
let currentGameId = null;
let allPlayers = [];
let currentGame = null;
let editingPlayerId = null; // when set, player form will perform update instead of create
let editingLoanId = null; // when set, loan form will perform update instead of create

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadPlayers();
    loadGames();
    setupEventListeners();
});

function setupEventListeners() {
    // ... existing code ...
    
    // Game Details Modal Buttons - UPDATE THESE:
    document.getElementById('update-balance-btn')?.addEventListener('click', () => {
        populateBalanceModal();
        openModal('update-balance-modal');
    });
    document.getElementById('add-loan-btn')?.addEventListener('click', () => {
        populateLoanModal();
        openModal('loan-modal');
    });
    // Open new game/player modals
    document.getElementById('add-player-btn')?.addEventListener('click', () => openModal('player-modal'));
    document.getElementById('add-game-btn')?.addEventListener('click', () => openModal('game-modal'));
    // Game form submit handler
    document.getElementById('game-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        handleGameSubmit(e);
    });
    // Cancel game button
    document.getElementById('cancel-game')?.addEventListener('click', () => {
        const form = document.getElementById('game-form');
        if (form) form.reset();
        closeModal('game-modal');
    });
    document.getElementById('mark-completed-btn')?.addEventListener('click', markGameAsCompleted);
    document.getElementById('add-player-to-game-btn')?.addEventListener('click', addPlayerToGame);
    document.getElementById('delete-game-btn')?.addEventListener('click', deleteCurrentGame);
    document.getElementById('save-notes-btn')?.addEventListener('click', saveGameNotes);

    // Player modal form (Add New Player) - prevent full page submit and call handler
    document.getElementById('player-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePlayerSubmit(e);
    });

    // Header image is now static and displays the Teen Patti artwork.
    // Removed dynamic upload/edit/delete handlers to avoid referencing elements that were removed from the HTML.

    // Cancel / reset player modal
    document.getElementById('cancel-player')?.addEventListener('click', () => {
        resetPlayerModal();
        closeModal('player-modal');
    });

    // Remove image button in player modal
    document.getElementById('remove-player-image-btn')?.addEventListener('click', () => {
        const fileInput = document.getElementById('player-image-file');
        const preview = document.getElementById('player-image-preview');
        if (fileInput) {
            fileInput.value = '';
            fileInput.removeAttribute('data-file');
            fileInput.setAttribute('data-removed', 'true');
        }
        if (preview) preview.innerHTML = '';
    });

    // Extra: ensure Add Player button triggers the form submit reliably (some browsers / markup might submit unexpectedly)
    const playerForm = document.getElementById('player-form');
    const confirmNewPlayerBtn = document.getElementById('confirm-new-player-btn');
    if (confirmNewPlayerBtn && playerForm) {
        // Only add a manual requestSubmit shim when the button is NOT a native submit button
        // If the button is type="submit" and inside the form, the browser will submit normally.
        const btnType = (confirmNewPlayerBtn.getAttribute('type') || confirmNewPlayerBtn.type || '').toLowerCase();
        if (btnType !== 'submit') {
            confirmNewPlayerBtn.addEventListener('click', (e) => {
                // let the form submit handler handle it
                if (typeof playerForm.requestSubmit === 'function') {
                    playerForm.requestSubmit();
                } else {
                    playerForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            });
        }
    }

    // Update Balance Form
    document.getElementById('update-balance-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        updatePlayerBalance();
    });

    // Preview selected player image and clear removed flag
    const playerFileInput = document.getElementById('player-image-file');
    if (playerFileInput) {
        playerFileInput.addEventListener('change', function() {
            // clear removed flag when a new file is chosen
            this.removeAttribute('data-removed');
            const preview = document.getElementById('player-image-preview');
            if (this.files && this.files[0] && preview) {
                // Open cropper to allow the user to choose the exact area to use for the player image
                const file = this.files[0];
                const targetW = 300; // preview/upload width
                const targetH = 150; // preview/upload height
                openImageCropper(file, targetW, targetH)
                    .then(croppedBlob => {
                        if (!croppedBlob) return; // cancelled
                        const reader = new FileReader();
                        reader.onload = function(ev) {
                            preview.innerHTML = `<img src="${ev.target.result}" style="max-width:100%; max-height:100%; border-radius:4px">`;
                        };
                        reader.readAsDataURL(croppedBlob);
                        try { playerFileInput._resizedBlob = croppedBlob; } catch (_) {}
                    })
                    .catch(err => console.error('Error cropping player image', err));
            }
        });
    }

    // Cropper modal wiring and implementation
    // Elements
    const cropperModal = document.getElementById('image-cropper-modal');
    const cropperImage = document.getElementById('cropper-image');
    const cropperZoom = document.getElementById('cropper-zoom');
    const cropperPreviewCanvas = document.getElementById('cropper-preview-canvas');
    const cropperConfirm = document.getElementById('cropper-confirm');
    const cropperCancel = document.getElementById('cropper-cancel');

    // Internal state
    let _cropResolve = null;
    let _cropReject = null;
    let _imgNaturalW = 0, _imgNaturalH = 0;
    let _stageW = 0, _stageH = 0;
    let _scale = 1; // current scale
    let _minScale = 1; // ensures the image covers stage
    let _tx = 0, _ty = 0; // image top-left offset in px relative to stage
    let _isDragging = false; let _dragStart = {x:0,y:0}; let _startTx = 0, _startTy = 0;

    function openCropperForFile(file) {
        // default sizes if not provided
        return openImageCropper(file, 300, 300);
    }

    function openImageCropper(file, outW, outH) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            _cropResolve = resolve; _cropReject = reject;
            const reader = new FileReader();
            reader.onload = function(e) {
                cropperImage.src = e.target.result;
                // show modal
                cropperModal.style.display = 'flex';
                // reset transforms
                _tx = 0; _ty = 0; _scale = 1;
                // store desired output size on modal element
                cropperModal._outW = outW; cropperModal._outH = outH;
            };
            reader.readAsDataURL(file);
        });
    }

    // When image loads, compute fitting scale so image covers the stage and center it
    cropperImage.addEventListener('load', () => {
        _imgNaturalW = cropperImage.naturalWidth;
        _imgNaturalH = cropperImage.naturalHeight;
        const stage = cropperImage.parentElement; // .cropper-stage
        _stageW = stage.clientWidth; _stageH = stage.clientHeight;
        // compute minScale to cover stage
        _minScale = Math.max(_stageW / _imgNaturalW, _stageH / _imgNaturalH);
        _scale = _minScale;
        // center image
        const imgW = _imgNaturalW * _scale, imgH = _imgNaturalH * _scale;
        _tx = Math.round((_stageW - imgW) / 2);
        _ty = Math.round((_stageH - imgH) / 2);
        // set zoom input range
        if (cropperZoom) {
            cropperZoom.min = String(_minScale);
            cropperZoom.max = String(_minScale * 3);
            cropperZoom.step = '0.01';
            cropperZoom.value = String(_scale);
        }
        applyTransform();
        updatePreview();
    });

    function applyTransform() {
        // set image size and position
        const w = Math.round(_imgNaturalW * _scale);
        const h = Math.round(_imgNaturalH * _scale);
        cropperImage.style.width = w + 'px';
        cropperImage.style.height = h + 'px';
        cropperImage.style.left = _tx + 'px';
        cropperImage.style.top = _ty + 'px';
    }

    function updatePreview() {
        if (!cropperPreviewCanvas) return;
        const ctx = cropperPreviewCanvas.getContext('2d');
        const pw = cropperPreviewCanvas.width = cropperPreviewCanvas.clientWidth || 140;
        const ph = cropperPreviewCanvas.height = cropperPreviewCanvas.clientHeight || 140;
        // compute source rect on the original image
        const sx = Math.max(0, Math.round(-_tx / _scale));
        const sy = Math.max(0, Math.round(-_ty / _scale));
        const sw = Math.round(_stageW / _scale);
        const sh = Math.round(_stageH / _scale);
        // clear
        ctx.clearRect(0,0,pw,ph);
        // draw portion scaled to preview size
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,pw,ph);
        try {
            ctx.drawImage(cropperImage, sx, sy, sw, sh, 0, 0, pw, ph);
        } catch (err) {
            // sometimes drawing too early
        }
    }

    // Zoom control
    if (cropperZoom) {
        cropperZoom.addEventListener('input', (e) => {
            const newScale = Number(e.target.value);
            if (!isFinite(newScale) || newScale <= 0) return;
            // adjust tx/ty to keep the image centered relative to previous center
            const prevCenterX = (-_tx + _stageW/2) / _scale;
            const prevCenterY = (-_ty + _stageH/2) / _scale;
            _scale = newScale;
            const newImgW = _imgNaturalW * _scale, newImgH = _imgNaturalH * _scale;
            _tx = Math.round(-prevCenterX * _scale + _stageW/2);
            _ty = Math.round(-prevCenterY * _scale + _stageH/2);
            applyTransform(); updatePreview();
        });
    }

    // Drag to pan
    cropperImage.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        cropperImage.setPointerCapture(ev.pointerId);
        _isDragging = true;
        _dragStart = { x: ev.clientX, y: ev.clientY };
        _startTx = _tx; _startTy = _ty;
    });
    cropperImage.addEventListener('pointermove', (ev) => {
        if (!_isDragging) return;
        const dx = ev.clientX - _dragStart.x;
        const dy = ev.clientY - _dragStart.y;
        _tx = Math.round(_startTx + dx);
        _ty = Math.round(_startTy + dy);
        // Constrain so image always covers stage (no empty space)
        const imgW = _imgNaturalW * _scale, imgH = _imgNaturalH * _scale;
        const minTx = Math.min(0, _stageW - imgW);
        const minTy = Math.min(0, _stageH - imgH);
        _tx = Math.min(Math.max(_tx, minTx), 0);
        _ty = Math.min(Math.max(_ty, minTy), 0);
        applyTransform(); updatePreview();
    });
    cropperImage.addEventListener('pointerup', (ev) => {
        _isDragging = false; try { cropperImage.releasePointerCapture(ev.pointerId); } catch(e){}
    });
    cropperImage.addEventListener('pointercancel', () => { _isDragging = false; });

    // Cancel
    if (cropperCancel) cropperCancel.addEventListener('click', () => {
        cropperModal.style.display = 'none';
        if (_cropResolve) { _cropResolve(null); _cropResolve = null; }
    });

    // Confirm and produce the cropped Blob at desired output size
    if (cropperConfirm) cropperConfirm.addEventListener('click', () => {
        const outW = cropperModal._outW || 300;
        const outH = cropperModal._outH || 300;
        // compute source rect on original image
        const sx = Math.max(0, Math.round(-_tx / _scale));
        const sy = Math.max(0, Math.round(-_ty / _scale));
        const sw = Math.round(_stageW / _scale);
        const sh = Math.round(_stageH / _scale);
        const canvas = document.createElement('canvas');
        canvas.width = outW; canvas.height = outH;
        const ctx = canvas.getContext('2d');
        // white background
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,outW,outH);
        ctx.drawImage(cropperImage, sx, sy, sw, sh, 0, 0, outW, outH);
        canvas.toBlob((blob) => {
            cropperModal.style.display = 'none';
            if (_cropResolve) { _cropResolve(blob); _cropResolve = null; }
        }, 'image/jpeg', 0.9);
    });

    // Add / Edit Loan Form
    document.getElementById('loan-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLoanSubmit();
    });
}

    // Close buttons inside modals
    document.querySelectorAll('.modal .close').forEach(el => {
        el.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    // Clicking the overlay (outside modal-content) closes the modal
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => {
                if (m.style.display === 'flex') closeModal(m.id);
            });
        }
    });

    // Game Details tab buttons inside the modal
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            if (tab) switchGameDetailTab(tab);
        });
    });
// Navigation
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.tab-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Update active button
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // Show/hide tab content (IDs use the pattern '<tabName>-tab' in the HTML)
    document.querySelectorAll('.tab-content').forEach(section => section.classList.remove('active'));
    const section = document.getElementById(`${tabName}-tab`);
    if (section) section.classList.add('active');
    
    // Load appropriate data
    switch(tabName) {
        case 'players':
            loadPlayers();
            break;
        case 'games':
            loadGames();
            break;
        case 'loans':
            loadLoans();
            break;
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Player Functions
async function loadPlayers() {
    try {
        const response = await fetch(`${API_BASE}/players`);
        const players = await response.json();
        allPlayers = players || [];
        displayPlayers(players);
    } catch (error) {
        console.error('Error loading players:', error);
        showError('Failed to load players');
    }
}

function displayPlayers(players) {
    const container = document.getElementById('players-container') || document.getElementById('players-list');
    if (!container) return;
    
    if (players.length === 0) {
        container.innerHTML = '<p class="no-data">No players found. Add some players to get started!</p>';
        return;
    }
    
    container.innerHTML = players.map(player => `
        <div class="player-card">
            <div class="player-image" style="${player.image ? `background-image: url('${player.image}');` : ''}">
                ${player.image ? '' : 'Player Image'}
            </div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-joined">Joined: ${new Date(player.created_at).toLocaleDateString()}</div>
            </div>
            <div class="player-actions">
                <button class="btn btn-edit" onclick="editPlayer(${player.id})">Edit</button>
                <button class="btn btn-delete" onclick="deletePlayer(${player.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function handlePlayerSubmit(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('player-name').value;
    if (!playerName || playerName.trim() === '') {
        return showError('Player name is required');
    }
    // Prevent exact duplicate names (case-insensitive) on create or update
    const normalized = playerName.trim().toLowerCase();
    const duplicate = (allPlayers || []).find(p => String(p.name || '').trim().toLowerCase() === normalized);
    if (duplicate) {
        // If we're editing, allow if the duplicate is the same player being edited
        if (!editingPlayerId || Number(duplicate.id) !== Number(editingPlayerId)) {
            return showError('A player with that name already exists');
        }
    }
    const fileInput = document.getElementById('player-image-file');
    const removedFlag = fileInput && fileInput.getAttribute('data-removed') === 'true';
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

    try {
        if (editingPlayerId) {
            // Update existing player. If a file is selected, use FormData; otherwise send JSON with optional removeImage flag.
            let response;
                if (hasFile) {
                    const fd = new FormData();
                    fd.append('name', playerName);
                    // if we stored a resized blob on the input, use it
                    const resized = fileInput._resizedBlob;
                    if (resized) {
                        fd.append('image', resized, fileInput.files[0]?.name || 'player.jpg');
                    } else {
                        fd.append('image', fileInput.files[0]);
                    }
                    response = await fetch(`${API_BASE}/players/${editingPlayerId}`, {
                        method: 'PUT',
                        body: fd
                    });
                } else {
                const payload = { name: playerName };
                if (removedFlag) payload.removeImage = true;
                const resp = await fetch(`${API_BASE}/players/${editingPlayerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                response = resp;
            }

            if (response && response.ok) {
                showSuccess('Player updated successfully!');
                // refresh players and state
                await loadPlayers();
                resetPlayerModal();
                closeModal('player-modal');
            } else {
                const err = response ? await response.json().catch(() => ({})) : {};
                showError(err.message || 'Failed to update player');
            }
        } else {
            // Create new player. If file selected, use FormData.
            let response;
            if (hasFile) {
                const fd = new FormData();
                fd.append('name', playerName);
                const resized = fileInput._resizedBlob;
                if (resized) {
                    fd.append('image', resized, fileInput.files[0]?.name || 'player.jpg');
                } else {
                    fd.append('image', fileInput.files[0]);
                }
                response = await fetch(`${API_BASE}/players`, { method: 'POST', body: fd });
            } else {
                response = await fetch(`${API_BASE}/players`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: playerName, image: null })
                });
            }

            if (response && response.ok) {
                showSuccess('Player added successfully!');
                await loadPlayers();
                resetPlayerModal();
                closeModal('player-modal');
            } else {
                const err = response ? await response.json().catch(() => ({})) : {};
                showError(err.message || 'Failed to add player');
            }
        }
    } catch (error) {
        console.error('Error submitting player form:', error);
        // Show the underlying error message when available to aid debugging
        const msg = (error && error.message) ? `Failed to save player: ${error.message}` : 'Failed to save player';
        showError(msg);
    }
}

// Reset the player modal to default "add" state
function resetPlayerModal() {
    editingPlayerId = null;
    const title = document.getElementById('player-modal-title');
    const confirmBtn = document.getElementById('confirm-new-player-btn');
    const form = document.getElementById('player-form');
    const imgInput = document.getElementById('player-image-file');
    const preview = document.getElementById('player-image-preview');
    if (title) title.textContent = 'Add New Player';
    if (confirmBtn) confirmBtn.textContent = 'Add Player';
    if (form) form.reset();
    if (imgInput) { imgInput.removeAttribute('data-removed'); imgInput.value = ''; }
    if (preview) preview.innerHTML = '';
}

async function deletePlayer(playerId) {
    if (confirm('Are you sure you want to delete this player?')) {
        try {
            const response = await fetch(`${API_BASE}/players/${playerId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Player deleted successfully!');
                loadPlayers();
            } else {
                showError('Failed to delete player');
            }
        } catch (error) {
            console.error('Error deleting player:', error);
            showError('Failed to delete player');
        }
    }
}

// Game Functions
async function loadGames() {
    try {
        const response = await fetch(`${API_BASE}/games`);
        const games = await response.json();
        displayGames(games);
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games');
    }
}

function displayGames(games) {
    const container = document.getElementById('games-list');
    if (!container) return;
    
    if (games.length === 0) {
        container.innerHTML = '<p class="no-data">No games found. Create a game to start tracking!</p>';
        return;
    }
    
    container.innerHTML = games.map(game => `
        <div class="game-card" onclick="showGameDetails(${game.id})">
            <div class="game-image" style="${game.image ? `background-image: url('${game.image}');` : ''}">
            </div>
            <div class="game-info">
                <div class="game-header">
                    <div class="game-name">${game.name}</div>
                    <div class="game-status ${game.status === 'active' ? 'status-active' : 'status-completed'}">
                        ${game.status}
                    </div>
                </div>
                <div class="game-details">
                    <div class="game-date">${formatDate(game.date)}</div>
                    <div class="game-stats">
                        Players: ${game.players ? game.players.length : 0}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleGameSubmit(e) {
    e.preventDefault();
    
    const gameName = document.getElementById('game-name').value;
    const gameDate = document.getElementById('game-date').value;
    const gameStatus = document.getElementById('game-status').value;
    
    try {
        const response = await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: gameName,
                date: gameDate,
                status: gameStatus,
                notes: ''
            })
        });
        
        if (response.ok) {
            showSuccess('Game created successfully!');
            loadGames();
            closeModal('game-modal');
            e.target.reset();
        } else {
            showError('Failed to create game');
        }
    } catch (error) {
        console.error('Error adding game:', error);
        showError('Failed to create game');
    }
}



function renderGameDetails(game) {
    document.getElementById('game-details-title').textContent = game.name;
    document.getElementById('detail-status').textContent = game.status;
    document.getElementById('detail-status').className = `status-badge ${game.status === 'active' ? 'status-active' : 'status-completed'}`;
    document.getElementById('detail-date').textContent = formatDate(game.date);
    document.getElementById('detail-total-players').textContent = game.players ? game.players.length : 0;
    
    updateGameStats(game);
    renderGameBalances(game);
    renderGameLoans(game);
    updateGameLoansStats(game);
    // Populate add-player dropdown for this game
    populateAddPlayerDropdown(game);
    // store current game object for other modals/actions
    currentGame = game;
}

// Fetch loans for the game and update overview counts / totals
async function updateGameLoansStats(game) {
    try {
        const resp = await fetch(`${API_BASE}/loans`);
        const loans = await resp.json();
        const gameLoans = (loans || []).filter(l => Number(l.game) === Number(game.id));

        // Active loans: consider status !== 'closed' (or status === 'active')
        const activeLoans = gameLoans.filter(l => !l.status || l.status.toLowerCase() !== 'closed');

        // Sum remaining amounts = amount - repaid_amount
        const totalRemaining = activeLoans.reduce((sum, l) => {
            const amt = Number(l.amount) || 0;
            const repaid = Number(l.repaid_amount) || 0;
            return sum + Math.max(0, amt - repaid);
        }, 0);

        const activeLoansEl = document.getElementById('detail-active-loans');
        if (activeLoansEl) activeLoansEl.textContent = activeLoans.length;

        const totalLoanEl = document.getElementById('total-loan-amount');
        if (totalLoanEl) totalLoanEl.textContent = `₹${totalRemaining}`;
    } catch (err) {
        console.error('Error updating game loans stats', err);
    }
}

// Populate the Update Balance modal with players from the current game
function populateBalanceModal() {
    const select = document.getElementById('balance-player');
    const amountInput = document.getElementById('balance-amount');
    if (!select || !amountInput) return;

    const game = currentGame;
    if (!game || !game.players) {
        select.innerHTML = '<option value="">No players</option>';
        select.disabled = true;
        amountInput.value = '';
        amountInput.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = game.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Set amount input to selected player's balance
    const setAmountForSelected = () => {
        const pid = Number(select.value);
        const p = game.players.find(x => x.id === pid);
        amountInput.value = p ? (p.balance || 0) : 0;
    };

    select.addEventListener('change', setAmountForSelected);
    setAmountForSelected();
}

// Update player balance in the current game
async function updatePlayerBalance() {
    const select = document.getElementById('balance-player');
    const amountInput = document.getElementById('balance-amount');
    const cancelBtn = document.getElementById('cancel-balance');

    if (!select || !amountInput) return showError('Balance UI not found');
    const playerId = select.value;
    const balance = Number(amountInput.value);
    if (!playerId) return showError('Select a player');
    if (!currentGameId) return showError('No game selected');

    try {
        // disable inputs while updating
        select.disabled = true;
        amountInput.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;

        const response = await fetch(`${API_BASE}/games/${currentGameId}/players/${playerId}/balance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance })
        });

        const data = await response.json();
        if (!response.ok) {
            return showError(data.message || 'Failed to update balance');
        }

        showSuccess('Balance updated');
        // refresh UI
        await showGameDetails(currentGameId);
        await loadGames();
        closeModal('update-balance-modal');
    } catch (err) {
        console.error('Error updating balance', err);
        showError('Failed to update balance');
    } finally {
        if (select) select.disabled = false;
        if (amountInput) amountInput.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
    }
}

// Populate the Add Player dropdown with players NOT already in the game
function populateAddPlayerDropdown(game) {
    const select = document.getElementById('add-player-dropdown');
    if (!select) return;

    // Build a set of existing player IDs in this game
    const existingIds = new Set((game.players || []).map(p => p.id));

    // Filter allPlayers to only those not in the game
    const available = (allPlayers || []).filter(p => !existingIds.has(p.id));

    // Clear and add default option
    select.innerHTML = '<option value="">Select Player</option>';

    if (available.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No available players';
        select.appendChild(opt);
        select.disabled = true;
        return;
    }

    select.disabled = false;
    available.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

function updateGameStats(game) {
    if (!game.players || game.players.length === 0) {
        document.getElementById('highest-balance').textContent = '₹0';
        document.getElementById('highest-player').textContent = '-';
        document.getElementById('lowest-balance').textContent = '₹0';
        document.getElementById('lowest-player').textContent = '-';
        return;
    }
    
    let highestBalance = -Infinity;
    let lowestBalance = Infinity;
    let highestPlayer = '';
    let lowestPlayer = '';
    
    game.players.forEach(playerData => {
        const balance = playerData.balance || 0;
        if (balance > highestBalance) {
            highestBalance = balance;
            highestPlayer = playerData.name || playerData.player?.name || 'Unknown';
        }
        if (balance < lowestBalance) {
            lowestBalance = balance;
            lowestPlayer = playerData.name || playerData.player?.name || 'Unknown';
        }
    });
    
    document.getElementById('highest-balance').textContent = `₹${highestBalance}`;
    document.getElementById('highest-player').textContent = highestPlayer;
    document.getElementById('lowest-balance').textContent = `₹${lowestBalance}`;
    document.getElementById('lowest-player').textContent = lowestPlayer;
}

function renderGameBalances(game) {
    const container = document.getElementById('balances-table');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!game.players || game.players.length === 0) {
        container.innerHTML = '<p class="no-data">No players in this game</p>';
        return;
    }
    
    game.players.forEach(playerData => {
        const balance = playerData.balance || 0;
        const playerName = playerData.name || playerData.player?.name || 'Unknown';
        
        const balanceRow = document.createElement('div');
        balanceRow.className = 'balance-row';
        balanceRow.innerHTML = `
            <div class="balance-player">${playerName}</div>
            <div class="balance-amount ${balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                ₹${balance}
            </div>
        `;
        container.appendChild(balanceRow);
    });
}

// Loan Functions (from app.js)
async function loadLoans() {
    try {
        const response = await fetch(`${API_BASE}/loans`);
        const loans = await response.json();
        displayLoans(loans);
    } catch (error) {
        console.error('Error loading loans:', error);
        showError('Failed to load loans');
    }
}

function displayLoans(loans) {
    const container = document.getElementById('loans-list');
    if (!container) return;
    
    if (loans.length === 0) {
        container.innerHTML = '<p class="no-data">No loans found. Record a loan between players!</p>';
        return;
    }
    
    container.innerHTML = loans.map(loan => `
        <div class="card">
            <h3>₹${loan.amount}</h3>
            <p><strong>From:</strong> ${loan.lender.name}</p>
            <p><strong>To:</strong> ${loan.borrower.name}</p>
            <p><strong>Date:</strong> ${new Date(loan.date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span class="status-${loan.status}">${loan.status || 'active'}</span></p>
            <p><strong>Amount Repaid:</strong> ₹${loan.repaid_amount || 0}</p>
            ${loan.notes ? `<p><strong>Notes:</strong><br>${loan.notes.replace(/\n/g,'<br>')}</p>` : ''}
            <div class="actions">
                <button class="btn btn-edit" onclick="repayLoan(${loan.id})">Repay</button>
                <button class="btn btn-edit" onclick="editLoan(${loan.id})">Edit</button>
                <button class="btn btn-delete" onclick="deleteLoan(${loan.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Render loans for the current game inside the Game Details modal
async function renderGameLoans(game) {
    const container = document.getElementById('game-loans-list');
    if (!container) return;

    // Fetch all loans and filter for this game
    try {
        const resp = await fetch(`${API_BASE}/loans`);
        const loans = await resp.json();
        const gameLoans = (loans || []).filter(l => Number(l.game) === Number(game.id));

        if (gameLoans.length === 0) {
            container.innerHTML = '<p class="no-data">No loans for this game</p>';
            return;
        }

        container.innerHTML = gameLoans.map(loan => {
            const remaining = (Number(loan.amount) || 0) - (Number(loan.repaid_amount) || 0);
            const status = (loan.status || 'active');
            const notesHtml = loan.notes ? `<p><strong>Notes / History:</strong><br>${String(loan.notes).replace(/\n/g, '<br>')}</p>` : '';
            return `
            <div class="card">
                <h4>₹${loan.amount}</h4>
                <p><strong>From:</strong> ${loan.lender.name}</p>
                <p><strong>To:</strong> ${loan.borrower.name}</p>
                <p><strong>Date:</strong> ${new Date(loan.date).toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span class="status-${status}">${status}</span></p>
                <p><strong>Repaid:</strong> ₹${loan.repaid_amount || 0} &nbsp; <strong>Remaining:</strong> ₹${remaining}</p>
                ${notesHtml}
                <div class="actions">
                    <button class="btn btn-edit" onclick="repayLoan(${loan.id})">Repay</button>
                    <button class="btn btn-edit" onclick="editLoan(${loan.id})">Edit</button>
                    <button class="btn btn-delete" onclick="deleteLoan(${loan.id})">Delete</button>
                </div>
            </div>
        `;
        }).join('');
    } catch (err) {
        console.error('Error loading game loans', err);
        container.innerHTML = '<p class="no-data">Failed to load loans</p>';
    }
}

// Populate the Add Loan modal with players from the current game
function populateLoanModal() {
    const lender = document.getElementById('loan-lender');
    const borrower = document.getElementById('loan-borrower');
    if (!lender || !borrower) return;

    if (!currentGame || !currentGame.players || currentGame.players.length === 0) {
        lender.innerHTML = '<option value="">No players</option>';
        borrower.innerHTML = '<option value="">No players</option>';
        lender.disabled = true;
        borrower.disabled = true;
        return;
    }

    lender.disabled = false;
    borrower.disabled = false;

    const opts = currentGame.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    lender.innerHTML = opts;
    borrower.innerHTML = opts;
}

// Submit a new loan for the current game
async function addLoanToGame() {
    const lenderEl = document.getElementById('loan-lender');
    const borrowerEl = document.getElementById('loan-borrower');
    const amountEl = document.getElementById('loan-amount');
    const dateEl = document.getElementById('loan-date');
    const notesEl = document.getElementById('loan-notes');

    if (!lenderEl || !borrowerEl || !amountEl || !dateEl) return showError('Loan form not found');

    const lenderId = Number(lenderEl.value);
    const borrowerId = Number(borrowerEl.value);
    const amount = Number(amountEl.value);
    const date = dateEl.value;
    const notes = notesEl ? notesEl.value : '';

    if (!lenderId || !borrowerId) return showError('Select lender and borrower');
    if (!amount || amount <= 0) return showError('Enter a valid amount');
    if (!date) return showError('Select a date');
    if (!currentGameId) return showError('No game selected');

    try {
        // disable inputs while submitting
        lenderEl.disabled = true; borrowerEl.disabled = true; amountEl.disabled = true; dateEl.disabled = true;

        const resp = await fetch(`${API_BASE}/loans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: currentGameId, lenderId, borrowerId, amount, date, notes })
        });

        const data = await resp.json();
        if (!resp.ok) {
            return showError(data.message || 'Failed to add loan');
        }

        showSuccess('Loan recorded');
        // refresh loans in the modal and game stats
        await renderGameLoans(currentGame);
        await loadGames();
        closeModal('loan-modal');
    } catch (err) {
        console.error('Error adding loan', err);
        showError('Failed to add loan');
    } finally {
        if (lenderEl) lenderEl.disabled = false;
        if (borrowerEl) borrowerEl.disabled = false;
        if (amountEl) amountEl.disabled = false;
        if (dateEl) dateEl.disabled = false;
    }
}

// Handle loan form submit - create or update based on editingLoanId
async function handleLoanSubmit() {
    const lenderEl = document.getElementById('loan-lender');
    const borrowerEl = document.getElementById('loan-borrower');
    const amountEl = document.getElementById('loan-amount');
    const dateEl = document.getElementById('loan-date');
    const notesEl = document.getElementById('loan-notes');

    if (!lenderEl || !borrowerEl || !amountEl || !dateEl) return showError('Loan form not found');

    const payload = {
        lenderId: Number(lenderEl.value),
        borrowerId: Number(borrowerEl.value),
        amount: Number(amountEl.value),
        date: dateEl.value,
        notes: notesEl ? notesEl.value : ''
    };

    if (!payload.lenderId || !payload.borrowerId) return showError('Select lender and borrower');
    if (!payload.amount || payload.amount <= 0) return showError('Enter a valid amount');
    if (!payload.date) return showError('Select a date');
    if (!currentGameId) return showError('No game selected');

    try {
        if (editingLoanId) {
            // Update existing loan
            // Fetch existing to compute repaid_amount preservation
            const respExisting = await fetch(`${API_BASE}/loans`);
            const loans = await respExisting.json();
            const loan = (loans || []).find(l => Number(l.id) === Number(editingLoanId));
            if (!loan) return showError('Loan not found');

            // Preserve repaid_amount and status unless changed by UI
            const updateBody = {
                amount: payload.amount,
                notes: payload.notes,
                status: loan.status
            };

            const resp = await fetch(`${API_BASE}/loans/${editingLoanId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                return showError(err.message || 'Failed to update loan');
            }

            showSuccess('Loan updated');
            editingLoanId = null;
            document.getElementById('loan-form')?.reset();
            closeModal('loan-modal');
            await renderGameLoans(currentGame);
        } else {
            // Create new loan (use existing addLoanToGame for consistency)
            await addLoanToGame();
        }

        await loadGames();
    } catch (err) {
        console.error('Error in loan submit', err);
        showError('Failed to save loan');
    }
}

// Edit loan: populate loan modal and switch to edit mode
async function editLoan(loanId) {
    try {
        const resp = await fetch(`${API_BASE}/loans`);
        const loans = await resp.json();
        const loan = (loans || []).find(l => Number(l.id) === Number(loanId));
        if (!loan) return showError('Loan not found');

        editingLoanId = loanId;
        // ensure the modal selects are populated for current game
        populateLoanModal();
        const lenderEl = document.getElementById('loan-lender');
        const borrowerEl = document.getElementById('loan-borrower');
        const amountEl = document.getElementById('loan-amount');
        const dateEl = document.getElementById('loan-date');
        const notesEl = document.getElementById('loan-notes');
        const title = document.getElementById('loan-modal')?.querySelector('h2');
        const confirmBtn = document.querySelector('#loan-form button[type="submit"]');

        // For editing we don't want the user to change lender/borrower here — only amount/notes/date
        if (lenderEl) {
            lenderEl.value = loan.lender.id;
            lenderEl.disabled = true;
        }
        if (borrowerEl) {
            borrowerEl.value = loan.borrower.id;
            borrowerEl.disabled = true;
        }
        if (amountEl) amountEl.value = loan.amount || '';
        if (dateEl) dateEl.value = loan.date || '';
        if (notesEl) notesEl.value = loan.notes || '';
        if (title) title.textContent = 'Edit Loan';
        if (confirmBtn) confirmBtn.textContent = 'Save Changes';

        openModal('loan-modal');
    } catch (err) {
        console.error('Error editing loan', err);
        showError('Failed to open loan editor');
    }
}

// Repay loan: prompt for repayment amount, update repaid_amount and status, add notes history
async function repayLoan(loanId) {
    try {
        // fetch loan
        const resp = await fetch(`${API_BASE}/loans`);
        const loans = await resp.json();
        const loan = (loans || []).find(l => Number(l.id) === Number(loanId));
        if (!loan) return showError('Loan not found');

        const repayAmountStr = prompt(`Enter repayment amount (Remaining: ₹${(loan.amount - (loan.repaid_amount||0))}):`);
        if (!repayAmountStr) return;
        const repayAmount = Number(repayAmountStr);
        if (!repayAmount || repayAmount <= 0) return showError('Enter a valid repayment amount');

        const newRepaid = (Number(loan.repaid_amount) || 0) + repayAmount;
        let newStatus = loan.status;
        if (newRepaid >= Number(loan.amount)) {
            newStatus = 'paid';
        }

        // append history note
        const now = new Date().toISOString().split('T')[0];
        const historyLine = `Repayment ₹${repayAmount} on ${now}${newStatus==='paid' ? ' (PAID in full)' : ''}`;
        const newNotes = ((loan.notes || '') + '\n' + historyLine).trim();

        const updateBody = { repaidAmount: newRepaid, status: newStatus, notes: newNotes };
        const updateResp = await fetch(`${API_BASE}/loans/${loanId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody)
        });

        if (!updateResp.ok) {
            const err = await updateResp.json().catch(()=>({}));
            return showError(err.message || 'Failed to update repayment');
        }

        showSuccess('Repayment recorded');
        await renderGameLoans(currentGame);
        await updateGameLoansStats(currentGame);
    } catch (err) {
        console.error('Error repaying loan', err);
        showError('Failed to process repayment');
    }
}

// Utility Functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Resize an image File to fit within maxWidth/maxHeight while preserving aspect ratio.
// Returns a Blob (image/jpeg by default) suitable for FormData upload.
function resizeImageFile(file, maxWidth, maxHeight, mime = 'image/jpeg', quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No file provided'));
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = reject;
            img.onload = function() {
                let { width, height } = img;
                // compute scaling
                const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                const targetW = Math.round(width * ratio);
                const targetH = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                // fill with white for JPEGs to avoid transparency issues
                if (mime === 'image/jpeg') {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, targetW, targetH);
                }
                ctx.drawImage(img, 0, 0, targetW, targetH);
                canvas.toBlob(function(blob) {
                    if (!blob) return reject(new Error('Canvas is empty'));
                    resolve(blob);
                }, mime, quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// Placeholder functions
async function editPlayer(playerId) {
    try {
        // Try to find in allPlayers first
        let player = (allPlayers || []).find(p => Number(p.id) === Number(playerId));
        if (!player) {
            const resp = await fetch(`${API_BASE}/players/${playerId}`);
            if (resp.ok) player = await resp.json();
        }

        if (!player) return showError('Player not found');

        editingPlayerId = playerId;

        // Populate modal fields
        const title = document.getElementById('player-modal-title');
        const nameInput = document.getElementById('player-name');
    const imgInput = document.getElementById('player-image-file');
    const preview = document.getElementById('player-image-preview');
        const confirmBtn = document.getElementById('confirm-new-player-btn');

        if (title) title.textContent = 'Edit Player';
        if (confirmBtn) confirmBtn.textContent = 'Save Changes';
        if (nameInput) nameInput.value = player.name || '';
    if (imgInput) { imgInput.value = ''; imgInput.removeAttribute('data-removed'); }
    if (preview) preview.innerHTML = player.image ? `<img src="${player.image}" style="max-width:120px; max-height:80px; border-radius:4px">` : '';

        openModal('player-modal');
    } catch (err) {
        console.error('Error opening edit player modal', err);
        showError('Failed to open edit dialog');
    }
}

// remove old placeholder

async function deleteLoan(loanId) {
    if (!confirm('Are you sure you want to delete this loan?')) return;
    try {
        const resp = await fetch(`${API_BASE}/loans/${loanId}`, { method: 'DELETE' });
        if (!resp.ok) return showError('Failed to delete loan');
        showSuccess('Loan deleted');
        await renderGameLoans(currentGame);
        await updateGameLoansStats(currentGame);
        await loadLoans();
    } catch (err) {
        console.error('Error deleting loan', err);
        showError('Failed to delete loan');
    }
}

// Game Details Tabs Navigation
function switchGameDetailTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Show/hide tab content
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Game Actions Functions
function markGameAsCompleted() {
    if (confirm('Mark this game as completed?')) {
        // API call to update game status
        showSuccess('Game marked as completed!');
    }
}

async function addPlayerToGame() {
    const select = document.getElementById('add-player-dropdown');
    const addBtn = document.getElementById('confirm-add-player-btn');
    console.log('addPlayerToGame called, currentGameId=', currentGameId);
    if (!select) return showError('Add-player UI not found');

    const playerId = select.value;
    if (!playerId) return showError('Please select a player to add');
    if (!currentGameId) return showError('No game selected');

    try {
        // disable UI while request in-flight
        if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Adding...'; }

        const response = await fetch(`${API_BASE}/games/${currentGameId}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: Number(playerId), balance: 0, initialBalance: 0 })
        });

        const data = await response.json();
        console.log('addPlayerToGame response', response.status, data);
        if (!response.ok) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Add Player'; }
            return showError(data.message || 'Failed to add player to game');
        }

    showSuccess('Player added to game');
    // Refresh the game details to show the new player and update games list
    await showGameDetails(currentGameId);
    // don't automatically switch tabs — leave current tab as-is
    await loadGames();

        // Reset dropdown state
        populateAddPlayerDropdown((await (await fetch(`${API_BASE}/games/${currentGameId}`)).json()));
        if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Add Player'; }
        select.value = '';
    } catch (error) {
        console.error('Error adding player to game:', error);
        if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Add Player'; }
        showError('Failed to add player to game');
    }
}

function deleteCurrentGame() {
    if (confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
        if (currentGameId) {
            deleteGame(currentGameId);
            closeModal('game-details-modal');
        }
    }
}

function saveGameNotes() {
    const notes = document.getElementById('game-notes').value;
    showSuccess('Game notes saved!');
}

// Update your showGameDetails function to set currentGameId
async function showGameDetails(gameId) {
    try {
        currentGameId = gameId; // ✅ Store the current game ID
        const response = await fetch(`${API_BASE}/games/${gameId}`);
        const game = await response.json();

        if (game) {
            // determine whether the modal was already open so we can preserve the active tab
            const modalEl = document.getElementById('game-details-modal');
            const wasOpen = modalEl && modalEl.style.display === 'flex';

            renderGameDetails(game);
            openModal('game-details-modal');

            // If the modal was not already open, set default tab to Overview. If it was open, preserve the current tab.
            if (!wasOpen) switchGameDetailTab('overview');
        }
    } catch (error) {
        console.error('Error loading game details:', error);
        showError('Failed to load game details');
    }
}

// Update your deleteGame function
async function deleteGame(gameId) {
    try {
        const response = await fetch(`${API_BASE}/games/${gameId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Game deleted successfully!');
            loadGames();
        } else {
            showError('Failed to delete game');
        }
    } catch (error) {
        console.error('Error deleting game:', error);
        showError('Failed to delete game');
    }
}

// Expose functions to the global window object so inline handlers and DevTools can access them
window.addPlayerToGame = addPlayerToGame;
window.populateAddPlayerDropdown = populateAddPlayerDropdown;
window.showGameDetails = showGameDetails; // sometimes useful to call from console
window.populateBalanceModal = populateBalanceModal;
window.updatePlayerBalance = updatePlayerBalance;
window.editPlayer = editPlayer;
window.editLoan = editLoan;
window.repayLoan = repayLoan;
window.handleLoanSubmit = handleLoanSubmit;
window.deleteLoan = deleteLoan;