const tg = window.Telegram.WebApp;
tg.expand();

// ===================== NAV =====================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.page + '-page').classList.add('active');
  });
});

// ===================== TIMER =====================
let startTime = null;
let interval = null;
let accumulatedTime = Number(localStorage.getItem("timerTime")) || 0;

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

function saveTimer() {
  localStorage.setItem("timerTime", accumulatedTime);
}

function updateTimer() {
  const current = Date.now() - startTime;
  const total = accumulatedTime + current;

  const totalSeconds = Math.floor(total / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");

  timerEl.textContent = `${h}:${m}:${s}`;
}

timerEl.addEventListener('click', () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
    accumulatedTime += Date.now() - startTime;
    saveTimer();
    statusEl.textContent = "Пауза";
    tg.sendData("stop");
  } else {
    startTime = Date.now();
    interval = setInterval(updateTimer, 1000);
    statusEl.textContent = "Работает";
    tg.sendData("start");
  }
});

document.getElementById("resetTimer")?.addEventListener("click", () => {
  clearInterval(interval);
  interval = null;
  startTime = null;
  accumulatedTime = 0;
  saveTimer();
  timerEl.textContent = "00:00:00";
  statusEl.textContent = "Сброшено";
  tg.sendData("reset");
});

// ===================== HABITS =====================
let habits = JSON.parse(localStorage.getItem("habits")) || [];

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
  let streak = 0;
  let date = new Date();

  while (true) {
    const d = getDateString(date);
    if (habit.days[d]) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else break;
  }
  return streak;
}

function calculateBestStreak(habit) {
  let best = 0;
  let current = 0;

  const dates = Object.keys(habit.days)
    .sort((a, b) => new Date(a) - new Date(b));

  dates.forEach(date => {
    if (habit.days[date]) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

const list = document.querySelector(".habit-list");
const input = document.getElementById("habitInput");
const addBtn = document.getElementById("addBtn");

function saveHabits() {
  localStorage.setItem("habits", JSON.stringify(habits));
}

function renderHabits() {
  list.innerHTML = "";

  habits.forEach((habit, index) => {
    const lastDays = getLastNDays(14);
    const streak = calculateStreak(habit);

    const div = document.createElement("div");
    div.className = "habit";
    div.dataset.index = index;

    div.innerHTML = `
      <div class="habit-info">
        <span>${habit.name}</span>
        <span>🔥 ${streak}</span>
      </div>
      <div class="habit-days">
        ${lastDays.map(date => `
          <div class="day ${habit.days[date] ? "active" : ""}" data-date="${date}"></div>
        `).join("")}
      </div>
      <button class="check-btn" data-index="${index}">✔</button>
    `;

    list.appendChild(div);
  });

  attachHabitEvents();
  saveHabits();
}

addBtn.onclick = () => {
  const name = input.value.trim();
  if (!name) return;

  habits.push({ name, days: {} });
  input.value = "";
  renderHabits();
};

function attachHabitEvents() {
  document.querySelectorAll(".check-btn").forEach(btn => {
    btn.onclick = () => {
      const i = btn.dataset.index;
      const today = getToday();
      habits[i].days[today] = !habits[i].days[today];
      renderHabits();
    };
  });

  document.querySelectorAll(".day").forEach(day => {
    day.onclick = () => {
      const date = day.dataset.date;
      const index = day.closest(".habit").dataset.index;
      habits[index].days[date] = !habits[index].days[date];
      renderHabits();
    };
  });

  document.querySelectorAll(".habit").forEach(habitDiv => {
    let timer;
    habitDiv.addEventListener("mousedown", () => {
      timer = setTimeout(() => {
        const i = habitDiv.dataset.index;
        if (confirm("Удалить?")) {
          habits.splice(i, 1);
          renderHabits();
        }
      }, 1500);
    });
    ["mouseup", "mouseleave"].forEach(e =>
      habitDiv.addEventListener(e, () => clearTimeout(timer))
    );
  });
}

renderHabits();

// ===================== SKILL TREE =====================
let skillTree = JSON.parse(localStorage.getItem("skillTree")) || [];
let idCounter = skillTree.length ? Math.max(...skillTree.map(s => s.id)) + 1 : 1;

function saveSkillTree() {
  localStorage.setItem("skillTree", JSON.stringify(skillTree));
}

function renderSkillTree() {
  const container = document.getElementById("skill-tree");
  container.innerHTML = "";

  skillTree.forEach(skill => {
    if (!skill.parent) {
      container.appendChild(createNode(skill));
    }
  });
}

function createNode(skill) {
  const div = document.createElement("div");
  div.className = "skill-node";

  div.innerHTML = `
    <div class="skill-card">
      <input value="${skill.name || ""}">
      <button class="add">+</button>
      <button class="del">—</button>
    </div>
  `;

  div.querySelector("input").oninput = e => {
    skill.name = e.target.value;
    saveSkillTree();
  };

  div.querySelector(".add").onclick = () => {
    const child = { id: idCounter++, name: "", parent: skill.id };
    skillTree.push(child);
    saveSkillTree();
    renderSkillTree();
  };

  div.querySelector(".del").onclick = () => {
    deleteSkill(skill.id);
  };

  skillTree
    .filter(s => s.parent === skill.id)
    .forEach(child => div.appendChild(createNode(child)));

  return div;
}

function deleteSkill(id) {
  skillTree = skillTree.filter(s => s.id !== id && s.parent !== id);
  saveSkillTree();
  renderSkillTree();
}

document.getElementById("addRootSkill").onclick = () => {
  skillTree.push({ id: idCounter++, name: "", parent: null });
  saveSkillTree();
  renderSkillTree();
};

renderSkillTree();