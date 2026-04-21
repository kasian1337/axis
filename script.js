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
    
    if (btn.dataset.page === 'progress') {
      renderProgress();
    }
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

// Миграция старых данных
habits = habits.map(habit => {
  if (Array.isArray(habit.days)) {
    // Конвертируем массив в объект с датами
    const daysObj = {};
    const last7Days = getLastNDays(7);
    habit.days.forEach((done, index) => {
      if (last7Days[index]) {
        daysObj[last7Days[index]] = done;
      }
    });
    habit.days = daysObj;
  }
  return habit;
});

// Функции для дат
function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDateString(date) {
  return date.toISOString().split('T')[0];
}

function getLastNDays(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(getDateString(date));
  }
  return dates;
}

function calculateStreak(habit) {
  const today = getToday();
  let streak = 0;
  let date = new Date(today);
  
  while (true) {
    const dateStr = getDateString(date);
    if (habit.days[dateStr]) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const list = document.querySelector(".habit-list");
const input = document.getElementById("habitInput");
const addBtn = document.getElementById("addBtn");

// рендер привычек
function renderHabits() {
  list.innerHTML = "";

  habits.forEach((habit, index) => {
    const last7Days = getLastNDays(7);
    const streak = calculateStreak(habit);
    habit.streak = streak; // обновляем streak

    const div = document.createElement("div");
    div.className = "habit";
    div.dataset.index = index;

    div.innerHTML = `
      <div class="habit-info">
        <span class="habit-name">${habit.name}</span>
        <span class="habit-streak">🔥 ${streak} дней</span>
      </div>

      <div class="habit-days">
        ${last7Days.map(date => {
          const isActive = habit.days[date];
          const isToday = date === getToday();
          return `<div class="day ${isActive ? "active" : ""} ${isToday ? "today" : ""}" data-date="${date}">${isActive ? '✔' : '✗'}</div>`;
        }).join("")}
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
    days: {}
  });

  input.value = "";
  renderHabits();
};

// отметка дня
function attachEvents() {
  document.querySelectorAll(".check-btn").forEach(btn => {
    btn.onclick = () => {
      const i = btn.dataset.index;
      const today = getToday();
      
      habits[i].days[today] = !habits[i].days[today]; // toggle
      habits[i].streak = calculateStreak(habits[i]);

      renderHabits();
    };
  });

  // Клик по дню для отметки
  document.querySelectorAll(".day").forEach(day => {
    day.onclick = () => {
      const date = day.dataset.date;
      const habitDiv = day.closest(".habit");
      const index = habitDiv.dataset.index;
      
      habits[index].days[date] = !habits[index].days[date];
      habits[index].streak = calculateStreak(habits[index]);

      renderHabits();
    };
  });

  // Долгое нажатие для удаления привычки
  document.querySelectorAll(".habit").forEach(habitDiv => {
    let pressTimer;
    
    habitDiv.addEventListener('mousedown', startPress);
    habitDiv.addEventListener('touchstart', startPress);
    habitDiv.addEventListener('mouseup', cancelPress);
    habitDiv.addEventListener('mouseleave', cancelPress);
    habitDiv.addEventListener('touchend', cancelPress);

    function startPress() {
      pressTimer = setTimeout(() => {
        const index = habitDiv.dataset.index;
        if (confirm(`Удалить привычку "${habits[index].name}"?`)) {
          habits.splice(index, 1);
          renderHabits();
        }
      }, 1000); // 1 секунда
    }

    function cancelPress() {
      clearTimeout(pressTimer);
    }
  });
}

// рендер прогресса
function renderProgress() {
  const container = document.getElementById("progress-container");
  container.innerHTML = "";

  habits.forEach((habit, index) => {
    const last30Days = getLastNDays(30);
    const data = last30Days.map(date => habit.days[date] ? 1 : 0);

    const chartDiv = document.createElement("div");
    chartDiv.className = "chart-item";
    chartDiv.innerHTML = `
      <h4>${habit.name}</h4>
      <canvas id="chart-${index}"></canvas>
    `;

    container.appendChild(chartDiv);

    const ctx = document.getElementById(`chart-${index}`).getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: last30Days.map(date => {
          const d = new Date(date);
          return `${d.getDate()}.${d.getMonth() + 1}`;
        }),
        datasets: [{
          label: 'Выполнено',
          data: data,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          pointRadius: 2,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2,
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
            ticks: {
              stepSize: 1,
              callback: function(value) {
                return value === 1 ? 'Да' : 'Нет';
              }
            }
          },
          x: {
            ticks: {
              maxTicksLimit: 10
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  });
}

// старт
renderHabits();