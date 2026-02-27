const params = new URLSearchParams(window.location.search);
const code = params.get('diploma');

let playerName = "";

let currentLvlIndex = 0;
let lives = 3;
let currentWordIndex = 0;
let timer;
let timeLeft;
let recognition;
let wordsArray = [];

let totalWordsRead = 0;
let startTimeGlobal;
let gameActive = false;

async function logErrorToSupabase(errorMessage, extraData = {}) {
    const { data, error } = await supabaseClient
        .from('error_logs')
        .insert([
            {
                nombre_usuario: playerName || 'Anonimo',
                error_mensaje: errorMessage,
                dispositivo: navigator.userAgent, // Captura navegador y sistema operativo
                nivel_id: currentLvlIndex + 1,
                ...extraData
            }
        ]);

    if (error) console.error("Error al reportar log:", error);
}


//Primero revisamos si la url es de un diploma compartido
let game_card = document.getElementById('game-card');
let diplome = document.getElementById('diplome');
if (code) {
    console.log("Código de diploma detectado:", code);
    game_card.classList.add('hidden');
    diplome.classList.remove('hidden');

    const fetchDiplomaData = async () => {
        const { data, error } = await supabaseClient
            .from('pointstable')
            .select('*')
            .eq('code', code)
            .single();

        $("#final-name-diploma").text(data.name);
        $("#final-ppm-diploma").text(`${data.ppm} PPM`);
        $("#final-lvl-diploma").text(`Nivel: ${data.level}`);
        if (error) {
            console.error("Error fetching diploma data:", error);
            Swal.fire('Error', 'No se pudo cargar el diploma. Código inválido.', 'error');
            return;
        }
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
    };


    function downloadDiploma(name, code) {
        document.getElementById('download-diploma-btn').style.display = 'none';
        htmlToImage.toPng(document.getElementById('diplome-card'))
            .then(function (dataUrl) {
                var link = document.createElement('a');
                link.download = `Diploma_${name}_${code}.png`;
                link.href = dataUrl;
                link.click();
            });
        setTimeout(function () {
            document.getElementById('download-diploma-btn').style.display = 'block';
        }, 1000);
    }

    function backToGame() {
        location.href = './';
    }

    fetchDiplomaData();
    document.getElementById('download-diploma-btn').addEventListener('click', function () {
        downloadDiploma(document.getElementById('final-name-diploma').innerText, code);
    });
} else {
    game_card.classList.remove('hidden');
    diplome.classList.add('hidden');
}

document.getElementById('user-name').focus();
if ('webkitSpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-MX';

    recognition.onresult = (event) => {
        if (!gameActive) return;
        const speech = event.results[event.results.length - 1][0].transcript.toLowerCase();
        // console.log("Speech:", speech);
        checkSpeech(speech);
    };

    recognition.onend = () => {
        if (gameActive) {
            try {
                recognition.start();
                console.log("Reinicio automático para Android activado");
            } catch (e) {
                setTimeout(() => {
                    if (gameActive) recognition.start();
                }, 300);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Error de voz:", event.error);

        // Solo logueamos errores serios, ignoramos "no-speech" si es muy frecuente
        if (event.error !== 'no-speech') {
            logErrorToSupabase(`Speech Error: ${event.error}`);
        }
    };
}

async function saveUserName() {
    const nameInput = document.getElementById('user-name').value;
    if (nameInput.trim() === "") {
        Swal.fire('¡Opps!', 'Dinos tu nombre para empezar aventura', 'warning');
        return;
    }
    playerName = nameInput;
    document.getElementById('player-name-display').innerText = ` ${playerName} `;
    document.getElementById('user-registration').classList.add('hidden');
    document.getElementById('main-btn').classList.remove('hidden');
    document.querySelector('.game').classList.remove('hidden');
}

function randomCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

async function saveToDatabase(finalPPM, levelReached) {
    let code = randomCode();
    const { data, error } = await supabaseClient
        .from('pointstable')
        .insert([
            { code: code, name: playerName, ppm: finalPPM, level: levelReached }
        ]);

    if (error) {
        console.error("Error guardando en Supabase:", error);
    } else {
        return code;
    }
}

async function initGame() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
    } catch (e) {
        logErrorToSupabase(`Mic Permission Denied: ${e.message}`);
        Swal.fire('¡Micro Necesario!', 'Activa el micro para jugar.', 'warning');
    }

    document.getElementById('main-btn').style.display = 'none';
    startTimeGlobal = Date.now();
    startLevel();
}

function startLevel() {
    const lvl = levels[currentLvlIndex];
    document.getElementById('lvl-num').innerText = lvl.id;
    document.getElementById('lvl-name').innerText = lvl.name;
    const randomText = lvl.options[Math.floor(Math.random() * lvl.options.length)];

    wordsArray = randomText.split(" ");
    currentWordIndex = 0;
    timeLeft = lvl.time;
    gameActive = true;

    renderWords();
    updateTimerBar();

    try { recognition.start(); } catch (e) { }

    timer = setInterval(() => {
        timeLeft--;
        updateTimerBar();
        if (timeLeft <= 0) {
            clearInterval(timer);
            loseLife();
        }
    }, 1000);
}

function renderWords() {
    const container = document.getElementById('text-display');
    container.innerHTML = "";
    wordsArray.forEach((w, i) => {
        const span = document.createElement('span');
        span.innerText = w;
        span.className = 'word' + (i === 0 ? ' current' : '');
        span.id = 'w-' + i;
        container.appendChild(span);
    });
}

function cleanText(text) {
    return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}

function checkSpeech(speech) {
    const cleanSpeech = cleanText(speech);

    const target = cleanText(wordsArray[currentWordIndex]);

    if (cleanSpeech.includes(target)) {
        document.getElementById('w-' + currentWordIndex).className = 'word read';
        currentWordIndex++;
        totalWordsRead++;

        if (currentWordIndex >= wordsArray.length) {
            clearInterval(timer);
            gameActive = false;
            try {
                recognition.abort(); // 'abort' es más agresivo que 'stop' y libera el micro rápido
            } catch (e) { }
            winLevel();
        } else {
            document.getElementById('w-' + currentWordIndex).className = 'word current';
        }
    }
}

function updateTimerBar() {
    const pct = (timeLeft / levels[currentLvlIndex].time) * 100;
    document.getElementById('timer-progress').style.width = pct + "%";
}

function loseLife() {
    lives--;
    gameActive = false;
    try {
        recognition.abort(); // 'abort' es más agresivo que 'stop' y libera el micro rápido
    } catch (e) { }
    updateLivesUI();
    try { recognition.stop(); } catch (e) { }

    if (lives <= 0) {
        const totalMinutes = ((Date.now() - startTimeGlobal) / 1000) / 60;
        const ppm = totalMinutes > 0 ? Math.round(totalWordsRead / totalMinutes) : 0;

        Swal.fire({
            title: '¡Buen intento! 👏',
            html: `
                <div style="text-align: left; background: #fef2f2; padding: 15px; border-radius: 15px; border: 2px solid #fee2e2;">
                    <p><b>🚩 Nivel alcanzado:</b> ${levels[currentLvlIndex].id}</p>
                    <p><b>⭐ Palabras leídas:</b> ${totalWordsRead}</p>
                    <p><b>🚀 Tu velocidad:</b> ${ppm} PPM</p>
                </div>
                <p style="margin-top: 15px;">¡Sigue practicando para llegar al nivel 10!</p>
            `,
            icon: 'info',
            showDenyButton: true,
            confirmButtonText: 'Reintentar 🔄',
            denyButtonText: 'Compartir Récord 📱',
            confirmButtonColor: '#FF6B6B',
            denyButtonColor: '#4ECDC4'
        }).then(async (res) => {
            const databaseResult = await saveToDatabase(ppm, levels[currentLvlIndex].id);
            if (res.isDenied) {
                location.href = `?diploma=${databaseResult}`;
            } else {
                location.reload();
            }
        });
    } else {
        Swal.fire({
            title: '¡Tiempo agotado!',
            text: `Te quedan ${lives} vidas.`,
            icon: 'warning',
            confirmButtonText: 'Intentar Nivel de nuevo'
        }).then(startLevel);
    }
}


function updateLivesUI() {
    const container = document.getElementById('lives');
    container.innerHTML = ""; // Limpiamos el contenedor

    for (let i = 0; i < 3; i++) {
        const statusClass = i >= lives ? 'heart-img lost' : 'heart-img';

        container.innerHTML += `
            <img src="media/corazon.png" 
                 width="24" 
                 height="24" 
                 alt="vida" 
                 class="${statusClass}">`;
    }
}

function winLevel() {
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });

    if (currentLvlIndex === levels.length - 1) {
        endGame();
    } else {
        Swal.fire({
            title: `¡Nivel ${levels[currentLvlIndex].id} superado!`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            currentLvlIndex++;
            startLevel();
        });
    }
}

async function endGame() {
    try { recognition.stop(); } catch (e) { }

    const totalMinutes = ((Date.now() - startTimeGlobal) / 1000) / 60;
    const ppm = Math.round(totalWordsRead / totalMinutes);

    const databaseResult = await saveToDatabase(ppm, levels[currentLvlIndex].id);

    confetti({ particleCount: 200, spread: 100 });

    Swal.fire({
        title: '¡MAESTRO LEGENDARIO!',
        html: `¡Completaste el desafío!<br><b style="font-size: 1.6rem; color: #2ecc71;">${ppm} PPM</b>`,
        icon: 'success',
        showDenyButton: true,
        confirmButtonText: 'Repetir 🔄',
        denyButtonText: 'Compartir Diploma 📱',
        confirmButtonColor: '#FF6B6B',
        denyButtonColor: '#4ECDC4'
    }).then(async (res) => {
        if (res.isDenied) {
            location.href = `?diploma=${databaseResult}`;
        } else {
            location.reload();
        }
    });
}