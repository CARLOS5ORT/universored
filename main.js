const TIME_SCALE = 220;

let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/* =======================
   SETUP
======================= */
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont("monospace");

    // 🔒 FORZAR ESTADO INICIAL CORRECTO
    document.getElementById("setup-panel")?.classList.remove("hidden");
    document.getElementById("footer-controls")?.classList.add("hidden");
    document.getElementById("hud")?.classList.add("hidden");
    document.getElementById("tonality-display")?.classList.add("hidden");
}

/* =======================
   INICIO PRINCIPAL
======================= */
async function iniciarTodo() {
    if (ready) return; // ❌ evita doble inicio

    const file = document.getElementById("audioFile").files[0];
    if (!file) {
        alert("Selecciona un archivo de audio");
        return;
    }

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden");

    cargarLetra();
    await getAudioContext().resume();

    // 🔥 HuggingFace NO bloquea
    analizarTonalidadHF(file);

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

/* =======================
   DRAW
======================= */
function draw() {
    background(5,5,15);
    if (!ready) return;

    drawGrid();

    stroke(255,255,255,120);
    strokeWeight(2);
    line(width/2, 0, width/2, height);

    const now = song.currentTime();

    const fSong = detectPitchSong();
    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length-1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });
        }
    }

    if (bars.length && bars[0].time < now - 5) bars.shift();
    if (voiceTrail.length && voiceTrail[0].time < now - 5) voiceTrail.shift();

    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width/2 + (b.time - now) * TIME_SCALE;
        if (x < 80 || x > width) continue;
        line(x, b.y, x + 45, b.y);
    }

    pitchUser.getPitch((_, f) => freqUser = f || 0);

    if (freqUser > 0) {
        voiceTrail.push({
            y: freqToY(freqUser),
            time: now,
            color: null
        });
    }

    strokeWeight(8);
    for (let i = 1; i < voiceTrail.length; i++) {
        const p1 = voiceTrail[i-1];
        const p2 = voiceTrail[i];

        const x1 = width/2 + (p1.time - now) * TIME_SCALE;
        const x2 = width/2 + (p2.time - now) * TIME_SCALE;

        if (x2 < 80 || x1 > width) continue;

        if (p2.color === null && x1 < width/2 && x2 >= width/2) {
            const target = nearestBarY(p2.time);
            p2.color =
                Math.abs(p2.y - target) < 30
                ? color(0,242,255,200)
                : color(255,70,70,200);
        }

        stroke(p2.color || color(160,160,160,120));
        line(x1, p1.y, x2, p2.y);
    }

    if (freqUser > 0) {
        let y = freqToY(freqUser);
        fill(255); noStroke();
        ellipse(width/2, y, 14);

        let midi = Math.round(12 * Math.log2(freqUser / 440) + 69);
        document.getElementById("note").innerText = notes[midi % 12];
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

/* =======================
   UTILIDADES
======================= */
function detectPitchSong() {
    let w = fftSong.waveform();
    let best = -1, bestCorr = 0;
    for (let o=20; o<1000; o++) {
        let c=0;
        for (let i=0; i<w.length-o; i++) c += w[i] * w[i+o];
        if (c > bestCorr) { bestCorr = c; best = o; }
    }
    return best > 0 ? getAudioContext().sampleRate/best : null;
}

function nearestBarY(time) {
    let min = Infinity, y = height/2;
    for (let b of bars) {
        let d = Math.abs(b.time - time);
        if (d < min) { min = d; y = b.y; }
    }
    return y;
}

function freqToY(f) {
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
        text(notes[i%12], 25, y);
    }
}

/* =======================
   UI
======================= */
function updateUI() {
    if (!song) return;
    document.getElementById("progress-bar").style.width =
        (song.currentTime()/song.duration()*100) + "%";
    document.getElementById("time").innerText =
        Math.floor(song.currentTime()) + " / " + Math.floor(song.duration());
}

/* =======================
   LETRA
======================= */
function cargarLetra() {
    const t = document.getElementById("lyricsInput").value.trim();
    if (!t) return;
    const box = document.getElementById("lyrics-box");
    box.innerHTML = "";
    t.split("\n").forEach(l => {
        if (l.trim()) {
            const s = document.createElement("span");
            s.textContent = l;
            box.appendChild(s);
        }
    });
    document.getElementById("lyrics-panel").classList.remove("hidden");
}

/* =======================
   HUGGINGFACE (SAFE)
======================= */
const HF_BASE = "https://carlos5ort-detector-tonalidad.hf.space";

async function analizarTonalidadHF(_) {
    try {
        document.getElementById("key-result").innerText = "Analizando...";
        document.getElementById("tonality-display").classList.remove("hidden");
    } catch {}
}
