const textInput = document.getElementById('textInput');
const repeatCountInput = document.getElementById('repeatCount');
const languageSelect = document.getElementById('language');
const loopForeverCheckbox = document.getElementById('loopForever');
const previewText = document.getElementById('previewText');
const speakBtn = document.getElementById('speakBtn');
const stopBtn = document.getElementById('stopBtn');
const voiceStyleSelect = document.getElementById('voiceStyle');
const voiceSelect = document.getElementById('voiceSelect');

let loopState = false;
let activeLoopTimer = null;

const voiceProfiles = {
  radio: { rate: 0.92, pitch: 1.25, volume: 1 },
  warm: { rate: 0.9, pitch: 1.12, volume: 1 },
  deep: { rate: 0.82, pitch: 0.9, volume: 0.98 },
  clear: { rate: 1, pitch: 1.05, volume: 1 }
};

function getSentences(inputText) {
  const trimmed = inputText.trim();
  if (!trimmed) return [''];

  const sentences = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return sentences.length ? sentences : [trimmed];
}

function getAvailableVoices() {
  return window.speechSynthesis.getVoices();
}

function getVoiceMetadata(voice) {
  const name = (voice?.name || '').toLowerCase();
  const lang = (voice?.lang || '').toLowerCase();

  if (name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('aria') || name.includes('jenny')) {
    return 'female';
  }

  if (name.includes('male') || name.includes('david') || name.includes('mark') || name.includes('daniel') || name.includes('ravi')) {
    return 'male';
  }

  if (lang.includes('en') && name.includes('google')) {
    return 'female';
  }

  return 'neutral';
}

function getVoiceForLanguage(languageCode, preferredStyle = voiceStyleSelect.value) {
  const voices = getAvailableVoices();
  const selectedVoiceName = voiceSelect.value;

  if (selectedVoiceName && selectedVoiceName !== 'auto') {
    return voices.find((voice) => voice.name === selectedVoiceName) || voices[0];
  }

  const targetLang = languageCode.toLowerCase();
  const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === targetLang);
  if (exactMatch) {
    const preferred = voices.filter((voice) => {
      const voiceType = getVoiceMetadata(voice);
      const style = preferredStyle || 'radio';
      if (style === 'deep') return voiceType === 'male';
      if (style === 'warm' || style === 'radio') return voiceType !== 'male';
      return true;
    }).find((voice) => voice.lang.toLowerCase() === targetLang);

    if (preferred) return preferred;
    return exactMatch;
  }

  const sameFamily = voices.filter((voice) => voice.lang.toLowerCase().startsWith(targetLang.slice(0, 2)));
  const preferred = sameFamily.find((voice) => {
    const voiceType = getVoiceMetadata(voice);
    if (preferredStyle === 'deep') return voiceType === 'male';
    if (preferredStyle === 'warm' || preferredStyle === 'radio') return voiceType !== 'male';
    return true;
  });

  return preferred || sameFamily[0] || voices[0];
}

function populateVoiceList() {
  const voices = getAvailableVoices();
  if (!voices.length) return;

  const currentValue = voiceSelect.value || 'auto';
  voiceSelect.innerHTML = '<option value="auto">Auto pick best voice</option>';

  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });

  if (voices.some((voice) => voice.name === currentValue)) {
    voiceSelect.value = currentValue;
  }
}

function applyVoiceProfile(utterance, languageCode) {
  const profile = voiceProfiles[voiceStyleSelect.value] || voiceProfiles.radio;
  const chosenVoice = getVoiceForLanguage(languageCode, voiceStyleSelect.value);

  utterance.lang = languageCode;
  utterance.voice = chosenVoice;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = profile.volume;
}

function updatePreview() {
  const rawText = textInput.value.trim();
  if (!rawText) {
    previewText.textContent = 'Please enter some text.';
    return;
  }

  const repeatCount = Math.max(1, Number(repeatCountInput.value) || 1);
  const sentences = getSentences(rawText);
  const blocks = sentences.map((sentence) => {
    const repeated = Array.from({ length: repeatCount }, () => sentence).join(' ');
    return repeated;
  });

  const preview = loopForeverCheckbox.checked ? `${blocks.join(' | ')} ... (looping forever)` : blocks.join(' | ');
  previewText.textContent = preview;
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
  loopState = false;
  if (activeLoopTimer) {
    clearTimeout(activeLoopTimer);
    activeLoopTimer = null;
  }
}

function speakQueuedSequence(items, languageCode) {
  if (!items.length) return;

  const queue = [...items];

  const playNext = () => {
    if (!queue.length) return;

    const item = queue.shift();
    const utterance = new SpeechSynthesisUtterance(item);
    applyVoiceProfile(utterance, languageCode);

    utterance.onend = () => {
      if (queue.length > 0) {
        playNext();
      }
    };

    utterance.onerror = () => {
      if (queue.length > 0) {
        playNext();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  playNext();
}

function speakInLoop(languageCode) {
  const rawText = textInput.value.trim();
  if (!rawText) return;

  const sentences = getSentences(rawText);
  let sentenceIndex = 0;
  loopState = true;

  const speakNextSentence = () => {
    if (!loopState) return;

    const sentence = sentences[sentenceIndex % sentences.length];
    const repeatCount = Math.max(1, Number(repeatCountInput.value) || 1);
    const repeatedText = Array.from({ length: repeatCount }, () => sentence).join(' ');

    const utterance = new SpeechSynthesisUtterance(repeatedText);
    applyVoiceProfile(utterance, languageCode);

    utterance.onend = () => {
      sentenceIndex += 1;
      if (loopState) {
        activeLoopTimer = setTimeout(speakNextSentence, 250);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNextSentence();
}

function handleSpeak() {
  stopSpeaking();

  const rawText = textInput.value.trim();
  if (!rawText) {
    previewText.textContent = 'Please enter some text before speaking.';
    return;
  }

  const languageCode = languageSelect.value;
  const repeatCount = Math.max(1, Number(repeatCountInput.value) || 1);
  const sentences = getSentences(rawText);

  if (loopForeverCheckbox.checked) {
    speakInLoop(languageCode);
    return;
  }

  const speechItems = sentences.map((sentence) => Array.from({ length: repeatCount }, () => sentence).join(' '));
  speakQueuedSequence(speechItems, languageCode);
}

textInput.addEventListener('input', updatePreview);
repeatCountInput.addEventListener('input', updatePreview);
loopForeverCheckbox.addEventListener('change', updatePreview);
languageSelect.addEventListener('change', updatePreview);
voiceStyleSelect.addEventListener('change', updatePreview);
voiceSelect.addEventListener('change', updatePreview);

speakBtn.addEventListener('click', handleSpeak);
stopBtn.addEventListener('click', () => {
  stopSpeaking();
  previewText.textContent = 'Speaking stopped.';
});

window.addEventListener('load', () => {
  const syncVoices = () => {
    populateVoiceList();
    updatePreview();
  };

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = syncVoices;
    syncVoices();
  }
});
