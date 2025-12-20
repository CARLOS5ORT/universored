// ================= CONFIG =================
const TIME_SCALE = 160;

// ================= AUDIO =================
let song;
let mic;
let pitch;
let fft;

let readySong = false;
let readyMic = false;
let readyPitch = false;

// ================= DATA =================
let freqUser = 0;
let bars = [];
let voiceTrail = [];

// ================= NOTAS =================
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ================= P5 =================
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont("Segoe UI");
}

// ================= START =================
async function iniciarTodo() {
    const fileInput = document.getElementById("audioFile");
    if (!fileInput.files.length) {
        alert("Selecciona un audio");
        return;
    }

    // UI
    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden");

    cargarLetra();

    // IMPORTANTE
    await getAudioContext().resume();

    // ================= CANCION =================
    song = loadSound(
        URL.createObjectURL(fileInput.files[0]),
        () => {
            fft = new p5.FFT(0.8, 1024);
            fft.setInput(song);
            readySong = true;
            tryStart();
        }
    );

    // ================= MIC =================
    mic = new p5.AudioIn();
    mic.start(() => {
        readyMic = true;

        const modelURL =
            "https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/pitch-detection/crepe/";

        pitch = ml5.pitchDetection(
            modelURL,
            getAudioContext(),
            mic.stream,
            () => {
                readyPitch = true;
                tryStart();
            }
        );
    });
}

// ================= TRY START =================
function tryStart() {
    if (readySong && readyMic && readyPitch) {
        song.play();
    }
}

// ================= DRAW =================
function draw() {
    background(5, 5, 15);

    if (!song || !song.isPlaying()) return;

    const now = song.currentTime();

    drawGrid();

    // Línea vertical central
    stroke(255, 255, 255, 120);
    strokeWeight(2);
    line(width / 2, 0, width / 2, height);

    // ================= PITCH VOZ =================
    pitch.getPitch((err, freq) => {
        freqUser = freq || 0;
    });

    if (freqUser > 0) {
        voiceTrail.push({
            time: now,
            y: freqToY(freqUser)
        });
    }

    // ================= ESTELA =================
    stroke(0, 242, 255, 180);
    strokeWeight(6);
    for (let i = 1; i < voiceTrail.length; i++) {
        let x1 = width / 2 + (voiceTrail[i - 1].time - now) * TIME_SCALE;
        let x2 = width / 2 + (voiceTrail[i].time - now) * TIME_SCALE;
        if (x2 < 0 || x1 > width) continue;
        line(x1, voiceTrail[i - 1].y, x2, voiceTrail[i].y);
    }

    // ================= PUNTO ACTUAL =================
    if (freqUser > 0) {
        let y = freqToY(freqUser);
        noStroke();
        fill(0, 242, 255, 150);
        ellipse(width / 2, y, 30);

        let midi = Math.round(12 * Math.log2(freqUser / 440) + 69);
        document.getElementById("note").innerText = notes[midi % 12];
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

// ================= UTILS =================
function freqToY(f) {
    return map(Math.log(f), Math.log(80), Math.log(1100), height - 160, 50);
}

function drawGrid() {
    for (let i = 36; i < 84; i++) {
        let f = 440 * Math.pow(2, (i - 69) / 12);
        let y = freqToY(f);
        stroke(255, 10);
        line(80, y, width, y);
        noStroke();
        fill(0, 242, 255, 120);
        text(notes[i % 12], 25, y);
    }
}

// ================= UI =================
function updateUI() {
    let c = song.currentTime();
    let d = song.duration();
    document.getElementById("progress-bar").style.width = (c / d) * 100 + "%";
    document.getElementById("time").innerText = Math.floor(c) + " / " + Math.floor(d);
}

function togglePlay() {
    if (song.isPlaying()) song.pause();
    else song.play();
}

function saltar(s) {
    song.jump(constrain(song.currentTime() + s, 0, song.duration()));
}

function detener() {
    song.stop();
    voiceTrail = [];
}

function cambiarCancion() {
    location.reload();
}

function clickBarra(e) {
    let r = e.target.getBoundingClientRect();
    song.jump(((e.clientX - r.left) / r.width) * song.duration());
}

// ================= LETRA =================
function cargarLetra() {
    const text = document.getElementById("lyricsInput").value.trim();
    if (!text) return;

    const box = document.getElementById("lyrics-box");
    box.innerHTML = "";

    text.split("\n").forEach(line => {
        let s = document.createElement("span");
        s.textContent = line;
        box.appendChild(s);
    });

    document.getElementById("lyrics-panel").classList.remove("hidden");
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
