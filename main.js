let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

// Tonalidad
let songNotesCount = {};
let songKey = "--";
let keyDetected = false;

// Notas
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Escalas mayores (guía vocal)
const majorKeys = {
    "C": ["C","D","E","F","G","A","B"],
    "G": ["G","A","B","C","D","E","F#"],
    "D": ["D","E","F#","G","A","B","C#"],
    "A": ["A","B","C#","D","E","F#","G#"],
    "E": ["E","F#","G#","A","B","C#","D#"],
    "B": ["B","C#","D#","E","F#","G#","A#"],
    "F#": ["F#","G#","A#","B","C#","D#","F"],
    "F": ["F","G","A","A#","C","D","E"]
};

function setup() {
    createCanvas(windowWidth, windowHeight);
}

async function iniciarTodo() {
    const file = document.getElementById("audioFile").files[0];
    if (!file) return;

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden");

    cargarLetra();
    await getAudioContext().resume();

    song = loadSound(URL.createObjectURL(file), () => {
        fftSong = new p5.FFT(0.9, 2048);
        fftSong.setInput(song);

        mic = new p5.AudioIn();
        mic.start(() => {
            const modelURL =
            "https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/pitch-detection/crepe/";
            pitchUser = ml5.pitchDetection(modelURL, getAudioContext(), mic.stream, () => {
                ready = true;
                song.play();
            });
        });
    });
}

function draw() {
    background(5,5,15);
    if (!ready) return;

    drawGrid();

    const now = song.currentTime();
    const fSong = detectPitchSong();

    // Barras de la canción (notas reales)
    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length - 1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });

            let note = freqToNoteName(fSong);
            songNotesCount[note] = (songNotesCount[note] || 0) + 1;

            if (!keyDetected && now > 8) detectSongKey();
        }
    }

    // Voz del usuario
    pitchUser.getPitch((e,f)=> freqUser = f || 0);
    if (freqUser > 0) {
        voiceTrail.push({ y: freqToY(freqUser), time: now });
    }

    // Estela de la voz (guía de tonalidad)
    strokeWeight(8);
    for (let i = 1; i < voiceTrail.length; i++) {

        let noteName = freqToNoteName(freqUser);
        let inKey = keyDetected ? noteInKey(noteName, songKey) : true;

        stroke(inKey ? color(0,242,255,180) : color(255,60,60,180));

        let x1 = width/2 + (voiceTrail[i-1].time - now) * 300;
        let x2 = width/2 + (voiceTrail[i].time - now) * 300;
        if (x1 < 80 || x2 > width) continue;

        line(x1, voiceTrail[i-1].y, x2, voiceTrail[i].y);
    }

    // Barras magenta de la canción
    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width/2 + (b.time - now) * 300;
        if (x < 80 || x > width) continue;
        line(x, b.y, x + 45, b.y);
    }

    // Punto actual de la voz
    if (freqUser > 0) {
        let y = freqToY(freqUser);
        fill(0,242,255,150); noStroke();
        ellipse(width/2,y,40);
        fill(255); ellipse(width/2,y,15);

        let midi = Math.round(12*Math.log2(freqUser/440)+69);
        document.getElementById("note").innerText =
            notes[midi % 12] + (keyDetected ? " | KEY: " + songKey : "");
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

// ======================= UTILIDADES =======================

function freqToNoteName(freq) {
    let midi = Math.round(12 * Math.log2(freq / 440) + 69);
    return notes[midi % 12];
}

function noteInKey(note, key) {
    if (!majorKeys[key]) return true;
    return majorKeys[key].includes(note);
}

function detectSongKey() {
    let max = 0;
    let key = "--";
    for (let n in songNotesCount) {
        if (songNotesCount[n] > max) {
            max = songNotesCount[n];
            key = n;
        }
    }
    songKey = key;
    keyDetected = true;
}

function detectPitchSong() {
    let w = fftSong.waveform();
    let best = -1, bestCorr = 0;
    for (let o=20;o<1000;o++) {
        let c=0;
        for (let i=0;i<w.length-o;i++) c+=w[i]*w[i+o];
        if (c>bestCorr) { bestCorr=c; best=o; }
    }
    return best>0 ? getAudioContext().sampleRate/best : null;
}

function freqToY(f) {
    return map(Math.log(f), Math.log(80), Math.log(1100), height-160, 50);
}

function drawGrid() {
    for (let i=36;i<84;i++) {
        let f=440*Math.pow(2,(i-69)/12);
        let y=freqToY(f);
        stroke(255,10); line(80,y,width,y);
        noStroke(); fill(0,242,255,120);
        text(notes[i%12]+(Math.floor(i/12)-1),25,y);
    }
    stroke(0,242,255,40); line(80,0,80,height);
}

// ======================= UI =======================

function updateUI() {
    let c=song.currentTime(), d=song.duration();
    document.getElementById("progress-bar").style.width=(c/d*100)+"%";
    document.getElementById("time").innerText=Math.floor(c)+" / "+Math.floor(d);
}

function togglePlay() {
    if (song.isPlaying()) { song.pause(); playBtn.innerText="PLAY"; }
    else { song.play(); playBtn.innerText="PAUSA"; }
}

function saltar(s) {
    song.jump(constrain(song.currentTime()+s,0,song.duration()));
}

function detener() {
    song.stop();
    bars=[];
    voiceTrail=[];
}

function cambiarCancion() {
    detener();
    location.reload();
}

function clickBarra(e) {
    let r=e.target.getBoundingClientRect();
    song.jump((e.clientX-r.left)/r.width*song.duration());
}

// ======================= LETRA =======================

function cargarLetra() {
    const text=document.getElementById("lyricsInput").value.trim();
    if (!text) return;

    const box=document.getElementById("lyrics-box");
    box.innerHTML="";

    text.split("\n").forEach(l=>{
        let s=document.createElement("span");
        s.textContent=l;
        box.appendChild(s);
    });

    document.getElementById("lyrics-panel").classList.remove("hidden");
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
