// 효과음 + BGM 서비스 (Web Audio API)
class SoundServiceClass {
  constructor() {
    this.audioContext = null;
    this.sfxEnabled = true;
    this.bgmEnabled = true;
    this.volume = 0.5;
    this.bgmVolume = 0.35;
    // BGM 관련
    this.bgmPlaying = false;
    this.bgmNodes = [];
    this.bgmInterval = null;
  }

  // 초기화 (사용자 상호작용 후 호출 필요)
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // 설정 로드
    this.sfxEnabled = localStorage.getItem('sfx_enabled') !== 'false';
    this.bgmEnabled = localStorage.getItem('bgm_enabled') !== 'false';
    this.volume = parseFloat(localStorage.getItem('sound_volume') || '0.5');
    this.bgmVolume = parseFloat(localStorage.getItem('bgm_volume') || '0.35');
  }

  // === 개별 토글 ===

  get enabled() {
    return this.sfxEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('sfx_enabled', this.sfxEnabled);
    return this.sfxEnabled;
  }

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    localStorage.setItem('bgm_enabled', this.bgmEnabled);
    if (this.bgmEnabled) {
      this.startLobbyBgm();
    } else {
      this.stopBgm();
    }
    return this.bgmEnabled;
  }

  // 하위호환: 전체 토글
  toggle() {
    const newState = !(this.sfxEnabled && this.bgmEnabled);
    this.sfxEnabled = newState;
    this.bgmEnabled = newState;
    localStorage.setItem('sfx_enabled', this.sfxEnabled);
    localStorage.setItem('bgm_enabled', this.bgmEnabled);
    if (!this.bgmEnabled) this.stopBgm();
    return newState;
  }

  // 볼륨 설정
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('sound_volume', this.volume);
  }

  // ===== BGM =====

  startLobbyBgm() {
    if (!this.bgmEnabled) return;
    if (this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;
    this._playLobbyLoop();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval);
      this.bgmInterval = null;
    }
    // 현재 재생 중인 노드 정리
    this.bgmNodes.forEach(n => {
      try { n.stop(); } catch (e) {}
    });
    this.bgmNodes = [];
  }

  _playLobbyLoop() {
    if (!this.bgmPlaying || !this.bgmEnabled) return;

    // 이전 루프 노드 정리
    this.bgmNodes = [];

    const bpm = 70;
    const beat = 60 / bpm;
    const ctx = this.audioContext;
    if (!ctx) return;

    // suspended 상태면 resume
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const vol = this.bgmVolume;

    // === 패드 (저음 깔개) ===
    const padChords = [
      [220.00, 261.63, 329.63],  // Am
      [174.61, 220.00, 261.63],  // F
      [130.81, 164.81, 196.00],  // C
      [196.00, 246.94, 293.66],  // G
    ];

    let totalTime = 0;
    padChords.forEach((chord) => {
      const dur = beat * 4;
      chord.forEach(freq => {
        this._schedulePadNote(freq, totalTime, dur, vol * 0.5);
      });
      totalTime += dur;
    });

    // === 아르페지오 (네온 느낌) ===
    const arpNotes = [
      440, 523.25, 659.25, 523.25,
      349.23, 440, 523.25, 440,
      523.25, 659.25, 783.99, 659.25,
      392, 493.88, 587.33, 493.88,
    ];

    arpNotes.forEach((freq, i) => {
      const startTime = i * beat;
      this._scheduleArpNote(freq, startTime, beat * 0.7, vol * 0.3);
    });

    // === 베이스라인 ===
    const bassNotes = [
      { freq: 110, time: 0 },
      { freq: 110, time: beat * 2 },
      { freq: 87.31, time: beat * 4 },
      { freq: 87.31, time: beat * 6 },
      { freq: 130.81, time: beat * 8 },
      { freq: 130.81, time: beat * 10 },
      { freq: 98, time: beat * 12 },
      { freq: 98, time: beat * 14 },
    ];

    bassNotes.forEach(note => {
      this._scheduleBassNote(note.freq, note.time, beat * 1.5, vol * 0.4);
    });

    // 루프 반복
    const loopDuration = totalTime * 1000;
    this.bgmInterval = setTimeout(() => {
      this._playLobbyLoop();
    }, loopDuration);
  }

  _schedulePadNote(freq, startOffset, duration, vol) {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // 부드러운 페이드 인/아웃
    gain.gain.setValueAtTime(0, now + startOffset);
    gain.gain.linearRampToValueAtTime(vol, now + startOffset + 0.3);
    gain.gain.setValueAtTime(vol, now + startOffset + duration - 0.4);
    gain.gain.linearRampToValueAtTime(0, now + startOffset + duration);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration);
    this.bgmNodes.push(osc);
  }

  _scheduleArpNote(freq, startOffset, duration, vol) {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(vol, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.05);
    this.bgmNodes.push(osc);
  }

  _scheduleBassNote(freq, startOffset, duration, vol) {
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(vol, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.05);
    this.bgmNodes.push(osc);
  }

  // ===== 효과음 =====

  // 기본 톤 재생
  playTone(frequency, duration, type = 'sine', volumeMultiplier = 1) {
    if (!this.sfxEnabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    const vol = this.volume * volumeMultiplier;
    gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // 정답 효과음 (상승하는 음)
  playCorrect() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(523.25, 0.1);  // C5
    setTimeout(() => this.playTone(659.25, 0.1), 80);  // E5
    setTimeout(() => this.playTone(783.99, 0.15), 160);  // G5
  }

  // 오답 효과음 (불쾌한 불협화음 + 하강)
  playWrong() {
    if (!this.sfxEnabled) return;
    this.init();

    // 불협화음 두 음 동시 재생
    this.playTone(311.13, 0.12, 'sawtooth', 0.35);  // Eb4
    this.playTone(293.66, 0.12, 'square', 0.15);    // D4 (반음 차이 → 불협)
    // 급하강
    setTimeout(() => {
      this.playTone(233.08, 0.15, 'sawtooth', 0.3);  // Bb3
      this.playTone(220.00, 0.15, 'square', 0.12);   // A3
    }, 120);
    // 마무리 저음
    setTimeout(() => {
      this.playTone(146.83, 0.25, 'sawtooth', 0.25); // D3
    }, 250);
  }

  // 버튼 클릭
  playClick() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(800, 0.05, 'sine', 0.3);
  }

  // 아이템 드랍 (반짝이는 소리)
  playItemDrop(rarity = 'normal') {
    if (!this.sfxEnabled) return;
    this.init();

    const frequencies = {
      normal: [600, 800, 1000],
      rare: [700, 900, 1100, 1300],
      epic: [800, 1000, 1200, 1400, 1600],
      legendary: [500, 700, 900, 1100, 1300, 1500, 1700]
    };

    const freqs = frequencies[rarity] || frequencies.normal;
    freqs.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.4), i * 60);
    });
  }

  // 콤보 (콤보 수에 따라 음 높아짐)
  playCombo(comboCount) {
    if (!this.sfxEnabled) return;
    this.init();

    const baseFreq = 400 + Math.min(comboCount, 10) * 50;
    this.playTone(baseFreq, 0.08);
    setTimeout(() => this.playTone(baseFreq * 1.25, 0.1), 50);
  }

  // 타이머 경고 (10초 이하)
  playTimerWarning() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(440, 0.1, 'square', 0.2);
  }

  // 몬스터 처치
  playMonsterDefeat() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(200, 0.1, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(250, 0.1, 'sawtooth', 0.3), 50);
    setTimeout(() => this.playTone(300, 0.15, 'sawtooth', 0.3), 100);
  }

  // 보스 등장
  playBossAppear() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(150, 0.3, 'sawtooth', 0.4);
    setTimeout(() => this.playTone(100, 0.4, 'sawtooth', 0.5), 200);
  }

  // 레벨업
  playLevelUp() {
    if (!this.sfxEnabled) return;
    this.init();

    const notes = [523.25, 659.25, 783.99, 1046.50];  // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15), i * 100);
    });
  }

  // 게임 오버
  playGameOver() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(392, 0.3, 'triangle', 0.4);  // G4
    setTimeout(() => this.playTone(349.23, 0.3, 'triangle', 0.4), 300);  // F4
    setTimeout(() => this.playTone(329.63, 0.3, 'triangle', 0.4), 600);  // E4
    setTimeout(() => this.playTone(293.66, 0.5, 'triangle', 0.4), 900);  // D4
  }

  // 클리어
  playClear() {
    if (!this.sfxEnabled) return;
    this.init();

    const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.50];
    melody.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12), i * 80);
    });
  }

  // 던전 시작
  playDungeonStart() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(220, 0.15, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(330, 0.15, 'sawtooth', 0.3), 100);
    setTimeout(() => this.playTone(440, 0.2, 'sawtooth', 0.3), 200);
  }

  // 사진 촬영
  playCapture() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(1200, 0.05, 'sine', 0.3);
    setTimeout(() => this.playTone(800, 0.08, 'sine', 0.2), 50);
  }

  // 힌트 사용
  playHint() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(880, 0.1, 'sine', 0.3);
    setTimeout(() => this.playTone(1100, 0.15, 'sine', 0.3), 100);
  }

  // 골드 획득
  playGold() {
    if (!this.sfxEnabled) return;
    this.init();

    this.playTone(1318.51, 0.05);  // E6
    setTimeout(() => this.playTone(1567.98, 0.08), 50);  // G6
  }

  // 진동 (모바일)
  vibrate(pattern = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // 정답 + 진동
  playCorrectWithVibrate() {
    this.playCorrect();
    this.vibrate(50);
  }

  // 오답 + 진동
  playWrongWithVibrate() {
    this.playWrong();
    this.vibrate([50, 30, 50]);
  }
}

export const SoundService = new SoundServiceClass();
