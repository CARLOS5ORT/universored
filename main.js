// ===============================
// VARIABLES GLOBALES
// ===============================
let song, mic, pitchUser, fftSong;
let bars = [];
let voiceTrail = [];
let freqUser = 0;
let ready = false;

const TIME_SCALE = 300;
const notes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// -------- CLAVE GLOBAL --------
let songKey = "Analizando...";
let keyEnergy = new Array(12).fill(0);

// Perfiles Krumhansl
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

// ===============================
// SETUP
// ===============================
function setup() {
    createCanvas(windowWidth, windowHeight);
}

// ===============================
// INICIO GENERAL
// ===============================
async function iniciarTodo() {
    const file = document.getElementById("audioFile").files[0];
    if (!file) return;

    document.getElementById("setup-panel").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    document.getElementById("footer-controls").classList.remove("hidden");

    songKey = "Analizando...";

    // 1️⃣ ANALISIS OFFLINE REAL (RÁPIDO)
    await analyzeSongKeyOffline(file);

    // 2️⃣ INICIAR SISTEMA NORMAL
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

// ===============================
// ANALISIS OFFLINE DE CLAVE (RÁPIDO)
// ===============================
async function analyzeSongKeyOffline(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const offlineCtx = new OfflineAudioContext(
        1,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = offlineCtx.createAnalyser();
    analyser.fftSize = 4096;

    source.connect(analyser);
    analyser.connect(offlineCtx.destination);
    source.start(0);

    offlineCtx.oncomplete = () => {
        songKey = detectKeyFromEnergy(keyEnergy);
    };

    const freqData = new Float32Array(analyser.frequencyBinCount);

    function process() {
        analyser.getFloatFrequencyData(freqData);
        const nyquist = audioBuffer.sampleRate / 2;

        for (let i = 0; i < freqData.length; i++) {
            const mag = freqData[i];
            if (mag < -80) continue;

            const freq = (i / freqData.length) * nyquist;
            if (freq < 80 || freq > 2000) continue;

            const midi = Math.round(12 * Math.log2(freq / 440) + 69);
            const note = ((midi % 12) + 12) % 12;
            keyEnergy[note] += Math.pow(10, mag / 20);
        }
    }

    analyser.onaudioprocess = process;
    await offlineCtx.startRendering();
}

// ===============================
// DETECTAR CLAVE FINAL
// ===============================
function detectKeyFromEnergy(energy) {
    let bestScore = -Infinity;
    let bestKey = "--";

    for (let i = 0; i < 12; i++) {
        let major = 0;
        let minor = 0;

        for (let j = 0; j < 12; j++) {
            major += energy[(j + i) % 12] * MAJOR_PROFILE[j];
            minor += energy[(j + i) % 12] * MINOR_PROFILE[j];
        }

        if (major > bestScore) {
            bestScore = major;
            bestKey = notes[i] + " mayor";
        }
        if (minor > bestScore) {
            bestScore = minor;
            bestKey = notes[i] + " menor";
        }
    }
    return bestKey;
}

// ===============================
// DRAW
// ===============================
function draw() {
    background(5,5,15);

    // LINEA CENTRAL
    stroke(0,242,255,160);
    strokeWeight(2);
    line(width/2, 0, width/2, height);

    // HUD CLAVE
    noStroke();
    fill(255);
    textAlign(LEFT, TOP);
    textSize(16);
    text("Clave: " + songKey, 20, 20);

    if (!ready) return;

    drawGrid();

    let now = song.currentTime();
    let fSong = detectPitchSong();

    if (fSong && fSong > 80 && fSong < 1100) {
        if (!bars.length || now - bars[bars.length-1].time > 0.15) {
            bars.push({ y: freqToY(fSong), time: now });
        }
    }

    pitchUser.getPitch((e,f)=> freqUser = f || 0);

    if (freqUser > 0) {
        voiceTrail.push({ y: freqToY(freqUser), time: now });
    }

    stroke(0,242,255,180);
    strokeWeight(8);
    for (let i=1;i<voiceTrail.length;i++) {
        let x1 = width/2 + (voiceTrail[i-1].time - now) * TIME_SCALE;
        let x2 = width/2 + (voiceTrail[i].time - now) * TIME_SCALE;
        if (x1<80||x2>width) continue;
        line(x1, voiceTrail[i-1].y, x2, voiceTrail[i].y);
    }

    stroke("#ff00ff");
    strokeWeight(12);
    for (let b of bars) {
        let x = width/2 + (b.time - now) * TIME_SCALE;
        if (x<80||x>width) continue;
        line(x, b.y, x+45, b.y);
    }

    if (freqUser>0) {
        let y=freqToY(freqUser);
        fill(0,242,255,150); noStroke();
        ellipse(width/2,y,40);
        fill(255); ellipse(width/2,y,15);

        let midi=Math.round(12*Math.log2(freqUser/440)+69);
        document.getElementById("note").innerText=notes[midi%12];
    } else {
        document.getElementById("note").innerText="--";
    }

    updateUI();
}

// ===============================
// RESTO DE FUNCIONES
// ===============================
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

function freqToY(f) {
    return map(Math.log(f),Math.log(80),Math.log(1100),height-160,50);
}

function detectPitchSong() {
    let w=fftSong.waveform();
    let best=-1,bestCorr=0;
    for (let o=20;o<1000;o++) {
        let c=0;
        for (let i=0;i<w.length-o;i++) c+=w[i]*w[i+o];
        if (c>bestCorr){bestCorr=c;best=o;}
    }
    return best>0?getAudioContext().sampleRate/best:null;
}

function updateUI() {
    let c=song.currentTime(),d=song.duration();
    document.getElementById("progress-bar").style.width=(c/d*100)+"%";
    document.getElementById("time").innerText=Math.floor(c)+" / "+Math.floor(d);
}

function togglePlay() {
    if (song.isPlaying()){song.pause();playBtn.innerText="PLAY";}
    else{song.play();playBtn.innerText="PAUSA";}
}

function saltar(s){song.jump(constrain(song.currentTime()+s,0,song.duration()));}
function detener(){song.stop();bars=[];voiceTrail=[];}
function cambiarCancion(){detener();location.reload();}
function clickBarra(e){
    let r=e.target.getBoundingClientRect();
    song.jump((e.clientX-r.left)/r.width*song.duration());
}

function cargarLetra(){
    let t=document.getElementById("lyricsInput").value.trim();
    if(!t)return;
    let b=document.getElementById("lyrics-box");
    b.innerHTML="";
    t.split("\n").forEach(l=>{
        let s=document.createElement("span");
        s.textContent=l;
        b.appendChild(s);
    });
    document.getElementById("lyrics-panel").classList.remove("hidden");
}

function windowResized(){resizeCanvas(windowWidth,windowHeight);}
