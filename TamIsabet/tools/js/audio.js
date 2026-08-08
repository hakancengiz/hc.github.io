(() => {
class Feedback {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
  }

  unlock() {
    if (!this.settings.soundEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context ||= new AudioContext();
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(kind) {
    if (!this.settings.soundEnabled) return;
    this.unlock();
    if (!this.context) return;
    const patterns = {
      start: [[330, .04, .045], [520, .05, .07]],
      perfect: [[520, .04, .08], [780, .06, .1], [1040, .1, .13]],
      great: [[500, .04, .07], [760, .08, .1]],
      good: [[440, .05, .08], [600, .07, .08]],
      miss: [[170, .05, .08], [120, .09, .12]],
      combo: [[650, .04, .06], [900, .05, .08]],
      over: [[320, .06, .1], [230, .1, .13]]
    };
    const now = this.context.currentTime;
    (patterns[kind] || patterns.good).forEach(([frequency, delay, duration], index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = kind === "miss" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now + delay + index * .05);
      gain.gain.exponentialRampToValueAtTime(.11, now + delay + index * .05 + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + index * .05 + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now + delay + index * .05);
      oscillator.stop(now + delay + index * .05 + duration + .02);
    });
  }

  vibrate(pattern) {
    if (this.settings.vibrationEnabled && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  result(rank) {
    if (rank === "perfect") { this.tone("perfect"); this.vibrate([25]); }
    else if (rank === "great") { this.tone("great"); this.vibrate([15]); }
    else if (rank === "miss") { this.tone("miss"); this.vibrate([35, 30, 35]); }
    else this.tone("good");
  }
}

window.TamFeedback = Feedback;
})();
