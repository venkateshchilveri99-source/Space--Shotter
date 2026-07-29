/* ==========================================================================
   NEO-VECTORS: Space Shooter Game Engine
   ========================================================================== */

// --- Global Constants & Configurations ---
const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1920;

// Game State Object
const state = {
    running: false,
    paused: false,
    score: 0,
    highscore: 0,
    level: 1,
    lives: 3,
    maxLives: 5,
    playerHP: 100,
    maxPlayerHP: 100,
    lastTime: 0,
    spawnTimer: 0,
    spawnInterval: 1800, // ms between enemy spawns
    waveTimer: 0,
    waveDuration: 25000, // ms per wave level-up
    bossActive: false,
    bossSpawnScoreTrigger: 5000,
    bossScoreAccumulated: 0,
    isMobile: false,
    soundEnabled: true,
    musicEnabled: true
};

// Collections
let player = null;
let bullets = [];
let enemies = [];
let powerups = [];
let particles = [];
let boss = null;
let stars = [];
let planets = [];

// DOM Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const bossWarning = document.getElementById('boss-warning');
const bossHealthContainer = document.getElementById('boss-health-container');
const bossHealthInner = document.getElementById('boss-hp-inner');
const hud = document.getElementById('hud');

// HUD stats
const scoreVal = document.getElementById('score-val');
const levelVal = document.getElementById('level-val');
const highscoreVal = document.getElementById('highscore-val');
const hpBarInner = document.getElementById('hp-bar-inner');
const livesIcons = document.getElementById('lives-icons');
const activePowerups = document.getElementById('active-powerups');

// Menu Stats
const menuHighscore = document.getElementById('menu-highscore');
const finalScoreVal = document.getElementById('final-score');
const finalWavesVal = document.getElementById('final-waves');
const newHighscoreBadge = document.getElementById('new-highscore-badge');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverSubtitle = document.getElementById('gameover-subtitle');

// Mobile DOM controls
const mobileControls = document.getElementById('mobile-controls');
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const btnAutofire = document.getElementById('btn-autofire');
const btnShoot = document.getElementById('btn-shoot');

// Keyboard state
const keys = {};

// Mobile touch state
let touchActive = false;
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickCurrent = { x: 0, y: 0 };
let autoFire = true;

// ==========================================================================
// 1. Web Audio Synthesizer (SFX & Music)
// ==========================================================================

let audioCtx = null;
let noiseBuffer = null;
let musicIntervalId = null;

// Initialize Audio Context on user interaction
function initAudio() {
    if (audioCtx) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        // Generate procedural white noise for explosions
        const bufferSize = audioCtx.sampleRate * 1.5;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        // Start background music loop
        startMusicLoop();
    } catch (e) {
        console.warn('Web Audio API not supported or blocked:', e);
    }
}

// Sound Effects Synthesizer
const sfx = {
    laser(type = 'normal') {
        if (!state.soundEnabled || !audioCtx) return;
        
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'normal') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'triple') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1000, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'enemy') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'boss') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        }
    },
    
    explosion(type = 'medium') {
        if (!state.soundEnabled || !audioCtx || !noiseBuffer) return;
        
        const now = audioCtx.currentTime;
        
        // 1. Bass thump oscillator
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        
        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        
        // 2. White noise crispness
        const noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        const noiseFilter = audioCtx.createBiquadFilter();
        const noiseGain = audioCtx.createGain();
        
        noiseFilter.type = 'lowpass';
        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        
        if (type === 'small') {
            oscGain.gain.setValueAtTime(0.2, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
            
            noiseFilter.frequency.setValueAtTime(600, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            noiseGain.gain.setValueAtTime(0.15, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            noiseNode.start(now);
            noiseNode.stop(now + 0.2);
        } else if (type === 'medium') {
            oscGain.gain.setValueAtTime(0.4, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            
            noiseFilter.frequency.setValueAtTime(400, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.35);
            noiseGain.gain.setValueAtTime(0.3, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            noiseNode.start(now);
            noiseNode.stop(now + 0.35);
        } else if (type === 'boss') {
            oscGain.gain.setValueAtTime(0.8, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
            osc.start(now);
            osc.stop(now + 1.2);
            
            noiseFilter.frequency.setValueAtTime(250, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(30, now + 1.0);
            noiseGain.gain.setValueAtTime(0.6, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            noiseNode.start(now);
            noiseNode.stop(now + 1.0);
        }
    },
    
    powerup() {
        if (!state.soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major arpeggio
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.05);
            
            gain.gain.setValueAtTime(0, now + idx * 0.05);
            gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now + idx * 0.05);
            osc.stop(now + idx * 0.05 + 0.2);
        });
    },
    
    shieldHit() {
        if (!state.soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(400, now + 0.15);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    },
    
    bossWarning() {
        if (!state.soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now + i * 0.5);
            osc.frequency.linearRampToValueAtTime(330, now + i * 0.5 + 0.25);
            osc.frequency.linearRampToValueAtTime(220, now + i * 0.5 + 0.45);
            
            gain.gain.setValueAtTime(0, now + i * 0.5);
            gain.gain.linearRampToValueAtTime(0.25, now + i * 0.5 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.5 + 0.45);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now + i * 0.5);
            osc.stop(now + i * 0.5 + 0.5);
        }
    }
};

// Procedural Background Music Synthesizer
let synthSequenceStep = 0;
const synthBassPattern = [
    32.70, 32.70, 32.70, 32.70, // C1 (x4)
    38.89, 38.89, 38.89, 38.89, // Eb1 (x4)
    34.65, 34.65, 34.65, 34.65, // F1 (x4)
    46.25, 46.25, 41.20, 36.71  // Gb1, Fb1, E1, D1 (transition)
];

const synthLeadPattern = [
    130.81, 0, 164.81, 196.00, 0, 261.63, 246.94, 0, // C3, E3, G3, C4, B3
    155.56, 0, 196.00, 233.08, 0, 311.13, 293.66, 0, // Eb3, G3, Bb3, Eb4, D4
    138.59, 0, 174.61, 207.65, 0, 277.18, 261.63, 0, // Db3, F3, Ab3, Db4, C4
    185.00, 220.00, 277.18, 329.63, 369.99, 440.00, 554.37, 659.25 // Fast scale
];

function playSynthStep(time) {
    if (!state.musicEnabled || !audioCtx) return;
    
    // --- Bass Synth (Driving eighth notes) ---
    const bassOsc = audioCtx.createOscillator();
    const bassFilter = audioCtx.createBiquadFilter();
    const bassGain = audioCtx.createGain();
    
    const bassFreq = synthBassPattern[synthSequenceStep % synthBassPattern.length];
    
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, time);
    // Double frequency for warmer synth presence
    bassOsc.frequency.setValueAtTime(bassFreq * 2, time);
    
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(180, time);
    bassFilter.frequency.exponentialRampToValueAtTime(70, time + 0.15);
    
    bassGain.gain.setValueAtTime(0.18, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    
    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(audioCtx.destination);
    
    bassOsc.start(time);
    bassOsc.stop(time + 0.24);
    
    // --- Lead Synth (Melody / Arpeggio - triggered on specific steps) ---
    const leadFreq = synthLeadPattern[synthSequenceStep % synthLeadPattern.length];
    if (leadFreq > 0 && (synthSequenceStep % 2 === 0 || Math.random() > 0.6)) {
        const leadOsc = audioCtx.createOscillator();
        const leadFilter = audioCtx.createBiquadFilter();
        const leadGain = audioCtx.createGain();
        const delay = audioCtx.createDelay();
        const feedback = audioCtx.createGain();
        
        // Echo effect
        delay.delayTime.setValueAtTime(0.15, time);
        feedback.gain.setValueAtTime(0.3, time);
        
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, time);
        
        leadFilter.type = 'bandpass';
        leadFilter.frequency.setValueAtTime(1000, time);
        leadFilter.Q.setValueAtTime(2.0, time);
        
        leadGain.gain.setValueAtTime(0, time);
        leadGain.gain.linearRampToValueAtTime(0.04, time + 0.02);
        leadGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        
        leadOsc.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(audioCtx.destination);
        
        // Feed into delay
        leadGain.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(audioCtx.destination);
        
        leadOsc.start(time);
        leadOsc.stop(time + 0.2);
    }
    
    // Increment sequencer step
    synthSequenceStep++;
}

function startMusicLoop() {
    if (musicIntervalId) return;
    
    let tempoBPM = 120;
    let secondsPerBeat = 60.0 / tempoBPM;
    let stepDuration = secondsPerBeat / 2; // Eighth notes
    
    let schedulerLookahead = 25.0; // ms
    let scheduleAheadTime = 0.1; // seconds
    let nextStepTime = audioCtx.currentTime;
    
    musicIntervalId = setInterval(() => {
        if (!state.running || state.paused || !state.musicEnabled) return;
        
        while (nextStepTime < audioCtx.currentTime + scheduleAheadTime) {
            playSynthStep(nextStepTime);
            nextStepTime += stepDuration;
        }
    }, schedulerLookahead);
}

function stopMusicLoop() {
    if (musicIntervalId) {
        clearInterval(musicIntervalId);
        musicIntervalId = null;
    }
}

// ==========================================================================
// 2. Parallax Space Background
// ==========================================================================

class Star {
    constructor(isBack = false) {
        this.x = Math.random() * LOGICAL_WIDTH;
        this.y = Math.random() * LOGICAL_HEIGHT;
        this.size = isBack ? Math.random() * 1.5 + 0.5 : Math.random() * 2 + 1.5;
        this.speed = isBack ? Math.random() * 0.4 + 0.2 : Math.random() * 1.2 + 0.6;
        this.alpha = Math.random() * 0.6 + 0.4;
        this.color = `hsla(${200 + Math.random() * 60}, 100%, 85%, ${this.alpha})`;
    }
    
    update(dt) {
        this.y += this.speed * (dt / 16.666);
        if (this.y > LOGICAL_HEIGHT) {
            this.y = 0;
            this.x = Math.random() * LOGICAL_WIDTH;
        }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class Planet {
    constructor() {
        this.reset();
        this.y = Math.random() * LOGICAL_HEIGHT; // Random start on first initialize
    }
    
    reset() {
        this.x = Math.random() * LOGICAL_WIDTH;
        this.y = -300;
        this.radius = Math.random() * 70 + 40;
        this.speed = Math.random() * 0.1 + 0.05;
        this.hue = Math.random() * 360;
        this.glowColor = `hsla(${this.hue}, 90%, 55%, 0.35)`;
        this.bodyColor = `hsla(${this.hue}, 70%, 25%, 1)`;
        this.stripeColor = `hsla(${(this.hue + 40) % 360}, 60%, 40%, 0.8)`;
        this.hasRing = Math.random() > 0.5;
        this.ringAngle = Math.random() * 0.4 - 0.2;
    }
    
    update(dt) {
        this.y += this.speed * (dt / 16.666);
        if (this.y - this.radius - 100 > LOGICAL_HEIGHT) {
            this.reset();
        }
    }
    
    draw() {
        ctx.save();
        
        // Planet Outer Glow
        ctx.shadowBlur = this.radius * 0.6;
        ctx.shadowColor = this.glowColor;
        
        // Drawing Planet Body Gradient
        const grad = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        grad.addColorStop(0, `hsla(${this.hue}, 85%, 65%, 1)`);
        grad.addColorStop(0.5, this.bodyColor);
        grad.addColorStop(1, '#020108');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Disable shadow for rings / details
        ctx.shadowBlur = 0;
        
        // Striping / Detail
        ctx.strokeStyle = this.stripeColor;
        ctx.lineWidth = this.radius * 0.08;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, 0.1, Math.PI - 0.1);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Planet Ring (Rendered slanted)
        if (this.hasRing) {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.ringAngle);
            
            ctx.strokeStyle = `hsla(${this.hue}, 95%, 60%, 0.4)`;
            ctx.lineWidth = this.radius * 0.12;
            
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius * 1.6, this.radius * 0.22, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Procedural Nebula cloud renderer
function drawNebula() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Constant nebulas drawn using radial gradients
    const grad1 = ctx.createRadialGradient(200, 600, 50, 200, 600, 450);
    grad1.addColorStop(0, 'rgba(189, 0, 255, 0.08)');
    grad1.addColorStop(0.5, 'rgba(0, 240, 255, 0.03)');
    grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.arc(200, 600, 450, 0, Math.PI*2);
    ctx.fill();

    const grad2 = ctx.createRadialGradient(850, 1300, 100, 850, 1300, 600);
    grad2.addColorStop(0, 'rgba(255, 0, 85, 0.07)');
    grad2.addColorStop(0.5, 'rgba(100, 0, 255, 0.02)');
    grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.arc(850, 1300, 600, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
}

// Initialize stars & planets lists
function initBackground() {
    stars = [];
    planets = [];
    
    // 60 Back stars, 40 Front stars
    for (let i = 0; i < 60; i++) stars.push(new Star(true));
    for (let i = 0; i < 40; i++) stars.push(new Star(false));
    
    // Two planets
    planets.push(new Planet());
    planets.push(new Planet());
    // Space planets apart
    planets[1].y -= LOGICAL_HEIGHT * 0.5;
}

function updateBackground(dt) {
    stars.forEach(star => star.update(dt));
    planets.forEach(planet => planet.update(dt));
}

function drawBackground() {
    drawNebula();
    planets.forEach(planet => planet.draw());
    stars.forEach(star => star.draw());
}

// ==========================================================================
// 3. Player Vessel Class
// ==========================================================================

class Player {
    constructor() {
        this.width = 75;
        this.height = 75;
        this.radius = 28; // Hit circle radius
        this.x = LOGICAL_WIDTH / 2;
        this.y = LOGICAL_HEIGHT - 250;
        this.speed = 10;
        this.targetSpeed = 10;
        
        // Health / Lives
        this.isInvulnerable = false;
        this.invulTime = 0;
        this.invulDuration = 1800; // ms
        
        // Power-ups object
        this.powerups = {
            tripleShot: 0, // dynamic remaining timers
            rapidFire: 0,
            shield: 0,
            magnet: 0
        };
        
        this.shootTimer = 0;
        this.shootInterval = 220; // Default time between shots (ms)
        this.engineFlameState = 0;
    }
    
    update(dt) {
        // Increment engine flame pulse
        this.engineFlameState += 0.25 * (dt / 16.666);
        
        // Decay active power-up timers
        for (let p in this.powerups) {
            if (this.powerups[p] > 0) {
                this.powerups[p] -= dt;
                if (this.powerups[p] < 0) this.powerups[p] = 0;
            }
        }
        
        // Invulnerability handling
        if (this.isInvulnerable) {
            this.invulTime -= dt;
            if (this.invulTime <= 0) {
                this.isInvulnerable = false;
            }
        }
        
        // Handle input movements
        let dx = 0;
        let dy = 0;
        
        // Keyboard movement
        if (keys['ArrowLeft'] || keys['KeyA'] || keys['a']) dx = -1;
        if (keys['ArrowRight'] || keys['KeyD'] || keys['d']) dx = 1;
        if (keys['ArrowUp'] || keys['KeyW'] || keys['w']) dy = -1;
        if (keys['ArrowDown'] || keys['KeyS'] || keys['s']) dy = 1;
        
        // Apply normal speeds
        let currentMoveSpeed = this.speed;
        
        // Normalize movement vector if diagonal
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length;
            dy /= length;
        }
        
        // Mobile touch control overrides (Joystick movement)
        if (state.isMobile && joystickActive) {
            const jdx = joystickCurrent.x - joystickStart.x;
            const jdy = joystickCurrent.y - joystickStart.y;
            const dist = Math.sqrt(jdx*jdx + jdy*jdy);
            const maxDist = 45; // Joystick outer radius limit
            
            if (dist > 5) {
                const angle = Math.atan2(jdy, jdx);
                const intensity = Math.min(dist / maxDist, 1.0);
                
                dx = Math.cos(angle) * intensity;
                dy = Math.sin(angle) * intensity;
            }
        }
        
        // Apply position update
        this.x += dx * currentMoveSpeed * (dt / 16.666);
        this.y += dy * currentMoveSpeed * (dt / 16.666);
        
        // Lock player inside visible canvas bounds
        const marginX = this.width / 2;
        const marginY = this.height / 2;
        if (this.x < marginX) this.x = marginX;
        if (this.x > LOGICAL_WIDTH - marginX) this.x = LOGICAL_WIDTH - marginX;
        if (this.y < marginY) this.y = marginY;
        if (this.y > LOGICAL_HEIGHT - marginY) this.y = LOGICAL_HEIGHT - marginY;
        
        // Shooting Logic
        if (this.shootTimer > 0) {
            this.shootTimer -= dt;
        }
        
        // Check firing inputs: Spacebar key OR AutoFire active on mobile
        let isShootingInput = keys['Space'] || keys[' '] ||
                      (state.isMobile && (autoFire || shootHeld));
        
        if (isShootingInput && this.shootTimer <= 0) {
            this.shoot();
        }
        
        // Powerup visual bar interface updates
        updatePowerupHUD();
    }
    
    shoot() {
        const laserType = this.powerups.tripleShot > 0 ? 'triple' : 'normal';
        const interval = this.powerups.rapidFire > 0 ? this.shootInterval / 2 : this.shootInterval;
        
        this.shootTimer = interval;
        
        // Fire procedural sound effect
        sfx.laser(laserType);
        
        if (this.powerups.tripleShot > 0) {
            // Center, Left diagonal, Right diagonal
            bullets.push(new Bullet(this.x, this.y - 30, 0, -22, '#00f0ff', true));
            bullets.push(new Bullet(this.x - 15, this.y - 20, -4, -20, '#bd00ff', true));
            bullets.push(new Bullet(this.x + 15, this.y - 20, 4, -20, '#bd00ff', true));
            
            // Neon thruster spark particles
            createSparks(this.x, this.y - 35, '#00f0ff', 6);
        } else {
            // Single regular glowing laser
            bullets.push(new Bullet(this.x, this.y - 35, 0, -24, '#00f0ff', true));
            createSparks(this.x, this.y - 35, '#00f0ff', 3);
        }
    }
    
    takeDamage(amount) {
        if (this.isInvulnerable) return;
        
        if (this.powerups.shield > 0) {
            sfx.shieldHit();
            createSparks(this.x, this.y, '#00f0ff', 25);
            
            // Subtract duration or instantly break shield
            this.powerups.shield = Math.max(0, this.powerups.shield - 3000); // subtract 3 seconds per hit
            
            // Temporary mini-invulnerability so they don't get hit repeatedly in 1 frame
            this.isInvulnerable = true;
            this.invulTime = 500;
            return;
        }
        
        state.playerHP = Math.max(0, state.playerHP - amount);
        sfx.explosion('small');
        createSparks(this.x, this.y, '#ff0055', 20);
        
        // Update HP UI bar immediately
        updateHUDValues();
        
        if (state.playerHP <= 0) {
            this.explode();
        } else {
            // Apply flashing vulnerability shield
            this.isInvulnerable = true;
            this.invulTime = this.invulDuration;
        }
    }
    
    heal(amount) {
        state.playerHP = Math.min(state.maxPlayerHP, state.playerHP + amount);
        updateHUDValues();
    }
    
    explode() {
        sfx.explosion('medium');
        createExplosion(this.x, this.y, '#00f0ff', 60);
        
        state.lives--;
        updateHUDValues();
        
        if (state.lives > 0) {
            // Respawn player
            this.x = LOGICAL_WIDTH / 2;
            this.y = LOGICAL_HEIGHT - 250;
            state.playerHP = state.maxPlayerHP;
            this.isInvulnerable = true;
            this.invulTime = 2500; // Longer invuln on spawn
            
            // Remove power-ups upon death
            for (let p in this.powerups) {
                this.powerups[p] = 0;
            }
            updateHUDValues();
        } else {
            endGame();
        }
    }
    
    draw() {
        // Blink if invulnerable
        if (this.isInvulnerable && Math.floor(Date.now() / 80) % 2 === 0) {
            return;
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 1. Engine Flame Particle Spray
        const flameHeight = 25 + Math.sin(this.engineFlameState) * 8;
        const flameGrad = ctx.createLinearGradient(0, 20, 0, 20 + flameHeight);
        flameGrad.addColorStop(0, '#00f0ff');
        flameGrad.addColorStop(0.3, 'rgba(189,0,255,0.8)');
        flameGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flameGrad;
        
        ctx.beginPath();
        ctx.moveTo(-10, 20);
        ctx.lineTo(0, 20 + flameHeight);
        ctx.lineTo(10, 20);
        ctx.closePath();
        ctx.fill();
        
        // 2. Draw Spaceship Body (Glowing Neon Vector Path)
        ctx.shadowBlur = 12;
        ctx.shadowColor = varColor('--neon-blue-glow');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        
        ctx.beginPath();
        // Nose cone
        ctx.moveTo(0, -38);
        // Right wingtip
        ctx.lineTo(32, 22);
        // Right interior fold
        ctx.lineTo(10, 12);
        // Base center
        ctx.lineTo(0, 20);
        // Left interior fold
        ctx.lineTo(-10, 12);
        // Left wingtip
        ctx.lineTo(-32, 22);
        ctx.closePath();
        ctx.stroke();
        
        // Inner Cockpit details
        ctx.shadowBlur = 8;
        ctx.shadowColor = varColor('--neon-purple-glow');
        ctx.fillStyle = varColor('--neon-purple');
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(6, 4);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        
        // 3. Renders Shield (glowing forcefield circle)
        if (this.powerups.shield > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.shadowBlur = 15 + Math.sin(this.engineFlameState * 2) * 5;
            ctx.shadowColor = varColor('--neon-blue-glow');
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            ctx.lineWidth = 3;
            
            // Dotted ring effect
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
            
            // Faint inner shield fill
            ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 18, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        
        // Debug Hitbox - Uncomment to see collision rings
        /*
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.stroke();
        */
    }
}

// ==========================================================================
// 4. Enemy Classes
// ==========================================================================

class Enemy {
    constructor(type, wave) {
        this.type = type; // 'scout', 'fighter', 'bomber', 'kamikaze'
        this.x = Math.random() * (LOGICAL_WIDTH - 120) + 60;
        this.y = -100;
        
        // Wave scaling multiplier
        const statMult = 1 + (wave - 1) * 0.15;
        
        this.shootTimer = Math.random() * 2000 + 1000;
        this.shootInterval = Math.max(1200, 3000 - wave * 150); // Fires faster as waves increase
        
        // Dynamic configuration by type
        switch (type) {
            case 'scout':
                this.width = 60;
                this.height = 50;
                this.radius = 24;
                this.health = Math.round(1 * statMult);
                this.maxHealth = this.health;
                this.speed = Math.min(8, 4.5 + wave * 0.3);
                this.points = 100;
                this.color = '#ff0055';
                this.glowColor = varColor('--neon-red-glow');
                break;
                
            case 'fighter':
                this.width = 70;
                this.height = 65;
                this.radius = 28;
                this.health = Math.round(3 * statMult);
                this.maxHealth = this.health;
                this.speed = Math.min(6, 3.2 + wave * 0.2);
                this.points = 250;
                this.color = '#bd00ff';
                this.glowColor = varColor('--neon-purple-glow');
                // Zig-zag math properties
                this.sineAngle = Math.random() * Math.PI * 2;
                this.sineSpeed = 0.06;
                this.sineAmp = 3.5;
                break;
                
            case 'bomber':
                this.width = 90;
                this.height = 80;
                this.radius = 38;
                this.health = Math.round(6 * statMult);
                this.maxHealth = this.health;
                this.speed = Math.min(3, 1.8 + wave * 0.1);
                this.points = 500;
                this.color = '#ffbd00';
                this.glowColor = varColor('--neon-gold-glow');
                this.bombTargetY = Math.random() * 400 + 200;
                this.hasStopped = false;
                break;
                
            case 'kamikaze':
                this.width = 50;
                this.height = 55;
                this.radius = 20;
                this.health = Math.round(2 * statMult);
                this.maxHealth = this.health;
                this.speed = Math.min(10, 5.0 + wave * 0.4);
                this.points = 200;
                this.color = '#00ff66';
                this.glowColor = varColor('--neon-green-glow');
                this.charged = false;
                this.chargeVector = { x: 0, y: 0 };
                break;
        }
    }
    
    update(dt) {
        const tickMult = dt / 16.666;
        
        switch (this.type) {
            case 'scout':
                this.y += this.speed * tickMult;
                break;
                
            case 'fighter':
                this.y += this.speed * tickMult;
                this.sineAngle += this.sineSpeed * tickMult;
                this.x += Math.sin(this.sineAngle) * this.sineAmp * tickMult;
                // Bounce off edges
                if (this.x < 50) this.x = 50;
                if (this.x > LOGICAL_WIDTH - 50) this.x = LOGICAL_WIDTH - 50;
                break;
                
            case 'bomber':
                // Slow down and stay near top half of screen, then move again
                if (!this.hasStopped && this.y >= this.bombTargetY) {
                    this.hasStopped = true;
                    // Stay for 4 seconds, then move off screen
                    setTimeout(() => {
                        this.hasStopped = false;
                        this.speed *= 1.5; // fly off faster
                    }, 4000);
                }
                
                if (!this.hasStopped) {
                    this.y += this.speed * tickMult;
                }
                
                // Shoot Bomber bullets down
                this.shootTimer -= dt;
                if (this.shootTimer <= 0) {
                    this.shootTimer = this.shootInterval;
                    this.shoot();
                }
                break;
                
            case 'kamikaze':
                // Move straight down until close to player, then track and charge!
                if (!this.charged && this.y > LOGICAL_HEIGHT * 0.25) {
                    this.charged = true;
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    this.chargeVector.x = Math.cos(angle) * (this.speed * 1.6);
                    this.chargeVector.y = Math.sin(angle) * (this.speed * 1.6);
                }
                
                if (this.charged) {
                    this.x += this.chargeVector.x * tickMult;
                    this.y += this.chargeVector.y * tickMult;
                } else {
                    this.y += this.speed * tickMult;
                }
                break;
        }
    }
    
    shoot() {
        if (!state.running || state.paused) return;
        sfx.laser('enemy');
        // Bomber fires double parallel lasers downwards
        bullets.push(new Bullet(this.x - 20, this.y + 40, 0, 12, '#ffbd00', false));
        bullets.push(new Bullet(this.x + 20, this.y + 40, 0, 12, '#ffbd00', false));
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        // Spawn sparks on impact
        createSparks(this.x, this.y, this.color, 5);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        sfx.explosion('small');
        createExplosion(this.x, this.y, this.color, 25);
        
        // Add score
        addScore(this.points);
        
        // Chance to spawn Power-up (15% drop rate)
        if (Math.random() < 0.15) {
            spawnPowerUp(this.x, this.y);
        }
        
        // Delete self from enemy list
        enemies = enemies.filter(e => e !== this);
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.glowColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        // Custom Vector Path per enemy design
        switch (this.type) {
            case 'scout':
                // V-shaped arrow wings
                ctx.beginPath();
                ctx.moveTo(0, 22);
                ctx.lineTo(25, -18);
                ctx.lineTo(8, -8);
                ctx.lineTo(0, -18);
                ctx.lineTo(-8, -8);
                ctx.lineTo(-25, -18);
                ctx.closePath();
                ctx.stroke();
                
                // Small reactor flame
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, -14, 4, 0, Math.PI*2);
                ctx.fill();
                break;
                
            case 'fighter':
                // Sleek fighter styling (forward pointing claws)
                ctx.beginPath();
                ctx.moveTo(0, -25);
                ctx.lineTo(12, -8);
                ctx.lineTo(28, 12);
                ctx.lineTo(10, 8);
                ctx.lineTo(0, 22); // Bottom spine point
                ctx.lineTo(-10, 8);
                ctx.lineTo(-28, 12);
                ctx.lineTo(-12, -8);
                ctx.closePath();
                ctx.stroke();
                
                // Outer wing highlights
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 2, 6, 0, Math.PI*2);
                ctx.fill();
                break;
                
            case 'bomber':
                // Heavy blocky hexagon shields
                ctx.beginPath();
                ctx.moveTo(-35, -20);
                ctx.lineTo(35, -20);
                ctx.lineTo(42, 10);
                ctx.lineTo(0, 38);
                ctx.lineTo(-42, 10);
                ctx.closePath();
                ctx.stroke();
                
                // Internal armor line panel
                ctx.strokeStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(-20, -5);
                ctx.lineTo(20, -5);
                ctx.lineTo(0, 15);
                ctx.closePath();
                ctx.stroke();
                
                // Giant glowing power core
                ctx.fillStyle = '#ffbd00';
                ctx.beginPath();
                ctx.arc(0, -8, 10, 0, Math.PI*2);
                ctx.fill();
                break;
                
            case 'kamikaze':
                // Pointy stinger triangle shape
                ctx.beginPath();
                ctx.moveTo(0, 25);
                ctx.lineTo(18, -18);
                ctx.lineTo(0, -10);
                ctx.lineTo(-18, -18);
                ctx.closePath();
                ctx.stroke();
                
                // Engine core glow
                ctx.fillStyle = '#00ff66';
                ctx.beginPath();
                ctx.arc(0, -6, 5, 0, Math.PI*2);
                ctx.fill();
                break;
        }
        
        ctx.restore();
        
        // Debug Hitbox
        /*
        ctx.strokeStyle = 'orange';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.stroke();
        */
    }
}

// ==========================================================================
// 5. Boss Spaceship Class
// ==========================================================================

class Boss {
    constructor(wave) {
        this.x = LOGICAL_WIDTH / 2;
        this.y = -200;
        this.width = 300;
        this.height = 220;
        this.radius = 110;
        
        // Boss stats scales based on active wave
        this.maxHealth = 40 + wave * 25;
        this.health = this.maxHealth;
        this.speed = 2.0;
        
        this.entranceDone = false;
        this.targetY = 280; // Sits near upper middle
        
        // Shooting & attack states
        this.attackTimer = 0;
        this.attackPatternIndex = 0;
        this.moveAngle = 0;
        
        // Sweeping beam charge timers
        this.chargeTimer = 0;
        this.isChargingBeam = false;
        this.beamActive = false;
        this.beamDuration = 3000; // 3 seconds beam duration
        this.beamXOffset = 0;
        this.beamSweepDirection = 1;
        
        sfx.bossWarning();
    }
    
    update(dt) {
        const tickMult = dt / 16.666;
        
        // Entrance animation down
        if (!this.entranceDone) {
            this.y += 1.5 * tickMult;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.entranceDone = true;
                this.attackTimer = 1000;
            }
            return;
        }
        
        // Sways horizontally side-to-side once entered
        this.moveAngle += 0.015 * tickMult;
        this.x = LOGICAL_WIDTH / 2 + Math.sin(this.moveAngle) * 220;
        
        // Attack timer handles patterns
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        } else {
            this.triggerAttack();
        }
        
        // Mega Beam charging update
        if (this.isChargingBeam) {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.isChargingBeam = false;
                this.beamActive = true;
                this.chargeTimer = this.beamDuration; // Reuse timer for beam active limit
                sfx.explosion('boss'); // Sound feedback
            }
        } else if (this.beamActive) {
            this.chargeTimer -= dt;
            // Sweep beam left and right
            this.beamXOffset += this.beamSweepDirection * 3.5 * tickMult;
            if (Math.abs(this.beamXOffset) > 180) {
                this.beamSweepDirection *= -1; // Reverse sweep
            }
            
            // Check Collision with player (horizontal slice overlaps)
            const beamX = this.x + this.beamXOffset;
            const beamHalfWidth = 45;
            if (player.x > beamX - beamHalfWidth - player.radius && 
                player.x < beamX + beamHalfWidth + player.radius &&
                player.y > this.y) {
                player.takeDamage(1.5); // Fast damage ticking
            }
            
            // Spawn sparks at bottom of beam
            if (Math.random() > 0.4) {
                createSparks(beamX, LOGICAL_HEIGHT - 30, '#ff0055', 3);
            }
            
            if (this.chargeTimer <= 0) {
                this.beamActive = false;
                this.beamXOffset = 0;
                this.attackTimer = 2000; // Delay before next regular attack
            }
        }
        
        // Sync HP visual bar
        const hpPct = Math.max(0, (this.health / this.maxHealth) * 100);
        bossHealthInner.style.width = `${hpPct}%`;
    }
    
    triggerAttack() {
        if (!state.running || state.paused) return;
        
        this.attackPatternIndex = (this.attackPatternIndex + 1) % 3;
        
        if (this.attackPatternIndex === 0) {
            // Pattern 0: Rapid spread burst (8 ways)
            sfx.laser('boss');
            const numBullets = 8;
            for (let i = 0; i < numBullets; i++) {
                const angle = (Math.PI / (numBullets - 1)) * i; // Arc facing down
                const vx = Math.cos(angle) * 7.5;
                const vy = Math.sin(angle) * 7.5;
                bullets.push(new Bullet(this.x, this.y + 40, vx, vy, '#ff0055', false));
            }
            this.attackTimer = 1800; // Wait 1.8s
        } 
        else if (this.attackPatternIndex === 1) {
            // Pattern 1: Targeted double rapid fires
            let fireCount = 0;
            const fireInterval = setInterval(() => {
                if (!state.running || state.paused || !boss) {
                    clearInterval(fireInterval);
                    return;
                }
                sfx.laser('enemy');
                // Wing left, Wing right
                bullets.push(new Bullet(this.x - 100, this.y + 20, 0, 14, '#ffbd00', false));
                bullets.push(new Bullet(this.x + 100, this.y + 20, 0, 14, '#ffbd00', false));
                
                fireCount++;
                if (fireCount >= 4) {
                    clearInterval(fireInterval);
                }
            }, 250);
            this.attackTimer = 2200;
        } 
        else if (this.attackPatternIndex === 2) {
            // Pattern 2: Heavy laser beam charge up warning
            this.isChargingBeam = true;
            this.chargeTimer = 2000; // 2 seconds charge up warning
            this.beamXOffset = 0;
            this.beamSweepDirection = Math.random() > 0.5 ? 1 : -1;
            this.attackTimer = 999999; // Lock attack loop during beam phase
        }
    }
    
    takeDamage(amount) {
        if (!this.entranceDone) return; // Invul during entrance
        
        this.health -= amount;
        createSparks(this.x, this.y, '#ff0055', 8);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        sfx.explosion('boss');
        
        // Spawn massive cluster explosions
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const ox = (Math.random() - 0.5) * 180;
                const oy = (Math.random() - 0.5) * 120;
                sfx.explosion('medium');
                createExplosion(this.x + ox, this.y + oy, '#ff0055', 40);
            }, i * 150);
        }
        
        addScore(3000); // 3000 pts boss bonus
        
        // Drop high-grade powerup bundle
        setTimeout(() => {
            spawnPowerUp(this.x - 60, this.y, 'shield');
            spawnPowerUp(this.x + 60, this.y, 'tripleShot');
        }, 1200);
        
        // Cleanup boss
        boss = null;
        state.bossActive = false;
        bossHealthContainer.classList.add('hidden');
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 1. Sweeping laser beam rendering
        if (this.beamActive) {
            ctx.restore();
            ctx.save();
            // Draw death beam from boss center down to bottom
            const beamX = this.x + this.beamXOffset;
            const beamGrad = ctx.createLinearGradient(beamX - 35, 0, beamX + 35, 0);
            beamGrad.addColorStop(0, 'rgba(255, 0, 85, 0.1)');
            beamGrad.addColorStop(0.3, 'rgba(255, 0, 85, 0.95)');
            beamGrad.addColorStop(0.5, '#ffffff'); // ultra white core
            beamGrad.addColorStop(0.7, 'rgba(255, 0, 85, 0.95)');
            beamGrad.addColorStop(1, 'rgba(255, 0, 85, 0.1)');
            
            ctx.fillStyle = beamGrad;
            ctx.shadowBlur = 30;
            ctx.shadowColor = varColor('--neon-red-glow');
            ctx.fillRect(beamX - 35, this.y + 40, 70, LOGICAL_HEIGHT - this.y);
            ctx.restore();
            ctx.save();
            ctx.translate(this.x, this.y);
        }
        
        // 2. Charging beam aura sparks
        if (this.isChargingBeam) {
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 15;
            ctx.shadowColor = varColor('--neon-red-glow');
            ctx.beginPath();
            ctx.arc(0, 45, 25 + Math.sin(Date.now() / 40) * 12, 0, Math.PI * 2);
            ctx.stroke();
            
            // Firing path indicator line
            ctx.setLineDash([4, 16]);
            ctx.beginPath();
            ctx.moveTo(0, 45);
            ctx.lineTo(0, LOGICAL_HEIGHT);
            ctx.stroke();
        }
        
        // 3. Draw Boss Hull (Heavy metallic neon lines)
        ctx.shadowBlur = 18;
        ctx.shadowColor = varColor('--neon-red-glow');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4.5;
        
        ctx.beginPath();
        // Nose pointer
        ctx.moveTo(0, 60);
        // Left underside
        ctx.lineTo(-40, 30);
        // Left gun mount
        ctx.lineTo(-90, 40);
        ctx.lineTo(-100, -20);
        // Left main wing expansion
        ctx.lineTo(-145, 10);
        ctx.lineTo(-130, -70);
        // Left back hull
        ctx.lineTo(-50, -60);
        // Center back exhaust
        ctx.lineTo(-20, -85);
        ctx.lineTo(20, -85);
        // Right back hull
        ctx.lineTo(50, -60);
        // Right main wing expansion
        ctx.lineTo(130, -70);
        ctx.lineTo(145, 10);
        // Right gun mount
        ctx.lineTo(100, -20);
        ctx.lineTo(90, 40);
        // Right underside
        ctx.lineTo(40, 30);
        ctx.closePath();
        ctx.stroke();
        
        // Inner Details & Reactor vents (glowing purple/orange)
        ctx.strokeStyle = varColor('--neon-red');
        ctx.lineWidth = 2.5;
        
        // Left wing details
        ctx.beginPath();
        ctx.moveTo(-115, -45);
        ctx.lineTo(-65, -35);
        ctx.lineTo(-105, -15);
        ctx.closePath();
        ctx.stroke();
        
        // Right wing details
        ctx.beginPath();
        ctx.moveTo(115, -45);
        ctx.lineTo(65, -35);
        ctx.lineTo(105, -15);
        ctx.closePath();
        ctx.stroke();
        
        // Mega Cannon Core (Center bottom)
        ctx.shadowBlur = 10;
        ctx.fillStyle = this.isChargingBeam ? '#ffffff' : varColor('--neon-red');
        ctx.beginPath();
        ctx.arc(0, 30, 16, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }
}

// ==========================================================================
// 6. Laser Bullet Class
// ==========================================================================

class Bullet {
    constructor(x, y, vx, vy, color, fromPlayer = true) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.fromPlayer = fromPlayer;
        
        this.width = 6;
        this.height = 32;
        this.radius = 6; // Hitbox radius
    }
    
    update(dt) {
        const tickMult = dt / 16.666;
        this.x += this.vx * tickMult;
        this.y += this.vy * tickMult;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff'; // White solid core
        ctx.strokeStyle = this.color; // Glowing colored shell
        ctx.lineWidth = 2.5;
        
        // Draw capsules (glowing pill shape)
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(0, this.height / 2);
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();
    }
}

// ==========================================================================
// 7. Power-up Item Class
// ==========================================================================

class PowerUp {
    constructor(x, y, forcedType = null) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 36;
        this.radius = 18;
        this.speed = 3.0;
        
        // Random pick or explicit boss drop
        const types = ['tripleShot', 'rapidFire', 'shield', 'healthPack', 'magnet'];
        this.type = forcedType ? forcedType : types[Math.floor(Math.random() * types.length)];
        
        // Visual labeling
        switch (this.type) {
            case 'tripleShot':
                this.label = 'T';
                this.color = '#bd00ff';
                this.glowColor = varColor('--neon-purple-glow');
                break;
            case 'rapidFire':
                this.label = 'R';
                this.color = '#00ff66';
                this.glowColor = varColor('--neon-green-glow');
                break;
            case 'shield':
                this.label = 'S';
                this.color = '#00f0ff';
                this.glowColor = varColor('--neon-blue-glow');
                break;
            case 'healthPack':
                this.label = 'H';
                this.color = '#ff0055';
                this.glowColor = varColor('--neon-red-glow');
                break;
            case 'magnet':
                this.label = 'M';
                this.color = '#ffbd00';
                this.glowColor = varColor('--neon-gold-glow');
                break;
        }
        
        this.floatAngle = Math.random() * Math.PI;
    }
    
    update(dt) {
        const tickMult = dt / 16.666;
        
        // 1. Magnet Pull Logic
        if (player.powerups.magnet > 0) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const magnetRadius = 380; // Large grab area
            
            if (dist < magnetRadius) {
                // Accelerate towards player spaceship
                const force = (1 - dist / magnetRadius) * 12;
                this.x += (dx / dist) * force * tickMult;
                this.y += (dy / dist) * force * tickMult;
                
                // Add tiny path trace sparks
                if (Math.random() > 0.75) {
                    particles.push(new Particle(this.x, this.y, this.color, 0.4));
                }
                return; // Override standard slow descent
            }
        }
        
        // 2. Standard downward floating movement
        this.y += this.speed * tickMult;
        this.floatAngle += 0.05 * tickMult;
        this.x += Math.sin(this.floatAngle) * 0.8 * tickMult;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Glowing Neon Hexagon Frame
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.glowColor;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = Math.cos(angle) * this.radius;
            const hy = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Center Tag Letter
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, 0, 0);
        
        ctx.restore();
    }
}

// ==========================================================================
// 8. Explosion Particle Class
// ==========================================================================

class Particle {
    constructor(x, y, color, speedScale = 1.0) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        // Velocity direction random angles
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 2) * speedScale;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.radius = Math.random() * 3.5 + 1.5;
        this.life = 1.0; // Alpha percent
        this.decay = Math.random() * 0.02 + 0.015; // Decay rate
    }
    
    update(dt) {
        const tickMult = dt / 16.666;
        this.x += this.vx * tickMult;
        this.y += this.vy * tickMult;
        
        // Friction slowdown
        this.vx *= Math.pow(0.97, tickMult);
        this.vy *= Math.pow(0.97, tickMult);
        
        this.life -= this.decay * tickMult;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Helper methods to spawn groups of sparks/explosions
function createSparks(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 0.6));
    }
}

function createExplosion(x, y, color, count = 30) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 1.2));
    }
}

function spawnPowerUp(x, y, type = null) {
    powerups.push(new PowerUp(x, y, type));
}

// Helper to pull CSS custom property colors easily
function varColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

// ==========================================================================
// 9. Collisions & Physics Rules
// ==========================================================================

function checkCollisions() {
    // Circle Collision Utility
    function hitCheck(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        return distance < (obj1.radius + obj2.radius);
    }
    
    // 1. Lasers hitting enemies / player
    bullets.forEach((bullet) => {
        if (bullet.fromPlayer) {
            // Player bullets checking Enemy ships
            enemies.forEach((enemy) => {
                if (hitCheck(bullet, enemy)) {
                    enemy.takeDamage(1); // Standard laser does 1 damage
                    bullet.active = false; // flag for deletion
                }
            });
            
            // Check Boss hit
            if (state.bossActive && boss && hitCheck(bullet, boss)) {
                boss.takeDamage(1);
                bullet.active = false;
            }
        } else {
            // Enemy bullets checking Player
            if (hitCheck(bullet, player)) {
                player.takeDamage(12); // Medium bullet hit damage
                bullet.active = false;
            }
        }
    });
    
    // Clean deleted bullets
    bullets = bullets.filter(b => b.active !== false && b.y > -50 && b.y < LOGICAL_HEIGHT + 50 && b.x > -50 && b.x < LOGICAL_WIDTH + 50);
    
    // 2. Enemies crashing directly into Player
    enemies.forEach((enemy) => {
        if (hitCheck(enemy, player)) {
            player.takeDamage(20); // Massive collision damage
            enemy.takeDamage(enemy.maxHealth); // Destroys the scout/fighter on impact
        }
    });
    
    // 3. Power-ups grabbed by Player
    powerups.forEach((pw) => {
        if (hitCheck(pw, player)) {
            grabPowerUp(pw.type);
            pw.active = false;
        }
    });
    
    // Clean powerups list
    powerups = powerups.filter(p => p.active !== false && p.y < LOGICAL_HEIGHT + 50);
}

function grabPowerUp(type) {
    sfx.powerup();
    
    const baseDuration = 8000; // 8 seconds duration
    
    switch (type) {
        case 'tripleShot':
            player.powerups.tripleShot = baseDuration;
            break;
        case 'rapidFire':
            player.powerups.rapidFire = baseDuration;
            break;
        case 'shield':
            player.powerups.shield = baseDuration;
            break;
        case 'healthPack':
            player.heal(35); // Heals 35 points HP
            createSparks(player.x, player.y, '#00ff66', 15);
            break;
        case 'magnet':
            player.powerups.magnet = baseDuration + 4000; // Magnet lasts 12s
            break;
    }
}

// Render dynamic floating progress overlays for powerups on HUD
function updatePowerupHUD() {
    activePowerups.innerHTML = '';
    
    const config = {
        tripleShot: { label: 'TRIPLE SHOT', color: varColor('--neon-purple') },
        rapidFire: { label: 'RAPID FIRE', color: varColor('--neon-green') },
        shield: { label: 'FORCE SHIELD', color: varColor('--neon-blue') },
        magnet: { label: 'ITEM MAGNET', color: varColor('--neon-gold') }
    };
    
    for (let p in player.powerups) {
        const timeRemaining = player.powerups[p];
        if (timeRemaining > 0) {
            const pct = (timeRemaining / 8000) * 100;
            const barHTML = `
                <div class="powerup-bar-wrapper">
                    <span class="powerup-bar-label" style="color: ${config[p].color}">${config[p].label}</span>
                    <div class="powerup-bar-outer">
                        <div class="powerup-bar-inner" style="width: ${Math.min(pct, 100)}%; background-color: ${config[p].color}"></div>
                    </div>
                </div>
            `;
            activePowerups.insertAdjacentHTML('beforeend', barHTML);
        }
    }
}

// ==========================================================================
// 10. Wave Spawner & Difficulty curve
// ==========================================================================

function spawnWaveEnemy() {
    if (!state.running || state.paused || state.bossActive) return;
    
    // Weighted probabilities based on level
    const lvl = state.level;
    const roll = Math.random();
    
    let type = 'scout';
    if (lvl === 1) {
        type = 'scout';
    } else if (lvl === 2) {
        type = roll > 0.7 ? 'fighter' : 'scout';
    } else if (lvl === 3) {
        type = roll > 0.8 ? 'bomber' : (roll > 0.5 ? 'fighter' : 'scout');
    } else {
        // High waves add Kamikaze
        if (roll > 0.85) type = 'bomber';
        else if (roll > 0.65) type = 'kamikaze';
        else if (roll > 0.4) type = 'fighter';
        else type = 'scout';
    }
    
    enemies.push(new Enemy(type, lvl));
}

// Check score points increments for Boss triggers
function addScore(pts) {
    state.score += pts;
    state.bossScoreAccumulated += pts;
    
    updateHUDValues();
    
    // Boss appears every 5000 score points
    if (state.bossScoreAccumulated >= state.bossSpawnScoreTrigger && !state.bossActive) {
        spawnBossEvent();
    }
}

function spawnBossEvent() {
    state.bossActive = true;
    state.bossScoreAccumulated = 0;
    
    // Clear regular small enemies to isolate boss
    enemies = [];
    
    // Trigger Warnings UI banner
    bossWarning.classList.remove('hidden');
    
    setTimeout(() => {
        bossWarning.classList.add('hidden');
        if (state.running) {
            boss = new Boss(state.level);
            bossHealthContainer.classList.remove('hidden');
        }
    }, 3000);
}

// ==========================================================================
// 11. Core Engine Loop (Main tick)
// ==========================================================================

function gameTick(currentTime) {
    if (!state.running) return;
    
    // Prevent huge frame step jumps on tab-inactive resumption
    if (!state.lastTime) state.lastTime = currentTime;
    let dt = currentTime - state.lastTime;
    
    // Clamp delta time in case of severe lag spike (prevents clipping)
    if (dt > 100) dt = 16.666;
    state.lastTime = currentTime;
    
    if (!state.paused) {
        // 1. Update entities
        updateBackground(dt);
        player.update(dt);
        
        bullets.forEach(bullet => bullet.update(dt));
        enemies.forEach(enemy => enemy.update(dt));
        powerups.forEach(pw => pw.update(dt));
        particles.forEach(p => p.update(dt));
        
        if (state.bossActive && boss) {
            boss.update(dt);
        }
        
        // Filter out dead particles
        particles = particles.filter(p => p.life > 0);
        // Filter out enemies that fly off screen
        enemies = enemies.filter(e => e.y < LOGICAL_HEIGHT + 100);
        
        // 2. Spawn Checks
        state.spawnTimer += dt;
        if (state.spawnTimer >= state.spawnInterval) {
            state.spawnTimer = 0;
            // Spawn standard wave enemy
            spawnWaveEnemy();
        }
        
        state.waveTimer += dt;
        if (state.waveTimer >= state.waveDuration) {
            state.waveTimer = 0;
            state.level++;
            // Make spawns faster and harder
            state.spawnInterval = Math.max(700, 1800 - state.level * 100);
            updateHUDValues();
        }
        
        // 3. Physics checks
        checkCollisions();
    }
    
    // 4. Render Pipeline
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    drawBackground();
    player.draw();
    
    bullets.forEach(bullet => bullet.draw());
    enemies.forEach(enemy => enemy.draw());
    powerups.forEach(pw => pw.draw());
    particles.forEach(p => p.draw());
    
    if (state.bossActive && boss) {
        boss.draw();
    }
    
    // Loop
    requestAnimationFrame(gameTick);
}

// ==========================================================================
// 12. State Managers (UI Triggers)
// ==========================================================================

function initGame() {
    state.score = 0;
    state.bossScoreAccumulated = 0;
    state.level = 1;
    state.lives = 3;
    state.playerHP = state.maxPlayerHP;
    state.spawnInterval = 1800;
    state.spawnTimer = 0;
    state.waveTimer = 0;
    state.bossActive = false;
    state.paused = false;
    
    // Clear list sets
    bullets = [];
    enemies = [];
    powerups = [];
    particles = [];
    boss = null;
    
    // Build objects
    player = new Player();
    
    // Setup backgrounds
    initBackground();
    
    // Load local storage high scores
    state.highscore = localStorage.getItem('neo_vectors_high') || 0;
    
    // Hide panels, show HUD
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    bossHealthContainer.classList.add('hidden');
    hud.classList.remove('hidden');
    
    // Mobile controls setup
    detectMobile();
    
    // Activate Loop
    state.running = true;
    state.lastTime = 0;
    
    // Re-verify UI syncs
    updateHUDValues();
    
    // Kickstart Audio synthesizer
    initAudio();
    
    requestAnimationFrame(gameTick);
}

function pauseGame() {
    if (!state.running) return;
    state.paused = true;
    pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    state.paused = false;
    pauseScreen.classList.add('hidden');
}

function endGame() {
    state.running = false;
    stopMusicLoop();
    
    hud.classList.add('hidden');
    bossHealthContainer.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');
    
    finalScoreVal.textContent = state.score.toLocaleString();
    finalWavesVal.textContent = state.level - 1;
    
    // High Score updates
    if (state.score > state.highscore) {
        state.highscore = state.score;
        localStorage.setItem('neo_vectors_high', state.highscore);
        newHighscoreBadge.classList.remove('hidden');
        gameoverTitle.textContent = "NEW RECORD SET!";
        gameoverTitle.className = "neon-gold";
        gameoverSubtitle.textContent = "COSMIC FLIGHT LOG UPDATED";
    } else {
        newHighscoreBadge.classList.add('hidden');
        gameoverTitle.textContent = "VESSEL DESTROYED";
        gameoverTitle.className = "neon-red";
        gameoverSubtitle.textContent = "SYSTEM TERMINATED";
    }
}

// HUD Synchronizations
function updateHUDValues() {
    scoreVal.textContent = state.score.toString().padStart(6, '0');
    levelVal.textContent = state.level;
    highscoreVal.textContent = state.highscore.toString().padStart(6, '0');
    
    // HP bar sync
    const hpPct = Math.max(0, (state.playerHP / state.maxPlayerHP) * 100);
    hpBarInner.style.width = `${hpPct}%`;
    
    if (state.playerHP < 30) {
        hpBarInner.classList.add('hp-critical');
    } else {
        hpBarInner.classList.remove('hp-critical');
    }
    
    // Redraw hearts/icons
    livesIcons.innerHTML = '';
    for (let i = 0; i < state.maxLives; i++) {
        const liveEl = document.createElement('div');
        liveEl.className = `live-icon ${i >= state.lives ? 'lost' : ''}`;
        livesIcons.appendChild(liveEl);
    }
}

// ==========================================================================
// 13. Controls & Setup Bindings
// ==========================================================================

function handleResize() {
    const wrapper = document.getElementById('game-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    
    // Scale canvas backbuffer size to logic coordinates exactly
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    
    detectMobile();
}

// Input Event Listeners
window.addEventListener('keydown', (e) => {
    // Treat Spacebar and arrow keys as active gameplay inputs, prevent scrolling standard window
    if (['Space', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) > -1) {
        e.preventDefault();
    }
    keys[e.code] = true;
    keys[e.key] = true; // backups
    
    // Pause hotkeys
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state.running) {
            if (state.paused) resumeGame();
            else pauseGame();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    keys[e.key] = false;
});

// Mobile layouts check
// ==========================================================================
// Mobile / touch controls
// ==========================================================================

const IS_TOUCH_DEVICE =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function detectMobile() {
    // Touch hardware OR narrow viewport counts as mobile
    state.isMobile = IS_TOUCH_DEVICE || window.innerWidth <= 768;

    document.body.classList.toggle('is-touch', state.isMobile);
    updateMobileControlsVisibility();
}

// Call this after ANY state change (start / pause / resume / gameover)
function updateMobileControlsVisibility() {
    const inGame = state.isMobile && state.running && !state.paused;
    document.body.classList.toggle('game-idle', !inGame);
    mobileControls.classList.toggle('hidden', !inGame);
}

detectMobile();
window.addEventListener('resize', detectMobile);
window.addEventListener('orientationchange', () => setTimeout(detectMobile, 200));

// --- Joystick (pointer events: works for touch, pen and mouse) ---
let joystickPointerId = null;

function startJoystick(clientX, clientY) {
    joystickActive = true;
    const rect = joystickZone.getBoundingClientRect();
    joystickStart.x = rect.left + rect.width / 2;
    joystickStart.y = rect.top + rect.height / 2;
    updateJoystickKnob(clientX, clientY);
}

function updateJoystickKnob(clientX, clientY) {
    joystickCurrent.x = clientX;
    joystickCurrent.y = clientY;

    let dx = clientX - joystickStart.x;
    let dy = clientY - joystickStart.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 45;

    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystickKnob() {
    joystickActive = false;
    joystickPointerId = null;
    joystickKnob.style.transform = 'translate(0px, 0px)';
    joystickCurrent = { ...joystickStart };
}

joystickZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joystickPointerId = e.pointerId;
    joystickZone.setPointerCapture(e.pointerId);
    startJoystick(e.clientX, e.clientY);
});

joystickZone.addEventListener('pointermove', (e) => {
    if (!joystickActive || e.pointerId !== joystickPointerId) return;
    e.preventDefault();
    updateJoystickKnob(e.clientX, e.clientY);
});

joystickZone.addEventListener('pointerup', resetJoystickKnob);
joystickZone.addEventListener('pointercancel', resetJoystickKnob);
joystickZone.addEventListener('lostpointercapture', resetJoystickKnob);

// --- Shoot button (hold to fire continuously) ---
let shootHeld = false;
btnShoot.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    shootHeld = true;
    if (player && state.running && !state.paused) player.shoot();
});
const releaseShoot = () => { shootHeld = false; };
btnShoot.addEventListener('pointerup', releaseShoot);
btnShoot.addEventListener('pointercancel', releaseShoot);
btnShoot.addEventListener('pointerleave', releaseShoot);

// --- Auto-fire toggle ---
btnAutofire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    autoFire = !autoFire;
    const status = btnAutofire.querySelector('.btn-status');
    status.textContent = autoFire ? 'ON' : 'OFF';
    status.className = 'btn-status ' + (autoFire ? 'neon-green' : 'neon-red');
});

// Stop iOS rubber-band scroll, but let the controls receive their events
document.addEventListener('touchmove', (e) => {
    if (state.running) e.preventDefault();
}, { passive: false });

// --- Button Event Binds ---
document.getElementById('btn-start').addEventListener('click', initGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', initGame);
document.getElementById('btn-restart-pause').addEventListener('click', initGame);

// SFX/Music controls
const soundBtn = document.getElementById('btn-toggle-sound');
soundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
        soundBtn.textContent = 'SFX: ON';
        soundBtn.className = 'btn btn-sound sound-on';
    } else {
        soundBtn.textContent = 'SFX: OFF';
        soundBtn.className = 'btn btn-sound sound-off';
    }
});

const musicBtn = document.getElementById('btn-toggle-music');
musicBtn.addEventListener('click', () => {
    state.musicEnabled = !state.musicEnabled;
    if (state.musicEnabled) {
        musicBtn.textContent = 'MUSIC: ON';
        musicBtn.className = 'btn btn-sound sound-on';
        if (audioCtx) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            startMusicLoop();
        }
    } else {
        musicBtn.textContent = 'MUSIC: OFF';
        musicBtn.className = 'btn btn-sound sound-off';
        stopMusicLoop();
    }
});

// --- Boot Initializer ---
window.addEventListener('load', () => {
    handleResize();
    
    // Load highscore to menu start display
    state.highscore = localStorage.getItem('neo_vectors_high') || 0;
    menuHighscore.textContent = state.highscore.toString().padStart(6, '0');
    
    window.addEventListener('resize', handleResize);
});
(function enableTouchShoot() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  // Prevent page scroll / zoom while playing
  const stop = e => { e.preventDefault(); };
  canvas.style.touchAction = 'none';

  function fireShot() {
    // Try common shoot function names the game might expose
    if (typeof shoot === 'function') return shoot();
    if (window.player && typeof window.player.shoot === 'function') return window.player.shoot();
    if (typeof fire === 'function') return fire();

    // Fallback: simulate Spacebar keypress (most JS games listen for Space)
    ['keydown', 'keyup'].forEach(type => {
      window.dispatchEvent(new KeyboardEvent(type, {
        key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true
      }));
    });
  }

  function movePlayerTo(touch) {
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
    if (window.player) {
      if ('x' in window.player) window.player.x = x;
      if ('y' in window.player) window.player.y = y;
    }
  }

  let holdTimer = null;

  canvas.addEventListener('touchstart', e => {
    stop(e);
    const t = e.touches[0];
    movePlayerTo(t);
    fireShot();
    // Auto-fire while finger is held down
    clearInterval(holdTimer);
    holdTimer = setInterval(fireShot, 180);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    stop(e);
    movePlayerTo(e.touches[0]);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    stop(e);
    clearInterval(holdTimer);
    holdTimer = null;
  }, { passive: false });
})();
