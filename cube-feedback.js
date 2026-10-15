const TURN_VIBRATE_MS = 12;
const WIN_VIBRATE_PATTERN = [80, 50, 80, 50, 220];
const WIN_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
const WIN_NOTE_GAP_S = 0.12;

const CLICK_SAMPLE_URL = "click.wav";

const feedback = { context: null, clickSample: null };

// Browsers only allow audio after a tap or click, so the context is made on the first one
function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!feedback.context && AudioContextClass)
    feedback.context = new AudioContextClass();
  if (feedback.context && feedback.context.state === "suspended")
    feedback.context.resume();
  if (feedback.context && !feedback.clickSample) loadClickSample();
}

// A real recording replaces the synthesized crunch when click.wav can be fetched (not from file://)
function loadClickSample() {
  fetch(CLICK_SAMPLE_URL)
    .then((response) => response.arrayBuffer())
    .then((data) => feedback.context.decodeAudioData(data))
    .then((buffer) => {
      feedback.clickSample = buffer;
    })
    .catch(() => {
      // no file reachable, the synthesized click stays
    });
}

function playTone(frequency, delay, duration, { type = "sine", volume = 0.2 } = {}) {
  const context = feedback.context;
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

// Short burst of high-passed noise: the "crunch" of plastic edges
function playCrunch(duration, volume, highpassHz) {
  const context = feedback.context;
  if (!context) return;
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++)
    samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = highpassHz;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
}

function playClick() {
  const context = feedback.context;
  if (context && feedback.clickSample) {
    const source = context.createBufferSource();
    source.buffer = feedback.clickSample;
    source.connect(context.destination);
    source.start();
    return;
  }
  playCrunch(0.035, 0.5, 2200);
  playTone(170, 0, 0.05, { volume: 0.25 });
}

// Same recipes as click.wav and win.wav, which App Inventor plays instead when the page runs inside the app
const WEB_FEEDBACK = {
  turn: {
    sound: playClick,
    vibration: TURN_VIBRATE_MS,
  },
  win: {
    sound: () =>
      WIN_NOTES_HZ.forEach((hz, i) => playTone(hz, i * WIN_NOTE_GAP_S, 0.25)),
    vibration: WIN_VIBRATE_PATTERN,
  },
};

function playFeedback(kind) {
  if (isInApp()) {
    sendToApp(kind);
    return;
  }
  const { sound, vibration } = WEB_FEEDBACK[kind];
  sound();
  if (navigator.vibrate) navigator.vibrate(vibration);
}

function initFeedback() {
  window.addEventListener("pointerdown", unlockAudio);
}
