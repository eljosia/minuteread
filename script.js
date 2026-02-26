const story = "Mi perro es muy lindo. El sol sale por la mañana. Me gusta comer galletas ricas. El gato juega con la pelota roja.";
const wordsArray = story.split(" ");
let currentWordIndex = 0;
let score = 0;
let timeLeft = 60;
let recognition;
let gameActive = false;

const textDisplay = document.getElementById('text-display');

wordsArray.forEach((word, index) => {
    const span = document.createElement('span');
    span.innerText = word;
    span.classList.add('word');
    span.id = `word-${index}`;
    textDisplay.appendChild(span);
});

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        if (!gameActive) return;
        const lastResult = event.results[event.results.length - 1][0].transcript.toLowerCase();
        processSpeech(lastResult);
    };
}

function processSpeech(speech) {
    if (currentWordIndex >= wordsArray.length) return;
    const targetWord = wordsArray[currentWordIndex].toLowerCase().replace(/[.,]/g, "");
    if (speech.includes(targetWord)) {
        markWordAsRead(currentWordIndex);
        currentWordIndex++;
        score++;
        document.getElementById('score').innerText = score;
        processSpeech(speech);
    }
}

function markWordAsRead(index) {
    const el = document.getElementById(`word-${index}`);
    el.classList.remove('current');
    el.classList.add('read');
    const next = document.getElementById(`word-${index + 1}`);
    if (next) next.classList.add('current');
}

// Nueva función para verificar el permiso
async function checkMicPermission() {
    try {
        // Intentamos obtener el estado del permiso
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });

        if (permissionStatus.state === 'granted') {
            return true;
        } else if (permissionStatus.state === 'prompt') {
            // Si está en 'prompt', intentamos pedirlo activando el micro un segundo
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop()); // Cerramos el micro de inmediato
                return true;
            } catch (err) {
                return false;
            }
        } else {
            return false;
        }
    } catch (error) {
        // Algunos navegadores no soportan .query para micro, usamos el método directo
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            return false;
        }
    }
}

// Modificación de la función de inicio
async function startGame() {
    const hasPermission = await checkMicPermission();

    if (!hasPermission) {
        Swal.fire({
            title: '¡Necesitamos tu voz! 🎤',
            text: 'Haz clic en "Permitir" arriba en tu navegador para que el juego pueda escucharte leer.',
            icon: 'info',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#4ECDC4'
        });
        return;
    }

    gameActive = true;
    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('word-0').classList.add('current');

    try {
        recognition.start();
    } catch (e) {
        console.log("Reconocimiento ya activo");
    }

    const countdown = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0 || currentWordIndex >= wordsArray.length) {
            clearInterval(countdown);
            endGame();
        }
    }, 1000);
}

async function endGame() {
    gameActive = false;
    if (recognition) recognition.stop();
    
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });

    const shareText = `¡Mira mamá! He leído ${score} palabras en 1 minuto en mi juego de lectura. 🚀📖`;

    Swal.fire({
        title: '¡Increíble lectura!',
        text: `Lograste leer ${score} palabras mágicas. ¡Eres un campeón!`,
        icon: 'success',
        showDenyButton: true,
        confirmButtonText: 'Jugar de nuevo 🎈',
        denyButtonText: 'Compartir mi logro 📱',
        confirmButtonColor: '#FF6B6B',
        denyButtonColor: '#4ECDC4',
    }).then((result) => {
        if (result.isConfirmed) {
            location.reload();
        } else if (result.isDenied) {
            shareScore(shareText);
        }
    });
}

async function shareScore() {
    Swal.fire({
        title: 'Preparando tu diploma...',
        didOpen: () => { Swal.showLoading(); },
        allowOutsideClick: false
    });

    document.getElementById('final-score-img').innerText = score;
    const captureArea = document.getElementById('capture-area');

    try {
        const canvas = await html2canvas(captureArea, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            scale: 2
        });

        const dataUrl = canvas.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'mi-record.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Mi Récord de Lectura',
                text: `¡Mira! He leído ${score} palabras en un minuto. 📖✨`
            });
            Swal.close();
        } else {
            const link = document.createElement('a');
            link.download = `record-${score}-palabras.png`;
            link.href = dataUrl;
            link.click();
            Swal.fire('¡Diploma listo!', 'Se ha descargado tu imagen para que la envíes.', 'success');
        }
    } catch (error) {
        console.error("Error al generar imagen:", error);
        Swal.fire('Ups', 'No pudimos crear la imagen, pero puedes tomar una captura de pantalla.', 'error');
    }
}