const levels = [
    { id: 1, name: "Sílabas con PL", text: "planta plaza planeta El platillo tiene platano", time: 60 },
    { id: 2, name: "Sílabas con PR", text: "pregunta aprender profesor El preso esta en prision", time: 60 },
    { id: 3, name: "Sílabas con BL", text: "cable establo ombligo Pablo pinta su casa de blanco", time: 60 },
    { id: 4, name: "Sílabas con TR", text: "tronco triangulo trono Trini trabaja como maestro", time: 60 },
    { id: 5, name: "Lectura PR", text: "Priscila es una princesa y pasea con su principe por el prado", time: 60 },
    { id: 6, name: "Lectura PL", text: "Pilar come platanos Placido esta nadando en la playa", time: 60 },
    { id: 7, name: "Lectura BL", text: "Las casas del pueblo son blancas Pablo esta en la biblioteca", time: 60 },
    { id: 8, name: "Lectura TR", text: "Patricia come truchas El sastre hace trajes de madera", time: 60 },
    { id: 9, name: "Desafío Mixto", text: "El primo de Laura gano un premio con una pluma de plastico", time: 60 },
    { id: 10, name: "Maestro de Lectura", text: "Cuando esta nublado y llueve las personas ocupan impermeables y paraguas", time: 60 }
];

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

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        if (!gameActive) return;
        const speech = event.results[event.results.length - 1][0].transcript.toLowerCase();
        // console.log("Speech:", speech);
        checkSpeech(speech);
    };

    recognition.onerror = (err) => console.error("Error Speech:", err.error);
}

async function initGame() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
    } catch (e) {
        Swal.fire('¡Micro Necesario!', 'Por favor activa el micrófono para jugar.', 'warning');
        return;
    }

    document.getElementById('main-btn').style.display = 'none';
    startTimeGlobal = Date.now();
    startLevel();
}

function startLevel() {
    const lvl = levels[currentLvlIndex];
    document.getElementById('lvl-num').innerText = lvl.id;
    document.getElementById('lvl-name').innerText = lvl.name;
    wordsArray = lvl.text.split(" ");
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
    updateLivesUI();
    try { recognition.stop(); } catch (e) { }

    if (lives <= 0) {
        const totalMinutes = ((Date.now() - startTimeGlobal) / 1000) / 60;
        const ppm = totalMinutes > 0 ? Math.round(totalWordsRead / totalMinutes) : 0;

        document.getElementById('final-ppm-text').innerText = `${ppm} PPM (Nivel ${levels[currentLvlIndex].id})`;

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
            if (res.isDenied) {
                await generateAndShare();
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

async function copyImageToClipboard(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) return false;

    await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
    ]);

    return true;
}

async function generateAndShare() {
    try {
        const element = document.getElementById('capture-area');

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/png')
        );

        const file = new File([blob], 'mi-progreso.png', { type: 'image/png' });

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({ files: [file] })
        ) {
            await navigator.share({
                files: [file],
                title: 'Mi Progreso de Lectura',
                text: `Mira mama hoy llegue al nivel ${levels[currentLvlIndex].id} con ${totalWordsRead} palabras leidas`
            });
        } else {
            const copied = await copyImageToClipboard(blob);
            if (copied) {
                alert('Imagen copiada al portapapeles. ¡Pégala donde quieras compartirla!');
            } else {
                alert('No se pudo copiar la imagen al portapapeles');
            }
        }
    } catch (err) {
        console.error('Error al generar o compartir', err);
        alert('No se pudo compartir la imagen');
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

    document.getElementById('final-ppm-text').innerHTML = `<img
                    src="./media/cohete.png" width="30" style="margin-right: 15px;"> ${ppm} Palabras por minuto`;
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
            await generateAndShare();
        } else {
            location.reload();
        }
    });
}