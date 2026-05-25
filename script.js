let allWords = [];
let words = [];
let quizWords = [];
let currentIndex = 0;
let score = 0;
let wrongAnswers = [];
let answered = false;
let currentMode = "en-ja";

const bookSelect = document.getElementById("book-select");
const lessonSelect = document.getElementById("lesson-select");
const modeSelect = document.getElementById("mode-select");
const countSelect = document.getElementById("count-select");

const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");

const bookInfo = document.getElementById("book-info");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const restartBtn = document.getElementById("restart-btn");
const backBtn = document.getElementById("back-btn");
const retryWrongBtn = document.getElementById("retry-wrong-btn");

const progress = document.getElementById("progress");
const modeLabel = document.getElementById("mode-label");
const barFill = document.getElementById("bar-fill");
const questionLabel = document.getElementById("question-label");
const wordEl = document.getElementById("word");
const choicesEl = document.getElementById("choices");
const feedback = document.getElementById("feedback");
const scoreEl = document.getElementById("score");
const rateEl = document.getElementById("rate");
const wrongList = document.getElementById("wrong-list");

bookSelect.addEventListener("change", loadSelectedBook);
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", startQuiz);
backBtn.addEventListener("click", backToStart);
retryWrongBtn.addEventListener("click", retryWrongOnly);

window.addEventListener("DOMContentLoaded", loadSelectedBook);

async function loadSelectedBook() {
  const csvPath = bookSelect.value;

  bookInfo.textContent = "単語帳を読み込み中...";
  startBtn.disabled = true;

  try {
    const response = await fetch(csvPath);

    if (!response.ok) {
      throw new Error("CSVファイルを読み込めませんでした。");
    }

    const csvText = await response.text();
    allWords = parseCSV(csvText);

    if (allWords.length < 4) {
      throw new Error("4択問題を作るには、単語が4個以上必要です。");
    }

    updateLessonOptions();

    bookInfo.innerHTML = `
      <strong>読み込み完了</strong><br>
      単語数：${allWords.length}語<br>
      Lesson数：${getUniqueLessons(allWords).length}
    `;

    startBtn.disabled = false;
  } catch (error) {
    bookInfo.innerHTML = `
      <strong>読み込みエラー</strong><br>
      ${error.message}<br>
      CSVの場所・名前・1行目の見出しを確認してください。
    `;
    startBtn.disabled = true;
  }
}

function parseCSV(csvText) {
  const lines = csvText
    .replace(/\r/g, "")
    .split("\n")
    .filter(line => line.trim() !== "");

  const header = splitCSVLine(lines[0]).map(item => item.trim());

  const numberIndex = header.indexOf("number");
  const lessonIndex = header.indexOf("lesson");
  const enIndex = header.indexOf("en");
  const jaIndex = header.indexOf("ja");

  if (lessonIndex === -1 || enIndex === -1 || jaIndex === -1) {
    throw new Error("CSVの1行目は number,lesson,en,ja にしてください。");
  }

  return lines.slice(1).map(line => {
    const columns = splitCSVLine(line);

    return {
      number: numberIndex !== -1 ? columns[numberIndex]?.trim() : "",
      lesson: columns[lessonIndex]?.trim(),
      en: columns[enIndex]?.trim(),
      ja: columns[jaIndex]?.trim()
    };
  }).filter(word => word.lesson && word.en && word.ja);
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuote && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === "," && !insideQuote) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function updateLessonOptions() {
  const lessons = getUniqueLessons(allWords);

  lessonSelect.innerHTML = `<option value="all">全範囲</option>`;

  lessons.forEach(lesson => {
    const option = document.createElement("option");
    option.value = lesson;
    option.textContent = lesson;
    lessonSelect.appendChild(option);
  });
}

function getUniqueLessons(wordArray) {
  return [...new Set(wordArray.map(word => word.lesson))];
}

function startQuiz() {
  currentMode = modeSelect.value;

  const selectedLesson = lessonSelect.value;
  const selectedCount = countSelect.value;

  words = getWordsByLesson(selectedLesson);

  if (words.length < 4) {
    alert("4択問題を作るには、選んだ範囲に単語が4個以上必要です。");
    return;
  }

  if (selectedCount === "all") {
    quizWords = shuffle([...words]);
  } else {
    quizWords = shuffle([...words]).slice(0, Number(selectedCount));
  }

  currentIndex = 0;
  score = 0;
  wrongAnswers = [];

  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");

  showQuestion();
}

function getWordsByLesson(lesson) {
  if (lesson === "all") {
    return [...allWords];
  }

  return allWords.filter(word => word.lesson === lesson);
}

function showQuestion() {
  answered = false;
  feedback.textContent = "";
  nextBtn.classList.add("hidden");
  choicesEl.innerHTML = "";

  const currentWord = quizWords[currentIndex];

  progress.textContent = `${currentIndex + 1} / ${quizWords.length} 問`;
  modeLabel.textContent = currentMode === "en-ja" ? "英語→日本語" : "日本語→英語";

  const percent = ((currentIndex + 1) / quizWords.length) * 100;
  barFill.style.width = `${percent}%`;

  const numberText = currentWord.number ? `No.${currentWord.number} / ` : "";

  if (currentMode === "en-ja") {
    questionLabel.textContent = `${numberText}次の英単語の意味を選びなさい`;
    wordEl.textContent = currentWord.en;
  } else {
    questionLabel.textContent = `${numberText}次の日本語に合う英単語を選びなさい`;
    wordEl.textContent = currentWord.ja;
  }

  const choices = makeChoices(currentWord);

  choices.forEach(choice => {
    const button = document.createElement("button");
    button.textContent = choice;
    button.classList.add("choice-btn");

    button.addEventListener("click", () => {
      checkAnswer(button, choice, currentWord);
    });

    choicesEl.appendChild(button);
  });
}

function makeChoices(correctWord) {
  let correctAnswer;
  let choicePool;

  if (currentMode === "en-ja") {
    correctAnswer = correctWord.ja;
    choicePool = words
      .filter(word => word.ja !== correctWord.ja)
      .map(word => word.ja);
  } else {
    correctAnswer = correctWord.en;
    choicePool = words
      .filter(word => word.en !== correctWord.en)
      .map(word => word.en);
  }

  const selectedWrongChoices = shuffle(choicePool).slice(0, 3);
  return shuffle([correctAnswer, ...selectedWrongChoices]);
}

function checkAnswer(button, selectedAnswer, currentWord) {
  if (answered) return;
  answered = true;

  const correctAnswer = currentMode === "en-ja" ? currentWord.ja : currentWord.en;
  const buttons = document.querySelectorAll(".choice-btn");

  buttons.forEach(btn => {
    btn.disabled = true;

    if (btn.textContent === correctAnswer) {
      btn.classList.add("correct");
    }
  });

  if (selectedAnswer === correctAnswer) {
    score++;
    feedback.textContent = "正解！";
  } else {
    button.classList.add("wrong");
    feedback.textContent = `不正解。正解は「${correctAnswer}」`;
    wrongAnswers.push(currentWord);
  }

  nextBtn.classList.remove("hidden");
}

function nextQuestion() {
  currentIndex++;

  if (currentIndex < quizWords.length) {
    showQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  quizScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  const rate = Math.round((score / quizWords.length) * 100);

  scoreEl.textContent = `${quizWords.length}問中 ${score}問正解`;
  rateEl.textContent = `正答率：${rate}%`;

  if (wrongAnswers.length === 0) {
    wrongList.innerHTML = "<p>全問正解！すごい！</p>";
    retryWrongBtn.classList.add("hidden");
  } else {
    let html = "<h3>間違えた単語</h3><ul>";

    wrongAnswers.forEach(word => {
      const numberText = word.number ? `No.${word.number} ` : "";
      html += `<li>${numberText}<strong>${word.en}</strong>：${word.ja} <span class="lesson-tag">(${word.lesson})</span></li>`;
    });

    html += "</ul>";
    wrongList.innerHTML = html;
    retryWrongBtn.classList.remove("hidden");
  }
}

function retryWrongOnly() {
  if (wrongAnswers.length < 4) {
    alert("4択問題を作るには、間違えた単語が4個以上必要です。");
    return;
  }

  words = [...wrongAnswers];
  quizWords = shuffle([...wrongAnswers]);
  currentIndex = 0;
  score = 0;
  wrongAnswers = [];

  resultScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");

  showQuestion();
}

function backToStart() {
  resultScreen.classList.add("hidden");
  quizScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}