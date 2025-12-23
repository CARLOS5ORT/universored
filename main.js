// --- 2. CONFIGURACIÓN ---
const HF_API_URL = "https://huggingface.co/spaces/carlos5ort/detector-tonalidad"; // Ejemplo de modelo
const HF_TOKEN = "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"; // <--- ¡PEGA TU TOKEN DE HUGGING FACE AQUÍ!


/* =========================================
   2. ELEMENTOS DEL DOM
   ========================================= */
const btnCargar = document.getElementById('btnCargar');
const inputAudio = document.getElementById('inputAudio');
const audioPlayer = document.getElementById('audio-player');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const displayTonality = document.getElementById('display-tonality');

/* =========================================
   3. VARIABLES DE AUDIO (Líneas Magenta)
   ========================================= */
let audioContext;
let analyser;
let dataArray;

/* =========================================
   4. LOGICA DE CARGA Y ANÁLISIS IA
   ========================================= */
btnCargar.addEventListener('click', async () => {
    const file = inputAudio.files[0];
    if (!file) return alert("Por favor selecciona un archivo.");

    // Cambiar estado visual del botón sin mover el panel
    const textoOriginal = btnCargar.innerText;
    btnCargar.innerText = "Analizando con IA...";
    btnCargar.disabled = true;

    try {
        // --- LLAMADA ASÍNCRONA A HUGGING FACE ---
        const response = await fetch(HF_API_URL, {
            headers: { 
                Authorization: HF_TOKEN,
                "x-wait-for-model": "true" 
            },
            method: "POST",
            body: file
        });
        
        const data = await response.json();

        // Si la IA responde, actualizamos el texto de la tonalidad
        if (data && data[0]) {
            displayTonality.innerText = "Tonalidad: " + data[0].label;
        }

    } catch (error) {
        console.error("Error IA:", error);
        displayTonality.innerText = "Tonalidad: No disponible";
    } finally {
        // Restaurar botón y ocultar panel de carga (tu lógica original)
        btnCargar.innerText = textoOriginal;
        btnCargar.disabled = false;
        
        // Transición a la pantalla del visualizador
        document.getElementById('setup-panel').classList.add('hidden');
        document.getElementById('visualizer-container').classList.remove('hidden');
    }

    // Iniciar reproducción y visualización
    iniciarReproduccion(file);
});

/* =========================================
   5. VISUALIZADOR (Tus líneas magenta originales)
   ========================================= */
function iniciarReproduccion(file) {
    const fileURL = URL.createObjectURL(file);
    audioPlayer.src = fileURL;
    audioPlayer.play();

    // Configurar el analizador de audio si no existe
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audioPlayer);
        analyser = audioContext.createAnalyser();
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        analyser.fftSize = 256; 
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        animar();
    }
}

function animar() {
    // Ajustar canvas al tamaño de ventana sin deformar
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    requestAnimationFrame(animar);

    if(analyser) {
        analyser.getByteFrequencyData(dataArray);
    }

    // FONDO: Tu efecto de estela (trail) original
    ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if(!dataArray) return;

    // DIBUJO DE LÍNEAS MAGENTA
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff00ff"; // Brillo magenta
    ctx.strokeStyle = "#ff00ff"; // Línea magenta

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i];
        const y = (canvas.height / 2) - (barHeight * 1.5);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += barWidth + 1;
    }
    ctx.stroke();
}
