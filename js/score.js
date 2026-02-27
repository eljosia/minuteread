async function fetchTopScores() {
    const listContainer = document.getElementById('scores-list');
    let img1 = `<img src="media/1.png" width="20" alt="1">`;
    let img2 = `<img src="media/2.png" width="20" alt="2">`;
    let img3 = `<img src="media/3.png" width="20" alt="3">`;
    let imgstar = `<img src="media/estrella.png" width="20" alt="*">`;

    const { data, error } = await supabaseClient
        .from('pointstable')
        .select('name, ppm, level, created_at')
        .order('ppm', { ascending: false })

    if (error) {
        console.error("Error trayendo scores:", error);
        listContainer.innerHTML = "<p>No pudimos cargar los puntajes 😢</p>";
        return;
    }

    listContainer.innerHTML = "";

    if (data.length === 0) {
        listContainer.innerHTML = "<p>¡Sé el primero en aparecer aquí! ✨</p>";
        return;
    }

    data.forEach((score, index) => {
        const medal = index === 0 ? img1 : index === 1 ? img2 : index === 2 ? img3 : imgstar;

        const fechaRecord = new Date(score.created_at);
        const fechaFormateada = fechaRecord.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        listContainer.innerHTML += `
            <div class="score-card">
                <div class="player-info">
                    <span class="player-name-tag">${medal} ${score.name}</span>
                    <span class="player-stats-tag">
                        Nivel: ${score.level} | 📅 ${fechaFormateada}
                    </span>
                </div>
                <div class="ppm-badge">${score.ppm} PPM</div>
            </div>
        `;
    });
}

function goBack() {
    window.location.href = "./";
}
window.addEventListener('DOMContentLoaded', fetchTopScores);