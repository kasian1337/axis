const tg = window.Telegram.WebApp;
tg.expand();

let startTime = null;
let interval = null;
let accumulatedTime = 0;

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

// Навигация
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.page + '-page').classList.add('active');
  });
});

// Управление таймером через клик
timerEl.addEventListener('click', () => {
    if (interval) {
        // Остановить
        clearInterval(interval);
        interval = null;
        accumulatedTime += Date.now() - startTime;
        tg.sendData("stop");
    } else {
        // Запустить
        if (!startTime || accumulatedTime > 0) {
            startTime = Date.now();
        }
        interval = setInterval(updateTimer, 100);
        tg.sendData("start");
    }
});

// Двойной клик для сброса
timerEl.addEventListener('dblclick', () => {
    clearInterval(interval);
    interval = null;
    startTime = null;
    accumulatedTime = 0;
    timerEl.textContent = "00:00:00";
    statusEl.textContent = "Нажми на таймер, чтобы начать";
    tg.sendData("reset");
});

function updateTimer() {
    const current = Date.now() - startTime;
    const total = accumulatedTime + current;

    const totalSeconds = Math.floor(total / 1000);

    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");

    timerEl.textContent = `${h}:${m}:${s}`;
}

// Логика привычек
let habits = JSON.parse(localStorage.getItem("habits")) || [];

const list = document.querySelector(".habit-list");
const input = document.getElementById("habitInput");
const addBtn = document.getElementById("addBtn");

// рендер
function renderHabits() {
  list.innerHTML = "";

  habits.forEach((habit, index) => {
    const div = document.createElement("div");
    div.className = "habit";

    div.innerHTML = `
      <div class="habit-info">
        <span class="habit-name">${habit.name}</span>
        <span class="habit-streak">🔥 ${habit.streak} дней</span>
      </div>

      <div class="habit-days">
        ${habit.days.map(d => `<div class="day ${d ? "active" : ""}"></div>`).join("")}
      </div>

      <button data-index="${index}" class="check-btn">✔</button>
    `;

    list.appendChild(div);
  });

  attachEvents();
  saveHabits();
}

// сохранение
function saveHabits() {
  localStorage.setItem("habits", JSON.stringify(habits));
}

// добавление
addBtn.onclick = () => {
  const name = input.value.trim();
  if (!name) return;

  habits.push({
    name,
    streak: 0,
    days: [false, false, false, false, false]
  });

  input.value = "";
  renderHabits();
};

// отметка дня
function attachEvents() {
  document.querySelectorAll(".check-btn").forEach(btn => {
    btn.onclick = () => {
      const i = btn.dataset.index;

      habits[i].days.unshift(true);
      habits[i].days = habits[i].days.slice(0, 5);

      habits[i].streak += 1;

      renderHabits();
    };
  });
}

// старт
renderHabits();