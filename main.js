// ================== CONFIG ==================
const TIME_SCALE = 250; // más alto = más lento (200–300 recomendado)

// ================== VARIABLES ==================
let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

// ================== NOTAS ==================
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ================== SETUP ==================
function setup() {
    createCanvas(windowWidth, windowHeight);
}

// ================== INICIO ==================
async function iniciarTodo() {
    const file = document.getElementById("audioFile").files[0];
    if (!file) {
        alert("Carga un archivo de audio");
        return;
    }

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");

    cargarLetra();
    await getAudioContext().resume();

    song = loadSound(URL.createObjectURL(file), () => {
        fftSong = new p5.FFT(0.9, 2048);
        fftSong.setInput(song);

        mic = new p5.AudioIn();
        mic.start(() => {
            const modelURL =
            "https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/pitch-detection/crepe/";
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

// ================== DRAW ==================
function draw() {
    background(5, 5, 15);
    if (!ready) return;

    drawGrid();

    const now = song.currentTime();

    // ---------- BARRAS DE LA CANCIÓN ----------
    const fSong = detectPitchSong();
    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length - 1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });
        }
    }

    // ---------- VOZ USUARIO ----------
    pitchUser.getPitch((err, freq) => {
        freqUser = freq || 0;
        if (freqUser > 0) {
            voiceTrail.push({
                y: freqToY(freqUser),
                time: now
            });
        }
    });

    // ---------- ESTELA DE VOZ ----------
    strokeWeight(6);
    stroke(0, 242, 255, 180);
    for (let i = 1; i < voiceTrail.length; i++) {
        const p1 = voiceTrail[i - 1];
        const p2 = voiceTrail[i];

        const x1 = width / 2 + (p1.time - now) * TIME_SCALE;
        const x2 = width / 2 + (p2.time - now) * TIME_SCALE;

        if (x1 < 80 || x2 > width) continue;
        line(x1, p1.y, x2, p2.y);
    }

    // ---------- BARRAS MAGENTA ----------
    stroke("#ff00ff");
    strokeWeight(10);
    for (let b of bars) {
        const x = width / 2 + (b.time - now) * TIME_SCALE;
        if (x < 80 || x > width) continue;
        line(x, b.y, x + 40, b.y);
    }

    // ---------- PUNTO ACTUAL ----------
    if (freqUser > 0) {
        const y = freqToY(freqUser);
        noStroke();
        fill(0, 242, 255, 160);
        ellipse(width / 2, y, 32);
        fill(255);
        ellipse(width / 2, y, 12);

        const midi = Math.round(12 * Math.log2(freqUser / 440) + 69);
        document.getElementById("note").innerText = notes[midi % 12];
    } else {
        document.getElementById("note").innerText = "--";
    }

    // ---------- LÍNEA CENTRAL (AL FINAL) ----------
    stroke(0, 255, 255);
    strokeWeight(3);
    line(width / 2, 0, width / 2, height);

    noStroke();
    fill(0, 255, 255);
    textAlign(CENTER);
    textSize(13);
    text("AHORA", width / 2, 18);

    updateUI();
}

// ================== UTILIDADES ==================
function freqToY(freq) {
    return map(
        Math.log(freq),
        Math.log(80),
        Math.log(1100),
        height - 160,
        50
    );
}

function detectPitchSong() {
    const w = fftSong.waveform();
    let best = -1;
    let bestCorr = 0;

    for (let o = 20; o < 1000; o++) {
        let corr = 0;
        for (let i = 0; i < w.length - o; i++) {
            corr += w[i] * w[i + o];
        }
        if (corr > bestCorr) {
            bestCorr = corr;
            best = o;
        }
    }

    return best > 0 ? getAudioContext().sampleRate / best : null;
}

function drawGrid() {
    for (let i = 36; i < 84; i++) {
        const f = 440 * Math.pow(2, (i - 69) / 12);
        const y = freqToY(f);
        stroke(255, 10);
        line(80, y, width, y);
        noStroke();
        fill(0, 242, 255, 120);
        text(notes[i % 12] + (Math.floor(i / 12) - 1), 25, y);
    }
    stroke(0, 242, 255, 40);
    line(80, 0, 80, height);
}

// ================== UI ==================
function updateUI() {
    const c = song.currentTime();
    const d = song.duration();
    document.getElementById("progress-bar").style.width =
        (c / d) * 100 + "%";
    document.getElementById("time").innerText =
        Math.floor(c) + " / " + Math.floor(d);
}

function togglePlay() {
    const btn = document.getElementById("playBtn");
    if (song.isPlaying()) {
        song.pause();
        btn.innerText = "PLAY";
    } else {
        song.play();
        btn.innerText = "PAUSA";
    }
}

function saltar(s) {
    song.jump(constrain(song.currentTime() + s, 0, song.duration()));
}

function detener() {
    song.stop();
    bars = [];
    voiceTrail = [];
}

function cambiarCancion() {
    detener();
    location.reload();
}

function clickBarra(e) {
    const r = e.target.getBoundingClientRect();
    song.jump(
        ((e.clientX - r.left) / r.width) * song.duration()
    );
}

// ================== LETRA ==================
function cargarLetra() {
    const text = document.getElementById("lyricsInput").value.trim();
    if (!text) return;

    const box = document.getElementById("lyrics-box");
    box.innerHTML = "";

    text.split("\n").forEach(line => {
        const span = document.createElement("span");
        span.textContent = line;
        box.appendChild(span);
    });

    document.getElementById("lyrics-panel").classList.remove("hidden");
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
