// RupeePulse - Offscreen Audio Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playFintechChime(isTest = false) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Frequencies: High-class ascending bell tones (E5, G#5, B5, E6)
    const notes = isTest ? [659.25, 880.00] : [659.25, 830.61, 987.77, 1318.51];
    const duration = isTest ? 0.35 : 0.55;

    notes.forEach((freq, idx) => {
      const startTime = now + (idx * 0.08);

      // Primary tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Bell harmonic tone
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2, startTime);

      // Envelopes
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      gainHarmonic.gain.setValueAtTime(0.001, startTime);
      gainHarmonic.gain.linearRampToValueAtTime(0.05, startTime + 0.02);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.6));

      // Connections
      osc.connect(gain);
      gain.connect(ctx.destination);

      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);

      osc.start(startTime);
      oscHarmonic.start(startTime);

      osc.stop(startTime + duration);
      oscHarmonic.stop(startTime + duration);
    });
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen' && message.type === 'PLAY_CHIME') {
    playFintechChime(message.isTest);
  }
  // Return false: caller does not await a response
  return false;
});
