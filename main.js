const TIME_SCALE = 180;

let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

// Tonalidad
let songNotesCount = {};
let songKey = "--";
let keyDetected = false;

// control pitch canción
let lastSongPitch = null;

// Notas
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Escalas mayores
const majorKeys = {
    "C": ["C","D","E","F","G","A","B"],
    "G": ["G","A","B","C","D","E","F#"],
    "D": ["D","E","F#","G","A","B","C#"],
    "A": ["A","B","C#","D","E","F#","G#"],
    "E": ["E","F#","G#","A","B","C#","D#"],
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
        fftSong = new p5.FFT(0.9, 1024);
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

    // línea vertical AHORA
    stroke(255,255,255,120);
    strokeWeight(2);
    line(width/2,0,width/2,height);

    noStroke();
    fill(255,160);
    textAlign(CENTER);
    text("AHORA", width/2, 18);

    const now = song.currentTime();

    // detectar pitch canción (limitado)
    if (frameCount % 4 === 0) {
        lastSongPitch = detectPitchSong();
    }
    const fSong = lastSongPitch;

    // barras canción
    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length-1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });

            let note = freqToNoteName(fSong);
            songNotesCount[note] = (songNotesCount[note] || 0) + 1;

            if (!keyDetected && now > 8) detectSongKey();
        }
    }

    // voz usuario
    pitchUser.getPitch((e,f)=> freqUser = f || 0);
    if (freqUser > 0) {
        voiceTrail.push({
            y: freqToY(freqUser),
            freq: freqUser,
            time: now
        });
    }

    // estela segmentada (NO cambia toda)
    strokeWeight(8);
    for (let i = 1; i < voiceTrail.length; i++) {
        const p1 = voiceTrail[i-1];
        const p2 = voiceTrail[i];

        const x1 = width/2 + (p1.time - now) * TIME_SCALE;
        const x2 = width/2 + (p2.time - now) * TIME_SCALE;
        if (x1 < 80 || x2 > width) continue;

        const note1 = freqToNoteName(p1.freq);
        const note2 = freqToNoteName(p2.freq);

        const ok1 = keyDetected ? noteInKey(note1, songKey) : true;
        const ok2 = keyDetected ? noteInKey(note2, songKey) : true;

        const c1 = ok1 ? color(0,242,255,180) : color(255,60,60,180);
        const c2 = ok2 ? color(0,242,255,180) : color(255,60,60,180);

        stroke(lerpColor(c1, c2, 0.5));
        line(x1, p1.y, x2, p2.y);
    }

    // barras magenta canción
    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width/2 + (b.time - now) * TIME_SCALE;
        if (x < 80 || x > width) continue;
        line(x, b.y, x+45, b.y);
    }

    // punto actual voz
    if (freqUser > 0) {
        let y = freqToY(freqUser);
        fill(0,242,255,150); noStroke();
        ellipse(width/2,y,40);
        fill(255);
        ellipse(width/2,y,15);

        let midi = Math.round(12*Math.log2(freqUser/440)+69);
        document.getElementById("note").innerText =
            notes[midi % 12] + (keyDetected ? " | " + songKey + " MAYOR" : "");
    } else {
        document.getElementById("note").innerText = "--";
    }

    updateUI();
}

// ================= UTIL =================

function freqToNoteName(freq) {
    let midi = Math.round(12 * Math.log2(freq / 440) + 69);
    return notes[midi % 12];
}

function noteInKey(note, key) {
    return majorKeys[key]?.includes(note);
}

function detectSongKey() {
    let max = 0;
    for (let n in songNotesCount) {
        if (songNotesCount[n] > max) {
            max = songNotesCount[n];
            songKey = n;
        }
    }
    keyDetected = true;
}

function detectPitchSong() {
    let w = fftSong.waveform();
    let best = -1, bestCorr = 0;
    for (let o=20;o<800;o++) {
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

// ================= UI =================

function updateUI() {
    let c=song.currentTime(), d=song.duration();
    document.getElementById("progress-bar").style.width=(c/d*100)+"%";
    document.getElementById("time").innerText=Math.floor(c)+" / "+Math.floor(d);
}

function togglePlay() {
    song.isPlaying() ? song.pause() : song.play();
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
