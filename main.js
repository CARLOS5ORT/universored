// ================= CONFIG =================
const TIME_SCALE = 180;

// ================= AUDIO =================
let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

// ================= NOTAS =================
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ================= P5 =================
function setup() {
    createCanvas(windowWidth, windowHeight);
}

async function iniciarTodo() {
    const file = document.getElementById("audioFile").files[0];
    if (!file) return;

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden");
    document.getElementById("youtube-panel").classList.remove("hidden");
    cargarLetra();
    await getAudioContext().resume();

    song = loadSound(URL.createObjectURL(file), () => {
        fftSong = new p5.FFT(0.9, 1024);
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

function draw() {
    background(5, 5, 15);
    if (!ready) return;

    drawGrid();

    // Línea vertical central (AHORA)
    stroke(255, 255, 255, 120);
    strokeWeight(2);
    line(width / 2, 0, width / 2, height);

    const now = song.currentTime();

    // ================= PITCH CANCIÓN =================
    const fSong = detectPitchSong();
    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length - 1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });
        }
    }

    // ================= PITCH VOZ =================
    pitchUser.getPitch((e, f) => {
        freqUser = f || 0;
    });

    if (freqUser > 0) {
        voiceTrail.push({
            y: freqToY(freqUser),
            time: now
        });
    }

    // ================= ESTELA VOZ =================
    stroke(0, 242, 255, 180);
    strokeWeight(8);
    for (let i = 1; i < voiceTrail.length; i++) {
        let x1 = width / 2 + (voiceTrail[i - 1].time - now) * TIME_SCALE;
        let x2 = width / 2 + (voiceTrail[i].time - now) * TIME_SCALE;
        if (x1 < 80 || x2 > width) continue;
        line(x1, voiceTrail[i - 1].y, x2, voiceTrail[i].y);
    }

    // ================= BARRAS CANCIÓN =================
    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width / 2 + (b.time - now) * TIME_SCALE;
        if (x < 80 || x > width) continue;
        line(x, b.y, x + 45, b.y);
    }

    // ================= PUNTO VOZ ACTUAL =================
    if (freqUser > 0) {
        let y = freqToY(freqUser);
        fill(0, 242, 255, 150);
        noStroke();
        ellipse(width / 2, y, 40);
        fill(255);
        ellipse(width / 2, y, 15);

        let midi = Math.round(12 * Math.log2(freqUser / 440) + 69);
        document.getElementById("note").innerText = notes[midi % 12];
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

// ================= UTILIDADES =================
function detectPitchSong() {
    let w = fftSong.waveform();
    let best = -1, bestCorr = 0;

    for (let o = 20; o < 800; o++) {
        let c = 0;
        for (let i = 0; i < w.length - o; i++) {
            c += w[i] * w[i + o];
        }
        if (c > bestCorr) {
            bestCorr = c;
            best = o;
        }
    }

    return best > 0 ? getAudioContext().sampleRate / best : null;
}

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
        text(notes[i % 12] + (Math.floor(i / 12) - 1), 25, y);
    }
    stroke(0, 242, 255, 40);
    line(80, 0, 80, height);
}

// ================= UI =================
function updateUI() {
    let c = song.currentTime();
    let d = song.duration();
    document.getElementById("progress-bar").style.width =
        (c / d) * 100 + "%";
    document.getElementById("time").innerText =
        Math.floor(c) + " / " + Math.floor(d);
}

function togglePlay() {
    if (song.isPlaying()) {
        song.pause();
        playBtn.innerText = "PLAY";
    } else {
        song.play();
        playBtn.innerText = "PAUSA";
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
    let r = e.target.getBoundingClientRect();
    song.jump(
        ((e.clientX - r.left) / r.width) * song.duration()
    );
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

function cargarYoutube() {
    const url = document.getElementById("youtubeUrl").value.trim();
    if (!url) return;

    let videoId = "";

    if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1];
    } else if (url.includes("watch?v=")) {
        videoId = url.split("watch?v=")[1].split("&")[0];
    }

    if (!videoId) {
        alert("URL de YouTube no válida");
        return;
    }

    const container = document.getElementById("youtube-container");
    container.innerHTML = `
        <iframe
            src="https://www.youtube.com/embed/${videoId}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;

    document.getElementById("youtube-panel").classList.remove("hidden");
}

