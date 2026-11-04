const textInput = document.getElementById('textInput');
const repeatCountInput = document.getElementById('repeatCount');
const languageSelect = document.getElementById('language');
const loopForeverCheckbox = document.getElementById('loopForever');
const previewText = document.getElementById('previewText');
const speakBtn = document.getElementById('speakBtn');
const stopBtn = document.getElementById('stopBtn');

let loopState = false;
let activeLoopTimer = null;

function getSentences(inputText) {
  const trimmed = inputText.trim();
  if (!trimmed) return [''];

  const sentences = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return sentences.length ? sentences : [trimmed];
}

function getVoiceForLanguage(languageCode) {
  const voices = window.speechSynthesis.getVoices();
  const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === languageCode.toLowerCase());
  if (exactMatch) return exactMatch;

  return voices.find((voice) => voice.lang.toLowerCase().startsWith(languageCode.slice(0, 2))) || voices[0];
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

function speakText(textToSpeak, languageCode) {
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = languageCode;
  utterance.voice = getVoiceForLanguage(languageCode);
  utterance.rate = 1;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function speakQueuedSequence(items, languageCode) {
  if (!items.length) return;

  const queue = [...items];

  const playNext = () => {
    if (!queue.length) return;

    const item = queue.shift();
    const utterance = new SpeechSynthesisUtterance(item);
    utterance.lang = languageCode;
    utterance.voice = getVoiceForLanguage(languageCode);
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.volume = 1;

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
    utterance.lang = languageCode;
    utterance.voice = getVoiceForLanguage(languageCode);
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.volume = 1;

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

speakBtn.addEventListener('click', handleSpeak);
stopBtn.addEventListener('click', () => {
  stopSpeaking();
  previewText.textContent = 'Speaking stopped.';
});

window.addEventListener('load', () => {
  window.speechSynthesis.onvoiceschanged = () => {
    updatePreview();
  };
  updatePreview();
});
