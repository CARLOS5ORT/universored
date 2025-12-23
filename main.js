
const TIME_SCALE = 220;

let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function setup() {
    createCanvas(windowWidth, windowHeight);
}

async function iniciarTodo() {
    const file = document.getElementById("audioFile").files[0];
    if (!file) {
        alert("Por favor selecciona un archivo de audio.");
        return;
    }

    // Ocultar setup y mostrar controles y HUD
    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden"); // CORRECCIÓN IMPORTANTE

    cargarLetra();
    
    // Iniciar contexto de audio
    await getAudioContext().resume();

    song = loadSound(URL.createObjectURL(file), () => {
        fftSong = new p5.FFT(0.9, 2048);
        fftSong.setInput(song);

        mic = new p5.AudioIn();
        mic.start(() => {
            const modelURL = "https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/pitch-detection/crepe/";
            pitchUser = ml5.pitchDetection(
                modelURL,
                getAudioContext(),
                mic.stream,
                () => {
                    ready = true;
                    song.play();
                }
            );
        });
    });
}

function draw() {
    background(5,5,15);
    if (!ready) return;

    drawGrid();

    // Línea central (AHORA)
    stroke(255,255,255,120);
    strokeWeight(2);
    line(width/2, 0, width/2, height);

    const now = song.currentTime();

    // ================= BARRAS DE LA CANCIÓN =================
    const fSong = detectPitchSong();
    if (fSong && fSong > 80 && fSong < 1100) {
        // Evitar dibujar demasiadas barras seguidas
        if (!bars.length || now - bars[bars.length-1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });
        }
    }

    // Limpieza de memoria (Optimización)
    if (bars.length > 0 && bars[0].time < now - 5) bars.shift();
    if (voiceTrail.length > 0 && voiceTrail[0].time < now - 5) voiceTrail.shift();

    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width/2 + (b.time - now) * TIME_SCALE;
        if (x < 80 || x > width) continue;
        line(x, b.y, x + 45, b.y);
    }

    // ================= VOZ USUARIO =================
    pitchUser.getPitch((e,f)=> freqUser = f || 0);
    if (freqUser > 0) {
        voiceTrail.push({
            y: freqToY(freqUser),
            freq: freqUser,
            time: now,
            color: null
        });
    }

    // ================= ESTELA CON COLORES =================
    strokeWeight(8);
    for (let i = 1; i < voiceTrail.length; i++) {
        const p1 = voiceTrail[i-1];
        const p2 = voiceTrail[i];

        const x1 = width/2 + (p1.time - now) * TIME_SCALE;
        const x2 = width/2 + (p2.time - now) * TIME_SCALE;

        if (x2 < 80 || x1 > width) continue;

        // Evaluar afinación al cruzar la línea central
        if (p2.color === null && x1 < width/2 && x2 >= width/2) {
            const target = nearestBarY(p2.time);
            const diff = Math.abs(p2.y - target);
            // Si la diferencia es menor a 30px, está afinado (cyan), si no rojo
            p2.color = diff < 30 ? color(0,242,255,200) : color(255,70,70,200);
        }

        stroke(p2.color || color(160,160,160,120));
        line(x1, p1.y, x2, p2.y);
    }

    // ================= PUNTO ACTUAL Y NOTA =================
    if (freqUser > 0) {
        let y = freqToY(freqUser);
        fill(255); noStroke();
        ellipse(width/2, y, 14);

        // Calcular nota musical
        let midi = Math.round(12 * Math.log2(freqUser / 440) + 69);
        document.getElementById("note").innerText = notes[midi % 12];
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

// ================= UTILIDADES =================

function nearestBarY(time) {
    let closest = null;
    let minDiff = Infinity;
    for (let b of bars) {
        let d = Math.abs(b.time - time);
        if (d < minDiff) {
            minDiff = d;
            closest = b.y;
        }
    }
    // Si no hay barra cerca, devolver centro para evitar error
    return closest ?? height/2;
}

function detectPitchSong() {
    let w = fftSong.waveform();
    let best = -1, bestCorr = 0;
    // Autocorrelación simple
    for (let o=20; o<1000; o++) {
        let c=0;
        for (let i=0; i<w.length-o; i++) c += w[i] * w[i+o];
        if (c > bestCorr) { bestCorr = c; best = o; }
    }
    return best > 0 ? getAudioContext().sampleRate/best : null;
}

function freqToY(f) {
    // Mapeo logarítmico para que las notas se vean naturales
    return map(Math.log(f), Math.log(80), Math.log(1100), height-160, 50);
}

function drawGrid() {
    for (let i=36; i<84; i++) {
        let f = 440 * Math.pow(2, (i-69)/12);
        let y = freqToY(f);
        stroke(255,10); 
        line(80, y, width, y);
        
        noStroke(); 
        fill(0,242,255,120);
        text(notes[i%12] + (Math.floor(i/12)-1), 25, y);
    }
    stroke(0,242,255,40); 
    line(80, 0, 80, height);
}

// ================= UI =================

function updateUI() {
    if (!song) return;
    let c = song.currentTime();
    let d = song.duration();
    document.getElementById("progress-bar").style.width = (c/d*100) + "%";
    document.getElementById("time").innerText = Math.floor(c) + " / " + Math.floor(d);
}

function togglePlay() {
    const btn = document.getElementById("playBtn"); // CORRECCIÓN: Definir variable
    if (song.isPlaying()) { 
        song.pause(); 
        btn.innerText = "PLAY"; 
    } else { 
        song.play(); 
        btn.innerText = "PAUSA";
    }
}

function saltar(s) {
    if (song) song.jump(constrain(song.currentTime()+s, 0, song.duration()));
}

function detener() {
    if (song) {
        song.stop();
        bars = [];
        voiceTrail = [];
        document.getElementById("playBtn").innerText = "PLAY";
    }
}

function cambiarCancion() {
    detener();
    location.reload();
}

function clickBarra(e) {
    if (!song) return;
    let r = e.target.getBoundingClientRect();
    let seekPos = (e.clientX - r.left) / r.width;
    song.jump(seekPos * song.duration());
}

// ================= LETRA =================

function cargarLetra() {
    const text = document.getElementById("lyricsInput").value.trim();
    if (!text) return;

    const box = document.getElementById("lyrics-box");
    box.innerHTML = "";
    text.split("\n").forEach(l => {
        if(l.trim() !== "") {
            let s = document.createElement("span");
            s.textContent = l;
            box.appendChild(s);
        }
    });
    document.getElementById("lyrics-panel").classList.remove("hidden");
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
