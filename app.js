/**
 * Sign Bridge - Assistive Voice-to-Text for Deaf Individuals
 * Features:
 * - Top Mic ON / OFF toggle button (instant mute/unmute control)
 * - Automatic speech recognition with continuous auto-restart watchdog
 * - Studio-grade audio filtering (Echo cancellation, Noise suppression, Auto gain)
 * - Real-time Voice Clarity & Signal Quality Meter
 * - Interactive Guide for Deaf Individuals
 * - Smart punctuation and sentence capitalization
 * - Maximized Big Screen captions for deaf individuals reading on mobile/desktop
 * - Real-time visual audio waveform & peripheral sound pulse
 * - Fullscreen presentation mode
 * - Persistent conversation history log
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  isMicActive: true,
  recognition: null,
  recognitionRunning: false,
  finalTranscript: '',
  interimTranscript: '',
  language: 'en-US',
  fontSize: 'font-large',

  // Audio Visualizer & Clarity Analysis
  audioContext: null,
  analyser: null,
  audioSource: null,
  audioStream: null,
  visualizerAnimationId: null,

  // Conversation History & Timers
  messages: [],
  restartTimeout: null,
  watchdogInterval: null
};

// ============================================================================
// DOM Elements
// ============================================================================
const elements = {
  soundAlertOverlay: document.getElementById('soundAlertOverlay'),
  gestureStartOverlay: document.getElementById('gestureStartOverlay'),
  gestureStartBtn: document.getElementById('gestureStartBtn'),

  // Deaf Guide Modal
  deafGuideModal: document.getElementById('deafGuideModal'),
  deafGuideBtn: document.getElementById('deafGuideBtn'),
  closeDeafGuideBtn: document.getElementById('closeDeafGuideBtn'),
  deafGuideGotItBtn: document.getElementById('deafGuideGotItBtn'),

  // Header controls
  headerMicToggleBtn: document.getElementById('headerMicToggleBtn'),
  headerMicIcon: document.getElementById('headerMicIcon'),
  headerMicLabel: document.getElementById('headerMicLabel'),
  fontSizeSelector: document.getElementById('fontSizeSelector'),
  langSelector: document.getElementById('langSelector'),
  historyDrawerBtn: document.getElementById('historyDrawerBtn'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  fullscreenToggleBtn: document.getElementById('fullscreenToggleBtn'),

  // Billboard
  billboardCard: document.getElementById('billboardCard'),
  liveDot: document.getElementById('liveDot'),
  liveStatusText: document.getElementById('liveStatusText'),
  clarityMeter: document.getElementById('clarityMeter'),
  clarityBars: document.querySelectorAll('.c-bar'),
  clarityLabel: document.getElementById('clarityLabel'),
  copyTranscriptBtn: document.getElementById('copyTranscriptBtn'),
  clearCurrentBtn: document.getElementById('clearCurrentBtn'),
  liveTextContainer: document.getElementById('liveTextContainer'),
  liveTextPlaceholder: document.getElementById('liveTextPlaceholder'),
  transcriptStream: document.getElementById('transcriptStream'),
  finalTranscriptText: document.getElementById('finalTranscriptText'),
  interimTranscriptText: document.getElementById('interimTranscriptText'),

  // Live Monitor Footer
  audioVisualizer: document.getElementById('audioVisualizer'),
  monitorStatusLabel: document.getElementById('monitorStatusLabel'),

  // History Drawer
  historyDrawer: document.getElementById('historyDrawer'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  chatLogContainer: document.getElementById('chatLogContainer'),
  emptyChatState: document.getElementById('emptyChatState'),
  exportLogBtn: document.getElementById('exportLogBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // Fullscreen Presentation Mode
  presentationOverlay: document.getElementById('presentationOverlay'),
  presClearBtn: document.getElementById('presClearBtn'),
  exitPresentationBtn: document.getElementById('exitPresentationBtn'),
  presFinalText: document.getElementById('presFinalText'),
  presInterimText: document.getElementById('presInterimText'),

  // Toast
  toastNotification: document.getElementById('toastNotification')
};

// ============================================================================
// Toast Notification
// ============================================================================
let toastTimeout = null;
function showToast(message, duration = 3000) {
  if (!elements.toastNotification) return;
  elements.toastNotification.textContent = message;
  elements.toastNotification.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toastNotification.classList.remove('show');
  }, duration);
}

// ============================================================================
// Visual Sound Pulse (Peripheral Visual Cue for Deaf Individual)
// ============================================================================
function triggerVisualSoundPulse() {
  if (!elements.soundAlertOverlay) return;
  elements.soundAlertOverlay.classList.add('flash-active');
  setTimeout(() => {
    elements.soundAlertOverlay.classList.remove('flash-active');
  }, 400);
}

// ============================================================================
// Smart Punctuation & Capitalization Engine
// ============================================================================
function formatSentence(rawText) {
  if (!rawText) return '';
  let str = rawText.trim();
  if (str.length === 0) return '';

  // Capitalize first character
  str = str.charAt(0).toUpperCase() + str.slice(1);

  // Check if string already ends with punctuation
  const lastChar = str.slice(-1);
  if (['.', '!', '?', ',', ':'].includes(lastChar)) {
    return str;
  }

  // Detect common question starters for auto-question mark
  const lower = str.toLowerCase();
  const questionStarters = ['who ', 'what ', 'where ', 'when ', 'why ', 'how ', 'can you', 'could you', 'would you', 'is it', 'are you', 'do you', 'did you'];
  const isQuestion = questionStarters.some(starter => lower.startsWith(starter));

  return isQuestion ? str + '?' : str + '.';
}

// ============================================================================
// Automatic Speech Recognition Engine (Web Speech API)
// ============================================================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Speech Recognition not supported in this browser. Please use Chrome or Edge.', 8000);
    if (elements.liveStatusText) {
      elements.liveStatusText.textContent = 'Speech Recognition Not Supported (Use Chrome/Edge)';
    }
    return false;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = state.language;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionRunning = true;
    if (state.isMicActive) {
      updateMonitorUI(true, 'Voice Detection: Active â€¢ Ready');
    }
    if (elements.gestureStartOverlay) {
      elements.gestureStartOverlay.style.display = 'none';
    }
  };

  recognition.onspeechstart = () => {
    if (state.isMicActive) {
      updateMonitorUI(true, 'ðŸ—£ï¸ Hearing Speaker is Talking...');
      triggerVisualSoundPulse();
    }
  };

  recognition.onspeechend = () => {
    if (state.isMicActive) {
      updateMonitorUI(true, 'Voice Detection: Active â€¢ Ready');
    }
  };

  recognition.onresult = (event) => {
    if (!state.isMicActive) return;

    let interim = '';
    let newlyFinalized = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptSegment = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        newlyFinalized += transcriptSegment;
      } else {
        interim += transcriptSegment;
      }
    }

    if (newlyFinalized.trim().length > 0) {
      const cleanFinal = formatSentence(newlyFinalized);
      state.finalTranscript = (state.finalTranscript + ' ' + cleanFinal).trim();

      // Log to conversation history
      addHistoryItem('Hearing Speaker', cleanFinal);
      triggerVisualSoundPulse();
    }

    state.interimTranscript = interim;
    renderTranscripts();
  };

  recognition.onerror = (event) => {
    console.warn('[Sign Bridge] Speech recognition error event:', event.error);
    if (event.error === 'not-allowed') {
      if (elements.gestureStartOverlay) {
        elements.gestureStartOverlay.style.display = 'flex';
      }
      showToast('Please allow microphone access to enable automatic captions.', 6000);
      state.recognitionRunning = false;
    } else if (event.error === 'no-speech') {
      if (state.isMicActive) scheduleAutoRestart(100);
    } else if (event.error === 'network') {
      if (state.isMicActive) scheduleAutoRestart(1000);
    }
  };

  recognition.onend = () => {
    state.recognitionRunning = false;
    // Auto-restart continuously only if mic is active
    if (state.isMicActive) {
      scheduleAutoRestart(150);
    }
  };

  state.recognition = recognition;
  return true;
}

function scheduleAutoRestart(delay = 150) {
  clearTimeout(state.restartTimeout);
  state.restartTimeout = setTimeout(() => {
    if (state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
  }, delay);
}

function startListening() {
  if (!state.isMicActive) return;
  if (!state.recognition && !initSpeechRecognition()) return;

  try {
    state.recognition.lang = state.language;
    state.recognition.start();
    initAudioVisualizer();
  } catch (error) {
    if (error.name === 'InvalidStateError') {
      state.recognitionRunning = true;
    } else {
      console.warn('[Sign Bridge] startListening notice:', error.message);
    }
  }
}

function stopListening() {
  clearTimeout(state.restartTimeout);
  state.recognitionRunning = false;
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) { }
  }
}

// Watchdog to ensure speech recognition stays alive when Mic is ON
function startWatchdog() {
  if (state.watchdogInterval) clearInterval(state.watchdogInterval);
  state.watchdogInterval = setInterval(() => {
    if (state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
  }, 2500);
}

// ============================================================================
// Top Mic ON / OFF Toggle Action
// ============================================================================
function toggleMicrophone() {
  state.isMicActive = !state.isMicActive;

  if (state.isMicActive) {
    // Turn Mic ON
    elements.headerMicToggleBtn.classList.remove('is-muted');
    elements.headerMicToggleBtn.classList.add('is-active');
    elements.headerMicLabel.textContent = 'Mic ON';
    elements.headerMicToggleBtn.setAttribute('title', 'Click to Turn Off / Mute Microphone');
    elements.headerMicIcon.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    `;
    updateMonitorUI(true, 'Voice Detection: Active â€¢ Ready');
    startListening();
    showToast('Microphone ON â€¢ Ready for speech');
  } else {
    // Turn Mic OFF (Mute)
    stopListening();
    elements.headerMicToggleBtn.classList.remove('is-active');
    elements.headerMicToggleBtn.classList.add('is-muted');
    elements.headerMicLabel.textContent = 'Mic OFF';
    elements.headerMicToggleBtn.setAttribute('title', 'Microphone is OFF. Click to Turn ON.');
    // Muted mic icon with slash
    elements.headerMicIcon.innerHTML = `
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    `;
    elements.liveStatusText.textContent = 'ðŸ”‡ Microphone Paused (Click "Mic OFF" above to resume)';
    elements.liveDot.classList.remove('active');
    elements.billboardCard.classList.remove('is-listening');
    elements.monitorStatusLabel.textContent = 'Voice Detection: Paused';
    updateClarityMeter(0);
    showToast('Microphone Paused (Turned OFF)');
  }
}

function updateMonitorUI(isActive, statusMsg) {
  if (elements.liveDot) {
    elements.liveDot.classList.toggle('active', isActive && state.isMicActive);
  }
  if (elements.billboardCard) {
    elements.billboardCard.classList.toggle('is-listening', isActive && state.isMicActive);
  }
  if (elements.liveStatusText) {
    if (!state.isMicActive) {
      elements.liveStatusText.textContent = 'ðŸ”‡ Microphone Paused (Click "Mic OFF" above to resume)';
    } else {
      elements.liveStatusText.textContent = isActive
        ? (statusMsg.includes('Talking') ? 'ðŸ—£ï¸ Hearing speaker is speaking...' : 'Listening automatically... Ready for speech')
        : 'Connecting microphone...';
    }
  }
  if (elements.monitorStatusLabel) {
    elements.monitorStatusLabel.textContent = state.isMicActive ? statusMsg : 'Voice Detection: Paused';
  }
}

function renderTranscripts() {
  const hasText = state.finalTranscript.length > 0 || state.interimTranscript.length > 0;

  if (hasText) {
    elements.liveTextPlaceholder.style.display = 'none';
    elements.transcriptStream.style.display = 'block';

    elements.finalTranscriptText.textContent = state.finalTranscript ? state.finalTranscript + ' ' : '';
    elements.interimTranscriptText.textContent = state.interimTranscript;

    // Fullscreen presentation view mirror
    elements.presFinalText.textContent = state.finalTranscript ? state.finalTranscript + ' ' : '';
    elements.presInterimText.textContent = state.interimTranscript;

    // Auto-scroll display to bottom smoothly so newest words are front and center
    elements.liveTextContainer.scrollTop = elements.liveTextContainer.scrollHeight;
  } else {
    elements.liveTextPlaceholder.style.display = 'flex';
    elements.transcriptStream.style.display = 'none';
    elements.presFinalText.textContent = 'Listening... Spoken voice will appear here automatically.';
    elements.presInterimText.textContent = '';
  }
}

function clearCurrentBillboard() {
  if (!state.finalTranscript && !state.interimTranscript) {
    showToast('Screen is already clear');
    return;
  }
  state.finalTranscript = '';
  state.interimTranscript = '';
  renderTranscripts();
  showToast('Screen cleared. Ready for next conversation.');
}

function copyTranscriptToClipboard() {
  const fullText = (state.finalTranscript + ' ' + state.interimTranscript).trim();
  if (!fullText) {
    showToast('Nothing to copy yet.');
    return;
  }

  navigator.clipboard.writeText(fullText).then(() => {
    showToast('Copied captions to clipboard!');
  }).catch(() => {
    showToast('Unable to copy to clipboard.');
  });
}

// ============================================================================
// Studio-Grade Microphone Audio Filtering & Visualizer
// ============================================================================
async function initAudioVisualizer() {
  try {
    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }

    // High clarity audio constraints with hardware noise suppression
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000
    };

    if (!state.audioStream) {
      state.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
    }

    if (!state.analyser) {
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 64;
      state.analyser.smoothingTimeConstant = 0.82;
    }

    if (state.audioSource) {
      state.audioSource.disconnect();
    }
    state.audioSource = state.audioContext.createMediaStreamSource(state.audioStream);
    state.audioSource.connect(state.analyser);

    drawVisualizer();
  } catch (error) {
    console.warn('Audio Visualizer setup note:', error);
  }
}

function updateClarityMeter(activeLevel) {
  if (!state.isMicActive) {
    elements.clarityBars.forEach(bar => bar.className = 'c-bar');
    elements.clarityLabel.textContent = 'Muted';
    elements.clarityLabel.style.color = 'var(--text-muted)';
    return;
  }

  elements.clarityBars.forEach((bar, idx) => {
    bar.className = 'c-bar';
    if (idx < activeLevel) {
      if (activeLevel === 1) {
        bar.classList.add('level-low');
      } else if (activeLevel === 4) {
        bar.classList.add('level-loud');
      } else {
        bar.classList.add('level-good');
      }
    }
  });

  if (activeLevel === 0) {
    elements.clarityLabel.textContent = 'Listening';
    elements.clarityLabel.style.color = 'var(--text-muted)';
  } else if (activeLevel === 1) {
    elements.clarityLabel.textContent = 'Quiet (Speak Closer)';
    elements.clarityLabel.style.color = 'var(--accent-amber)';
  } else if (activeLevel === 2 || activeLevel === 3) {
    elements.clarityLabel.textContent = 'Clear & Strong';
    elements.clarityLabel.style.color = 'var(--accent-emerald)';
  } else {
    elements.clarityLabel.textContent = 'Very Loud';
    elements.clarityLabel.style.color = 'var(--accent-rose)';
  }
}

function resizeVisualizerCanvas() {
  const canvas = elements.audioVisualizer;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0) {
    canvas.width = Math.floor(rect.width * window.devicePixelRatio || rect.width);
    canvas.height = 44 * (window.devicePixelRatio || 1);
  }
}

function drawVisualizer() {
  resizeVisualizerCanvas();
  const canvas = elements.audioVisualizer;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const bufferLength = state.analyser ? state.analyser.frequencyBinCount : 32;
  const dataArray = new Uint8Array(bufferLength);

  let phase = 0;

  function renderFrame() {
    state.visualizerAnimationId = requestAnimationFrame(renderFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let sum = 0;
    if (state.analyser && state.isMicActive) {
      state.analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
    }

    const rms = state.isMicActive ? Math.sqrt(sum / bufferLength) : 0;

    // Update Clarity & Volume Meter
    if (!state.isMicActive) {
      updateClarityMeter(0);
    } else if (rms < 8) {
      updateClarityMeter(0);
    } else if (rms < 24) {
      updateClarityMeter(1);
    } else if (rms < 75) {
      updateClarityMeter(2);
    } else if (rms < 140) {
      updateClarityMeter(3);
    } else {
      updateClarityMeter(4);
    }

    const hasSoundActivity = state.isMicActive && rms >= 10;

    if (!hasSoundActivity) {
      // Gentle breathing idle wave
      phase += 0.04;
      for (let i = 0; i < bufferLength; i++) {
        dataArray[i] = Math.max(5, Math.sin(phase + i * 0.25) * 8 + 10);
      }
    }

    const barWidth = (canvas.width / bufferLength) * 0.92;
    let x = (canvas.width - (barWidth * bufferLength)) / 2;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = Math.max(3, (dataArray[i] / 255) * (canvas.height - 8));

      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      if (hasSoundActivity) {
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(0.5, '#06b6d4');
        gradient.addColorStop(1, '#10b981');
      } else {
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.15)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, canvas.height - barHeight, barWidth - 3, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      x += barWidth;
    }
  }

  if (state.visualizerAnimationId) {
    cancelAnimationFrame(state.visualizerAnimationId);
  }
  renderFrame();
}

// ============================================================================
// Conversation History Drawer
// ============================================================================
function addHistoryItem(speaker, text) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const item = { speaker, text, timestamp };
  state.messages.push(item);

  if (elements.historyCountBadge) {
    elements.historyCountBadge.textContent = state.messages.length;
  }

  if (elements.emptyChatState) {
    elements.emptyChatState.style.display = 'none';
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="bubble-speaker">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
        ${escapeHTML(speaker)}
      </span>
      <span class="bubble-time">${timestamp}</span>
    </div>
    <div class="bubble-text">${escapeHTML(text)}</div>
  `;

  elements.chatLogContainer.appendChild(bubble);
  elements.chatLogContainer.scrollTop = elements.chatLogContainer.scrollHeight;
}

function clearHistory() {
  state.messages = [];
  if (elements.historyCountBadge) elements.historyCountBadge.textContent = '0';
  elements.chatLogContainer.innerHTML = '';
  if (elements.emptyChatState) {
    elements.chatLogContainer.appendChild(elements.emptyChatState);
    elements.emptyChatState.style.display = 'block';
  }
  showToast('Conversation history cleared');
}

function exportHistory() {
  if (state.messages.length === 0) {
    showToast('No history messages to save yet.');
    return;
  }

  let content = `Sign Bridge - Voice to Text Transcript\nDate: ${new Date().toLocaleString()}\n`;
  content += `========================================================\n\n`;

  state.messages.forEach(m => {
    content += `[${m.timestamp}] ${m.speaker}: ${m.text}\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sign_bridge_captions_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Transcript downloaded successfully!');
}

function toggleHistoryDrawer() {
  elements.historyDrawer.classList.toggle('open');
}

function closeHistoryDrawer() {
  elements.historyDrawer.classList.remove('open');
}

// ============================================================================
// Fullscreen Big Screen Presentation Mode
// ============================================================================
function enterPresentationMode() {
  elements.presentationOverlay.style.display = 'flex';
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => { });
  }
}

function exitPresentationMode() {
  elements.presentationOverlay.style.display = 'none';
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => { });
  }
}

// ============================================================================
// Helper Utilities
// ============================================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// Event Listeners & Auto-Start
// ============================================================================
function setupEventListeners() {
  // Top Mic ON / OFF toggle button
  if (elements.headerMicToggleBtn) {
    elements.headerMicToggleBtn.addEventListener('click', toggleMicrophone);
  }

  // Billboard actions
  elements.clearCurrentBtn.addEventListener('click', clearCurrentBillboard);
  elements.copyTranscriptBtn.addEventListener('click', copyTranscriptToClipboard);

  if (elements.presClearBtn) {
    elements.presClearBtn.addEventListener('click', clearCurrentBillboard);
  }

  // Window resize & orientation change for responsive visualizer canvas
  window.addEventListener('resize', resizeVisualizerCanvas);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeVisualizerCanvas, 150);
  });

  // Guide for Deaf People Modal
  if (elements.deafGuideBtn) {
    elements.deafGuideBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'flex';
    });
  }
  if (elements.closeDeafGuideBtn) {
    elements.closeDeafGuideBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'none';
    });
  }
  if (elements.deafGuideGotItBtn) {
    elements.deafGuideGotItBtn.addEventListener('click', () => {
      elements.deafGuideModal.style.display = 'none';
    });
  }

  // Close modal when clicking on dark backdrop
  if (elements.deafGuideModal) {
    elements.deafGuideModal.addEventListener('click', (e) => {
      if (e.target === elements.deafGuideModal) {
        elements.deafGuideModal.style.display = 'none';
      }
    });
  }

  // Language selector
  elements.langSelector.addEventListener('change', (e) => {
    state.language = e.target.value;
    if (state.recognition) {
      state.recognition.lang = state.language;
      try {
        state.recognition.stop();
      } catch (err) { }
    }
    showToast(`Speech language set to: ${e.target.selectedOptions[0].text}`);
  });

  // Font size selector
  elements.fontSizeSelector.addEventListener('change', (e) => {
    state.fontSize = e.target.value;
    elements.liveTextContainer.className = `caption-display-area ${state.fontSize}`;
    showToast(`Text size: ${e.target.selectedOptions[0].text}`);
  });

  // History drawer
  elements.historyDrawerBtn.addEventListener('click', toggleHistoryDrawer);
  elements.closeDrawerBtn.addEventListener('click', closeHistoryDrawer);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  elements.exportLogBtn.addEventListener('click', exportHistory);

  // Presentation mode
  elements.fullscreenToggleBtn.addEventListener('click', enterPresentationMode);
  elements.exitPresentationBtn.addEventListener('click', exitPresentationMode);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.presentationOverlay.style.display === 'flex') {
      exitPresentationMode();
    }
  });

  // Gesture activation overlay trigger
  if (elements.gestureStartBtn) {
    elements.gestureStartBtn.addEventListener('click', () => {
      elements.gestureStartOverlay.style.display = 'none';
      startListening();
    });
  }

  // Activate on first gesture if required by browser autoplay policies
  const activateOnFirstGesture = () => {
    if (state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
    document.removeEventListener('click', activateOnFirstGesture);
    document.removeEventListener('touchstart', activateOnFirstGesture);
  };
  document.addEventListener('click', activateOnFirstGesture, { once: true });
  document.addEventListener('touchstart', activateOnFirstGesture, { once: true });

  // Handle visibility change (reconnect if user switched apps or opened phone screen)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.isMicActive && !state.recognitionRunning) {
      startListening();
    }
  });
}

// ============================================================================
// Front Page: SignBridge by Connectiva Technologies
// ============================================================================
function initFrontPageModule() {
  const frontPageView = document.getElementById('frontPageView');
  const liveAppView = document.getElementById('liveAppView');

  const showFrontPage = () => {
    if (frontPageView && liveAppView) {
      frontPageView.style.display = 'flex';
      liveAppView.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const showLiveApp = () => {
    if (frontPageView && liveAppView) {
      frontPageView.style.display = 'none';
      liveAppView.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Start listening and audio visualizer
      if (state.isMicActive && !state.recognitionRunning) {
        startListening();
      }
      showToast('SignBridge Live System Started â€¢ Listening for speech...', 4000);
    }
  };

  // Start Buttons (Hero, Nav, Prototype Card, Footer)
  const startBtns = [
    document.getElementById('frontPageStartBtn'),
    document.getElementById('frontNavStartBtn'),
    document.getElementById('protoStartAppBtn'),
    document.getElementById('footerStartBtn')
  ];

  startBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', showLiveApp);
  });

  // Return to Front Page Buttons
  const returnToFrontBtn = document.getElementById('returnToFrontBtn');
  if (returnToFrontBtn) {
    returnToFrontBtn.addEventListener('click', showFrontPage);
  }

  // Clicking brand logo in live app header returns to Front Page
  const appBrandBadge = document.querySelector('.app-header .brand-badge');
  if (appBrandBadge) {
    appBrandBadge.style.cursor = 'pointer';
    appBrandBadge.setAttribute('title', 'Click to Return to SignBridge Front Page');
    appBrandBadge.addEventListener('click', showFrontPage);
  }

  // Prototype Modal Controls
  const prototypeModal = document.getElementById('prototypeModal');
  const closePrototypeBtn = document.getElementById('closePrototypeBtn');
  const closePrototypeBottomBtn = document.getElementById('closePrototypeBottomBtn');

  const openPrototypeModal = () => {
    if (prototypeModal) prototypeModal.style.display = 'flex';
  };

  const closePrototypeModal = () => {
    if (prototypeModal) prototypeModal.style.display = 'none';
  };

  const protoTriggers = [
    document.getElementById('frontSeePrototypeBtn'),
    document.getElementById('frontInspectProtoBtn'),
    document.getElementById('viewPrototypeModalTrigger')
  ];

  protoTriggers.forEach(btn => {
    if (btn) btn.addEventListener('click', openPrototypeModal);
  });

  if (closePrototypeBtn) closePrototypeBtn.addEventListener('click', closePrototypeModal);
  if (closePrototypeBottomBtn) closePrototypeBottomBtn.addEventListener('click', closePrototypeModal);

  if (prototypeModal) {
    prototypeModal.addEventListener('click', (e) => {
      if (e.target === prototypeModal) closePrototypeModal();
    });
  }
}


// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initFrontPageModule();
  drawVisualizer();

  // Initialize speech recognition
  initSpeechRecognition();
  startWatchdog();
});
