
// Web Audio API Context
let audioCtx: AudioContext | null = null;
let thrustOsc: OscillatorNode | null = null;
let thrustGain: GainNode | null = null;
let thrustNoise: AudioBufferSourceNode | null = null;

let gravityOsc: OscillatorNode | null = null;
let gravityGain: GainNode | null = null;

const createNoiseBuffer = (ctx: AudioContext) => {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playThrustSound = (active: boolean) => {
  if (!audioCtx) return;

  if (active) {
    if (!thrustGain) {
      // Create Noise
      const buffer = createNoiseBuffer(audioCtx);
      thrustNoise = audioCtx.createBufferSource();
      thrustNoise.buffer = buffer;
      thrustNoise.loop = true;

      // Filter (Low pass for rumble)
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;

      thrustGain = audioCtx.createGain();
      thrustGain.gain.value = 0.15; // Volume

      thrustNoise.connect(filter);
      filter.connect(thrustGain);
      thrustGain.connect(audioCtx.destination);
      thrustNoise.start();
    }
  } else {
    if (thrustGain) {
      // Smooth fade out
      thrustGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
      setTimeout(() => {
        if (thrustNoise) thrustNoise.stop();
        thrustNoise = null;
        thrustGain = null;
      }, 200);
    }
  }
};

export const playGravitySound = (active: boolean, intensity: number = 1) => {
  if (!audioCtx) return;

  if (active) {
    if (!gravityOsc) {
      gravityOsc = audioCtx.createOscillator();
      gravityOsc.type = 'sine';
      gravityOsc.frequency.value = 60; // Deep hum

      gravityGain = audioCtx.createGain();
      gravityGain.gain.value = 0.0;

      gravityOsc.connect(gravityGain);
      gravityGain.connect(audioCtx.destination);
      gravityOsc.start();
    }
    // Modulate pitch/volume based on intensity/upgrades
    if (gravityGain) {
        gravityGain.gain.setTargetAtTime(0.15 * intensity, audioCtx.currentTime, 0.1);
    }
    if (gravityOsc) {
        gravityOsc.frequency.setTargetAtTime(50 + (intensity * 20), audioCtx.currentTime, 0.1);
    }

  } else {
    if (gravityGain) {
      gravityGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
      setTimeout(() => {
        if (gravityOsc) gravityOsc.stop();
        gravityOsc = null;
        gravityGain = null;
      }, 300);
    }
  }
};

export const playExplosion = (size: 'small' | 'large') => {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);

  gain.gain.setValueAtTime(size === 'large' ? 0.5 : 0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
};
