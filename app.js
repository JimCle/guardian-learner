const STORAGE_KEY = "guardian-learner-state-v2";
const WORD_RE = /^[a-z][a-z'-]{1,31}$/i;
const CJK_RE = /[\u3400-\u9fff]/;
const POS_RE = /^(?:[A-Z]\s*)?(?:n|v|adj|adv|prep|pron|conj|interj|aux|num|art|vi|vt|modal|abbr)\b|^(?:[A-Z]\s*)?(?:n|v|adj|adv|prep|vi|vt)\./i;

const guardianWords = Array.isArray(window.GUARDIAN_VOCAB) && window.GUARDIAN_VOCAB.length
  ? window.GUARDIAN_VOCAB
  : [
      { word: "revolt", meaning: "n. 反抗；造反，起义 v. 起义；反抗", phonetic: "" },
      { word: "specialist", meaning: "n. 专家", phonetic: "" },
      { word: "carpet", meaning: "n. 地毯", phonetic: "" }
    ];

const guardianMeaningMap = createWordMap(guardianWords);
const truthWords = hydrateMeanings(Array.isArray(window.TRUTH_VOCAB) ? window.TRUTH_VOCAB : [], guardianMeaningMap);
const ruijiWords = hydrateMeanings(Array.isArray(window.RUIJI_VOCAB) ? window.RUIJI_VOCAB : [], guardianMeaningMap);

const builtinDictionaries = [
  {
    id: "guardian-kaoyan-english-one",
    label: "考研英一词库",
    source: "词库.docx",
    words: guardianWords
  },
  {
    id: "truth-flash-2026",
    label: "2026 真题逐年闪背",
    source: "2026考研英语一真题词汇逐年闪背.txt",
    words: truthWords
  },
  {
    id: "ruiji-core-2026",
    label: "2026 锐记核心词汇",
    source: "2026锐记考研英语核心词汇（带派生词）.csv",
    words: ruijiWords
  }
];

const dictionaryMaps = new Map(builtinDictionaries.map((dictionary) => [dictionary.id, createWordMap(dictionary.words)]));
const builtinChapters = builtinDictionaries.map((dictionary) => createBuiltinChapter(dictionary));
const builtinChapter = builtinChapters[0];
let activeExtractDictionaryId = builtinDictionaries[0].id;

function createWordMap(words) {
  const map = new Map();
  for (const entry of words) {
    const key = entry.word.toLowerCase();
    if (!map.has(key)) map.set(key, entry);
  }
  return map;
}

function hydrateMeanings(words, fallbackMap) {
  return words.map((entry) => {
    const fallback = fallbackMap.get(entry.word.toLowerCase());
    return {
      word: entry.word,
      meaning: entry.meaning || fallback?.meaning || "",
      phonetic: entry.phonetic || fallback?.phonetic || ""
    };
  });
}

function createBuiltinChapter(dictionary) {
  return {
    id: dictionary.id,
    title: dictionary.label,
    source: dictionary.source,
    builtIn: true,
    createdAt: 0,
    dictionaryId: dictionary.id,
    words: dictionary.words
  };
}

const irregularForms = new Map(Object.entries({
  arose: "arise", arisen: "arise", ate: "eat", eaten: "eat", awoke: "awake", awoken: "awake",
  was: "be", were: "be", been: "be", being: "be", bore: "bear", born: "bear", borne: "bear",
  became: "become", begun: "begin", began: "begin", bent: "bend", bound: "bind", bit: "bite", bitten: "bite",
  blew: "blow", blown: "blow", broke: "break", broken: "break", brought: "bring", built: "build",
  bought: "buy", caught: "catch", chose: "choose", chosen: "choose", came: "come", cost: "cost",
  cut: "cut", dealt: "deal", did: "do", done: "do", drew: "draw", drawn: "draw", drank: "drink", drunk: "drink",
  drove: "drive", driven: "drive", fell: "fall", fallen: "fall", fed: "feed", felt: "feel", fought: "fight",
  found: "find", fled: "flee", flew: "fly", flown: "fly", forgot: "forget", forgotten: "forget",
  froze: "freeze", frozen: "freeze", got: "get", gotten: "get", gave: "give", given: "give", went: "go", gone: "go",
  grew: "grow", grown: "grow", hung: "hang", heard: "hear", hid: "hide", hidden: "hide", held: "hold",
  kept: "keep", knew: "know", known: "know", laid: "lay", led: "lead", left: "leave", lent: "lend",
  lay: "lie", lain: "lie", lost: "lose", made: "make", meant: "mean", met: "meet", paid: "pay",
  put: "put", read: "read", rode: "ride", ridden: "ride", rang: "ring", rung: "ring", rose: "rise", risen: "rise",
  ran: "run", said: "say", saw: "see", seen: "see", sought: "seek", sold: "sell", sent: "send", set: "set",
  shook: "shake", shaken: "shake", shone: "shine", shot: "shoot", showed: "show", shown: "show",
  shut: "shut", sang: "sing", sung: "sing", sat: "sit", slept: "sleep", spoke: "speak", spoken: "speak",
  spent: "spend", stood: "stand", stole: "steal", stolen: "steal", struck: "strike", swam: "swim", swum: "swim",
  took: "take", taken: "take", taught: "teach", told: "tell", thought: "think", threw: "throw", thrown: "throw",
  understood: "understand", woke: "wake", woken: "wake", wore: "wear", worn: "wear", won: "win", wrote: "write", written: "write"
}));

const isTouchDevice = navigator.maxTouchPoints > 0 || /Android|iPad|iPhone|Mobile/i.test(navigator.userAgent);
let speakTimer = null;
let speakRequestId = 0;

const state = {
  chapters: [...builtinChapters],
  userChapters: [],
  chapterIndex: 0,
  wordIndex: 0,
  typed: "",
  wrongMap: new Set(),
  running: false,
  paused: false,
  elapsed: 0,
  timer: null,
  inputs: 0,
  correctChars: 0,
  mistakes: 0,
  completedWords: 0,
  shuffle: false,
  showMeaning: true,
  autoSpeak: true,
  autoNext: true,
  startedAt: null
};

const els = {
  dictionaryButton: document.querySelector("#dictionaryButton"),
  chapterButton: document.querySelector("#chapterButton"),
  accentButton: document.querySelector("#accentButton"),
  soundButton: document.querySelector("#soundButton"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  meaningButton: document.querySelector("#meaningButton"),
  translateButton: document.querySelector("#translateButton"),
  wordListButton: document.querySelector("#wordListButton"),
  statsButton: document.querySelector("#statsButton"),
  themeButton: document.querySelector("#themeButton"),
  keyboardButton: document.querySelector("#keyboardButton"),
  settingsButton: document.querySelector("#settingsButton"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  restartButton: document.querySelector("#restartButton"),
  drawerTab: document.querySelector("#drawerTab"),
  drawer: document.querySelector("#drawer"),
  closeDrawer: document.querySelector("#closeDrawer"),
  docUpload: document.querySelector("#docUpload"),
  pasteChapterTitle: document.querySelector("#pasteChapterTitle"),
  pasteArticleText: document.querySelector("#pasteArticleText"),
  extractPastedArticle: document.querySelector("#extractPastedArticle"),
  chapterList: document.querySelector("#chapterList"),
  nextWord: document.querySelector("#nextWord"),
  ghostWord: document.querySelector("#ghostWord"),
  wordLine: document.querySelector("#wordLine"),
  speakWord: document.querySelector("#speakWord"),
  deleteCurrentWord: document.querySelector("#deleteCurrentWord"),
  phonetic: document.querySelector("#phonetic"),
  meaning: document.querySelector("#meaning"),
  typedLine: document.querySelector("#typedLine"),
  prompt: document.querySelector("#prompt"),
  progressBar: document.querySelector("#progressBar"),
  timeStat: document.querySelector("#timeStat"),
  inputStat: document.querySelector("#inputStat"),
  wpmStat: document.querySelector("#wpmStat"),
  correctStat: document.querySelector("#correctStat"),
  accuracyStat: document.querySelector("#accuracyStat"),
  wordModal: document.querySelector("#wordModal"),
  closeWordModal: document.querySelector("#closeWordModal"),
  wordTable: document.querySelector("#wordTable"),
  settingsModal: document.querySelector("#settingsModal"),
  closeSettingsModal: document.querySelector("#closeSettingsModal"),
  autoSpeakToggle: document.querySelector("#autoSpeakToggle"),
  autoNextToggle: document.querySelector("#autoNextToggle"),
  clearDataButton: document.querySelector("#clearDataButton"),
  extractDictionarySelect: document.querySelector("#extractDictionarySelect")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) {
      state.userChapters = Array.isArray(saved.userChapters) ? saved.userChapters : [];
      syncChapters();
      activeExtractDictionaryId = saved.extractDictionaryId || builtinDictionaries[0].id;
      state.chapterIndex = Math.min(saved.chapterIndex || 0, state.chapters.length - 1);
      state.autoSpeak = saved.autoSpeak ?? true;
      state.autoNext = saved.autoNext ?? true;
      state.showMeaning = saved.showMeaning ?? true;
      state.shuffle = saved.shuffle ?? false;
      document.body.classList.toggle("light", saved.theme === "light");
      return;
    }
  } catch (error) {
    console.warn("Cannot load saved state", error);
  }
  syncChapters();
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      userChapters: state.userChapters,
      chapterIndex: state.chapterIndex,
      autoSpeak: state.autoSpeak,
      autoNext: state.autoNext,
      showMeaning: state.showMeaning,
      shuffle: state.shuffle,
      extractDictionaryId: activeExtractDictionaryId,
      theme: document.body.classList.contains("light") ? "light" : "dark"
    })
  );
}

function currentChapter() {
  return state.chapters[state.chapterIndex];
}

function currentWord() {
  return currentChapter()?.words[state.wordIndex];
}

function adjacentWord(offset) {
  const words = currentChapter()?.words || [];
  if (!words.length) return null;
  return words[(state.wordIndex + offset + words.length) % words.length];
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function render() {
  const chapter = currentChapter();
  const entry = currentWord();
  els.chapterButton.textContent = chapter ? `第 ${state.chapterIndex + 1} 章` : "第 0 章";
  renderDictionarySelect();
  els.accentButton.textContent = "英音";
  els.soundButton.classList.toggle("active", state.autoSpeak);
  els.deleteCurrentWord.hidden = !chapter || chapter.builtIn || !entry;
  els.shuffleButton.classList.toggle("active", state.shuffle);
  els.meaningButton.classList.toggle("active", !state.showMeaning);
  els.translateButton.classList.toggle("active", state.showMeaning);
  els.startButton.classList.toggle("is-running", state.running && !state.paused);
  els.startButton.textContent = state.running && !state.paused ? "Pause" : "Start";
  els.pauseButton.textContent = state.paused ? "Resume" : "Pause";
  els.autoSpeakToggle.checked = state.autoSpeak;
  els.autoNextToggle.checked = state.autoNext;

  if (!entry) {
    els.nextWord.textContent = "";
    els.ghostWord.textContent = "guardian";
    els.wordLine.textContent = "guardian";
    els.phonetic.textContent = "";
    els.meaning.textContent = "没有可练习的单词";
    els.typedLine.textContent = "";
    els.prompt.textContent = "请上传 Word 文档";
    els.progressBar.style.width = "0%";
    renderStats();
    renderChapters();
    return;
  }

  els.nextWord.textContent = "";
  els.ghostWord.textContent = entry.word;
  els.wordLine.innerHTML = buildWordHtml(entry.word);
  els.phonetic.textContent = entry.phonetic || "";
  els.meaning.textContent = state.showMeaning ? entry.meaning || "" : "";
  els.typedLine.textContent = state.typed;
  els.prompt.textContent = state.running ? (state.paused ? "已暂停" : "") : "按任意键开始";
  els.progressBar.style.width = `${Math.round(((state.wordIndex + completedFraction(entry.word)) / currentChapter().words.length) * 100)}%`;
  renderStats();
  renderChapters();
}

function buildWordHtml(word) {
  return word
    .split("")
    .map((char, index) => {
      if (state.wrongMap.has(index)) return `<span class="wrong">${escapeHtml(char)}</span>`;
      if (index < state.typed.length) return `<span class="done">${escapeHtml(char)}</span>`;
      return `<span>${escapeHtml(char)}</span>`;
    })
    .join("");
}

function completedFraction(word) {
  if (!word) return 0;
  return Math.min(state.typed.length / word.length, 1);
}

function renderStats() {
  const minutes = Math.max(state.elapsed / 60, 1 / 60);
  const accuracy = state.inputs ? Math.round((state.correctChars / state.inputs) * 100) : 0;
  els.timeStat.textContent = formatTime(state.elapsed);
  els.inputStat.textContent = String(state.inputs);
  els.wpmStat.textContent = String(Math.round(state.correctChars / 5 / minutes));
  els.correctStat.textContent = String(state.completedWords);
  els.accuracyStat.textContent = `${accuracy}%`;
}

function renderChapters() {
  els.chapterList.innerHTML = state.chapters
    .map(
      (chapter, index) => `
        <div class="chapter-item ${index === state.chapterIndex ? "active" : ""}" data-index="${index}">
          <button class="chapter-select" type="button" data-index="${index}">
          <span>${escapeHtml(chapter.title)}</span>
          <small>${chapter.words.length} 词${chapter.builtIn ? " · 内置" : chapter.dictionaryLabel ? ` · ${escapeHtml(chapter.dictionaryLabel)}` : ""}</small>
          </button>
          ${chapter.builtIn ? "" : `<button class="chapter-delete" type="button" data-index="${index}" title="删除章节"><i data-lucide="trash-2"></i></button>`}
          ${chapter.builtIn ? "" : `<div class="chapter-link-row"><input class="chapter-link-input" type="url" data-index="${index}" placeholder="粘贴文章链接" value="${escapeHtml(chapter.articleUrl || "")}" /><button class="chapter-link-open" type="button" data-index="${index}" title="打开文章链接"><i data-lucide="external-link"></i></button></div>`}
        </div>`
    )
    .join("");
  lucide.createIcons();
}

function renderWordModal() {
  const chapter = currentChapter();
  const words = chapter?.words || [];
  const canEdit = chapter && !chapter.builtIn;
  els.wordTable.classList.toggle("editable", Boolean(canEdit));
  els.wordTable.innerHTML = words.length
    ? words.map((entry, index) => `<div class="word-row"><strong>${escapeHtml(entry.word)}</strong><span>${escapeHtml(entry.meaning || "")}</span>${canEdit ? `<button class="word-delete" type="button" data-index="${index}" title="删除单词"><i data-lucide="trash-2"></i></button>` : ""}</div>`).join("")
    : `<p>当前章节没有单词。</p>`;
  lucide.createIcons();
}

function syncChapters() {
  state.chapters = [...builtinChapters, ...state.userChapters];
  if (state.chapterIndex >= state.chapters.length) state.chapterIndex = Math.max(0, state.chapters.length - 1);
}

function deleteChapter(index) {
  const chapter = state.chapters[index];
  if (!chapter || chapter.builtIn) return;
  if (!confirm(`确定删除章节“${chapter.title}”吗？`)) return;
  state.userChapters = state.userChapters.filter((item) => item.id !== chapter.id);
  syncChapters();
  if (state.chapterIndex === index) {
    state.chapterIndex = Math.min(index, state.chapters.length - 1);
    restartPractice();
  } else if (state.chapterIndex > index) {
    state.chapterIndex -= 1;
  }
  saveState();
  render();
}

function deleteWordFromCurrentChapter(index) {
  const chapter = currentChapter();
  if (!chapter || chapter.builtIn) return;
  const entry = chapter.words[index];
  if (!entry) return;
  if (!confirm(`确定删除单词“${entry.word}”吗？`)) return;
  chapter.words.splice(index, 1);
  const storedChapter = state.userChapters.find((item) => item.id === chapter.id);
  if (storedChapter) storedChapter.words = chapter.words;
  state.wordIndex = Math.min(state.wordIndex, Math.max(0, chapter.words.length - 1));
  state.typed = "";
  state.wrongMap.clear();
  saveState();
  render();
  renderWordModal();
}

function normalizeUrl(value) {
  const url = value.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function updateChapterArticleUrl(index, value) {
  const chapter = state.chapters[index];
  if (!chapter || chapter.builtIn) return;
  chapter.articleUrl = value.trim();
  const storedChapter = state.userChapters.find((item) => item.id === chapter.id);
  if (storedChapter) storedChapter.articleUrl = chapter.articleUrl;
  saveState();
}

function openChapterArticleUrl(index) {
  const chapter = state.chapters[index];
  if (!chapter || chapter.builtIn) return;
  const url = normalizeUrl(chapter.articleUrl || "");
  if (!url) {
    alert("请先粘贴文章链接。");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function createUserChapter({ title, source, words, articleUrl = "" }) {
  return {
    id: crypto.randomUUID(),
    title,
    source,
    dictionaryId: activeExtractDictionaryId,
    dictionaryLabel: getActiveExtractDictionary().label,
    articleUrl,
    createdAt: Date.now(),
    words
  };
}

function addUserChapter(chapter) {
  state.userChapters.push(chapter);
  syncChapters();
  state.chapterIndex = state.chapters.length - 1;
  restartPractice();
  saveState();
  render();
}

function defaultPastedChapterTitle() {
  const now = new Date();
  const stamp = `${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `粘贴文章 ${stamp}`;
}

function startPractice() {
  if (!currentWord()) return;
  state.running = true;
  state.paused = false;
  state.startedAt ||= Date.now();
  if (!state.timer) {
    state.timer = setInterval(() => {
      if (state.running && !state.paused) {
        state.elapsed += 1;
        renderStats();
      }
    }, 1000);
  }
  if (state.autoSpeak) requestSpeakCurrentWord(0);
  render();
}

function pausePractice() {
  if (!state.running) return;
  state.paused = !state.paused;
  render();
}

function restartPractice() {
  state.wordIndex = 0;
  state.typed = "";
  state.wrongMap.clear();
  state.running = false;
  state.paused = false;
  state.elapsed = 0;
  state.inputs = 0;
  state.correctChars = 0;
  state.mistakes = 0;
  state.completedWords = 0;
  state.startedAt = null;
  render();
}

function goToWord(offset, countCompletion = false) {
  const words = currentChapter()?.words || [];
  if (!words.length) return;
  if (countCompletion && offset > 0) state.completedWords += 1;
  state.wordIndex = (state.wordIndex + offset + words.length) % words.length;
  state.typed = "";
  state.wrongMap.clear();
  render();
  if (state.autoSpeak) requestSpeakCurrentWord();
}

function moveNext() {
  goToWord(1, true);
}

function movePrevious() {
  goToWord(-1, false);
}

function handleTyping(event) {
  const entry = currentWord();
  if (!entry || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    pausePractice();
    return;
  }
  if (event.key === "Escape") {
    state.paused = true;
    render();
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    goToWord(1, false);
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePrevious();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    toggleMeaning();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    requestSpeakCurrentWord(0);
    return;
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    state.typed = state.typed.slice(0, -1);
    state.wrongMap.delete(state.typed.length);
    render();
    return;
  }
  if (event.key.length !== 1 || !/[a-z'-]/i.test(event.key)) return;
  event.preventDefault();
  if (!state.running) startPractice();
  if (state.paused) return;

  const expected = entry.word[state.typed.length];
  if (!expected) return;
  state.inputs += 1;
  if (event.key.toLowerCase() === expected.toLowerCase()) {
    state.correctChars += 1;
    state.typed += expected;
    state.wrongMap.delete(state.typed.length - 1);
  } else {
    state.mistakes += 1;
    state.wrongMap.add(state.typed.length);
  }

  if (state.typed.length === entry.word.length && state.autoNext) {
    window.setTimeout(moveNext, 180);
  }
  render();
}

function getBritishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === "en-gb" && /female|uk|british|english/i.test(voice.name)) ||
    voices.find((voice) => voice.lang?.toLowerCase() === "en-gb") ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en-gb")) ||
    voices.find((voice) => /uk|british|english/i.test(voice.name) && voice.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}

function requestSpeakCurrentWord(delay = isTouchDevice ? 140 : 55) {
  if (!("speechSynthesis" in window)) return;
  window.clearTimeout(speakTimer);
  const requestId = ++speakRequestId;
  speakTimer = window.setTimeout(() => speakCurrentWord(requestId), delay);
}

function speakCurrentWord(requestId = ++speakRequestId) {
  const entry = currentWord();
  if (!entry || !("speechSynthesis" in window)) return;
  const word = entry.word;
  window.speechSynthesis.cancel();
  window.setTimeout(() => {
    if (requestId !== speakRequestId || currentWord()?.word !== word) return;
    const utterance = new SpeechSynthesisUtterance(word);
    const voice = getBritishVoice();
    utterance.lang = "en-GB";
    utterance.rate = isTouchDevice ? 0.82 : 0.88;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, isTouchDevice ? 90 : 35);
}

async function handleUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  if (!window.mammoth) {
    alert("Word 解析库还没有加载成功。请确认当前电脑可以访问 unpkg.com，或稍后刷新页面再试。");
    event.target.value = "";
    return;
  }
  els.prompt.textContent = "正在解析 Word...";
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const words = extractArticleWords(result.value);
      if (!words.length) {
        alert(`${file.name} 没有匹配到“${getActiveExtractDictionary().label}”里的单词。请确认文档里有英文文章内容。`);
        continue;
      }
      addUserChapter(createUserChapter({
        title: file.name.replace(/\.docx$/i, ""),
        source: file.name,
        words
      }));
    } catch (error) {
      console.error(error);
      alert(`${file.name} 解析失败，请确认它是 .docx 文件。`);
    }
  }
  event.target.value = "";
}

function handlePastedArticleExtract() {
  const text = els.pasteArticleText.value.trim();
  if (!text) {
    alert("请先粘贴文章内容。");
    return;
  }
  const words = extractArticleWords(text);
  if (!words.length) {
    alert(`粘贴内容没有匹配到“${getActiveExtractDictionary().label}”里的单词。`);
    return;
  }
  addUserChapter(createUserChapter({
    title: els.pasteChapterTitle.value.trim() || defaultPastedChapterTitle(),
    source: "粘贴文章",
    words
  }));
  els.pasteArticleText.value = "";
  els.pasteChapterTitle.value = "";
  els.drawer.classList.remove("open");
}

function extractArticleWords(text, dictionaryId = activeExtractDictionaryId) {
  const dictionaryMap = dictionaryMaps.get(dictionaryId) || dictionaryMaps.get(builtinDictionaries[0].id);
  const matched = new Map();
  const tokens = text.match(/[A-Za-z][A-Za-z'-]{1,31}/g) || [];
  for (const token of tokens) {
    const entry = findBuiltinEntry(token, dictionaryMap);
    if (!entry || matched.has(entry.word)) continue;
    matched.set(entry.word, { word: entry.word, meaning: entry.meaning, phonetic: entry.phonetic || "" });
  }
  return Array.from(matched.values());
}

function findBuiltinEntry(token, dictionaryMap = dictionaryMaps.get(activeExtractDictionaryId)) {
  const map = dictionaryMap || dictionaryMaps.get(builtinDictionaries[0].id);
  for (const candidate of getLemmaCandidates(token)) {
    const entry = map.get(candidate);
    if (entry) return entry;
  }
  return null;
}

function getLemmaCandidates(token) {
  const word = token.toLowerCase().replace(/^'+|'+$/g, "");
  const candidates = [];
  const add = (value) => {
    if (value && WORD_RE.test(value) && !candidates.includes(value)) candidates.push(value);
  };
  add(word);
  add(irregularForms.get(word));

  if (word.endsWith("ies") && word.length > 4) add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ves") && word.length > 4) {
    add(`${word.slice(0, -3)}f`);
    add(`${word.slice(0, -3)}fe`);
  }
  if (word.endsWith("es") && word.length > 3) {
    add(word.slice(0, -2));
    if (/(ches|shes|xes|zes|ses|oes)$/.test(word)) add(word.slice(0, -2));
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) add(word.slice(0, -1));

  if (word.endsWith("ied") && word.length > 4) add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ed") && word.length > 3) {
    const base = word.slice(0, -2);
    add(base);
    add(`${base}e`);
    if (hasDoubledFinalConsonant(base)) add(base.slice(0, -1));
  }

  if (word.endsWith("ying") && word.length > 5) add(`${word.slice(0, -4)}ie`);
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    add(base);
    add(`${base}e`);
    if (hasDoubledFinalConsonant(base)) add(base.slice(0, -1));
  }

  if (word.endsWith("er") && word.length > 4) {
    const base = word.slice(0, -2);
    add(base);
    add(`${base}e`);
    if (hasDoubledFinalConsonant(base)) add(base.slice(0, -1));
  }
  if (word.endsWith("est") && word.length > 5) {
    const base = word.slice(0, -3);
    add(base);
    add(`${base}e`);
    if (hasDoubledFinalConsonant(base)) add(base.slice(0, -1));
  }

  return candidates;
}

function hasDoubledFinalConsonant(value) {
  return /([^aeiou])\1$/i.test(value) && !/(ss|ll|zz)$/i.test(value);
}

function extractWords(text) {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const map = new Map();

  for (const line of lines) {
    const normalized = line.replace(/[\t｜|]+/g, " ").replace(/\s{2,}/g, " ");
    const direct = normalized.match(/^([A-Za-z][A-Za-z'-]{1,31})\s+(.*)$/);
    if (direct && (isUsefulMeaning(direct[2]) || POS_RE.test(direct[2]))) {
      addWord(map, direct[1], cleanMeaning(direct[2]));
      continue;
    }

    const tokens = normalized.match(/[A-Za-z][A-Za-z'-]{1,31}/g) || [];
    for (const token of tokens) {
      if (!WORD_RE.test(token) || isStopWord(token)) continue;
      const index = normalized.indexOf(token);
      const after = normalized.slice(index + token.length).trim();
      const meaning = isUsefulMeaning(after) || POS_RE.test(after) ? cleanMeaning(after) : "";
      addWord(map, token, meaning);
      break;
    }
  }

  if (map.size < 3) {
    const pairs = text.match(/[A-Za-z][A-Za-z'-]{1,31}\s*[：:—-]\s*[^\n]+/g) || [];
    for (const pair of pairs) {
      const match = pair.match(/^([A-Za-z][A-Za-z'-]{1,31})\s*[：:—-]\s*(.+)$/);
      if (match) addWord(map, match[1], cleanMeaning(match[2]));
    }
  }

  return Array.from(map.values());
}

function addWord(map, rawWord, meaning) {
  const word = rawWord.toLowerCase().replace(/^'+|'+$/g, "");
  if (!WORD_RE.test(word) || isStopWord(word)) return;
  if (!map.has(word)) {
    map.set(word, { word, meaning, phonetic: "" });
  } else if (meaning && !map.get(word).meaning) {
    map.get(word).meaning = meaning;
  }
}

function cleanMeaning(value) {
  return value
    .replace(/^[\s:：,，;；.。\-—]+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

function isUsefulMeaning(value) {
  if (!value) return false;
  const cleaned = cleanMeaning(value);
  return CJK_RE.test(cleaned) || /[;；,，]/.test(cleaned);
}

function isStopWord(word) {
  return new Set(["the", "and", "for", "with", "from", "that", "this", "have", "will", "your", "you", "are", "was", "were", "been", "chapter", "unit", "word", "words", "english"]).has(word.toLowerCase());
}

function getActiveExtractDictionary() {
  return builtinDictionaries.find((dictionary) => dictionary.id === activeExtractDictionaryId) || builtinDictionaries[0];
}

function renderDictionarySelect() {
  if (!els.extractDictionarySelect) return;
  const currentValue = els.extractDictionarySelect.value;
  els.extractDictionarySelect.innerHTML = builtinDictionaries
    .map((dictionary) => `<option value="${escapeHtml(dictionary.id)}">${escapeHtml(dictionary.label)}（${dictionary.words.length}词）</option>`)
    .join("");
  els.extractDictionarySelect.value = activeExtractDictionaryId || currentValue || builtinDictionaries[0].id;
}

function toggleMeaning() {
  state.showMeaning = !state.showMeaning;
  saveState();
  render();
}

function bindEvents() {
  document.addEventListener("keydown", handleTyping);
  els.startButton.addEventListener("click", () => (state.running && !state.paused ? pausePractice() : startPractice()));
  els.pauseButton.addEventListener("click", pausePractice);
  els.restartButton.addEventListener("click", restartPractice);
  els.prevButton.addEventListener("click", movePrevious);
  els.nextButton.addEventListener("click", () => goToWord(1, false));
  els.drawerTab.addEventListener("click", () => els.drawer.classList.toggle("open"));
  els.closeDrawer.addEventListener("click", () => els.drawer.classList.remove("open"));
  els.docUpload.addEventListener("change", handleUpload);
  els.extractPastedArticle.addEventListener("click", handlePastedArticleExtract);
  els.pasteArticleText.addEventListener("keydown", (event) => event.stopPropagation());
  els.pasteChapterTitle.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") handlePastedArticleExtract();
  });
  els.extractDictionarySelect.addEventListener("change", () => {
    activeExtractDictionaryId = els.extractDictionarySelect.value;
    saveState();
  });
  els.chapterList.addEventListener("click", (event) => {
    const openButton = event.target.closest(".chapter-link-open");
    if (openButton) {
      event.stopPropagation();
      openChapterArticleUrl(Number(openButton.dataset.index));
      return;
    }
    const deleteButton = event.target.closest(".chapter-delete");
    if (deleteButton) {
      event.stopPropagation();
      deleteChapter(Number(deleteButton.dataset.index));
      return;
    }
    if (event.target.closest(".chapter-link-input")) return;
    const button = event.target.closest(".chapter-select");
    if (!button) return;
    state.chapterIndex = Number(button.dataset.index);
    restartPractice();
    saveState();
    els.drawer.classList.remove("open");
  });
  els.chapterList.addEventListener("change", (event) => {
    const input = event.target.closest(".chapter-link-input");
    if (!input) return;
    updateChapterArticleUrl(Number(input.dataset.index), input.value);
  });
  els.chapterList.addEventListener("keydown", (event) => {
    const input = event.target.closest(".chapter-link-input");
    if (!input) return;
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      updateChapterArticleUrl(Number(input.dataset.index), input.value);
      openChapterArticleUrl(Number(input.dataset.index));
    }
  });
  els.soundButton.addEventListener("click", () => {
    state.autoSpeak = !state.autoSpeak;
    saveState();
    render();
    if (state.autoSpeak) requestSpeakCurrentWord(0);
  });
  els.accentButton.addEventListener("click", () => requestSpeakCurrentWord(0));
  els.shuffleButton.addEventListener("click", () => {
    const chapter = currentChapter();
    if (chapter) chapter.words.sort(() => Math.random() - 0.5);
    state.shuffle = !state.shuffle;
    restartPractice();
    saveState();
  });
  els.meaningButton.addEventListener("click", toggleMeaning);
  els.translateButton.addEventListener("click", toggleMeaning);
  els.speakWord.addEventListener("click", () => requestSpeakCurrentWord(0));
  els.deleteCurrentWord.addEventListener("click", () => deleteWordFromCurrentChapter(state.wordIndex));
  els.wordListButton.addEventListener("click", () => {
    renderWordModal();
    els.wordModal.showModal();
  });
  els.wordTable.addEventListener("click", (event) => {
    const button = event.target.closest(".word-delete");
    if (!button) return;
    deleteWordFromCurrentChapter(Number(button.dataset.index));
  });
  els.closeWordModal.addEventListener("click", () => els.wordModal.close());
  els.settingsButton.addEventListener("click", () => els.settingsModal.showModal());
  els.closeSettingsModal.addEventListener("click", () => els.settingsModal.close());
  els.autoSpeakToggle.addEventListener("change", () => {
    state.autoSpeak = els.autoSpeakToggle.checked;
    saveState();
    render();
  });
  els.autoNextToggle.addEventListener("change", () => {
    state.autoNext = els.autoNextToggle.checked;
    saveState();
  });
  els.clearDataButton.addEventListener("click", () => {
    if (!confirm("确定清空所有本地上传章节吗？内置词库会保留。")) return;
    state.userChapters = [];
    syncChapters();
    state.chapterIndex = 0;
    restartPractice();
    saveState();
    els.settingsModal.close();
  });
  els.themeButton.addEventListener("click", () => {
    document.body.classList.toggle("light");
    saveState();
  });
  els.keyboardButton.addEventListener("click", () => alert("键盘：输入当前单词；Enter 暂停/继续；← 上一个；→ 下一个；↑ 发音；↓ 隐藏/显示释义；Backspace 回退；Esc 暂停。"));
  els.statsButton.addEventListener("click", () => document.querySelector(".stats-panel").scrollIntoView({ behavior: "smooth", block: "center" }));
}

loadState();
bindEvents();
if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => {};
lucide.createIcons();
render();
