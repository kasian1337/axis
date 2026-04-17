const buttons = document.querySelectorAll(".check-btn");

buttons.forEach(btn => {
  btn.onclick = () => {
    const habit = btn.closest(".habit");
    const days = habit.querySelectorAll(".day");

    for (let i = days.length - 1; i > 0; i--) {
      days[i].classList.toggle("active", days[i - 1].classList.contains("active"));
    }

    days[0].classList.add("active");
  };
});
let habits = JSON.parse(localStorage.getItem("habits")) || [];

const list = document.querySelector(".habit-list");
const input = document.getElementById("habitInput");
const addBtn = document.getElementById("addBtn");

// рендер
function render() {
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
  save();
}

// сохранение
function save() {
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
  render();
};

// отметка дня
function attachEvents() {
  document.querySelectorAll(".check-btn").forEach(btn => {
    btn.onclick = () => {
      const i = btn.dataset.index;

      habits[i].days.unshift(true);
      habits[i].days = habits[i].days.slice(0, 5);

      habits[i].streak += 1;

      render();
    };
  });
}

// старт
render();
