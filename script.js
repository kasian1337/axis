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

  habits.push({
    name,
    days: {}
  });
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
const skillCanvas = document.getElementById("skill-canvas");
const skillZoom = document.getElementById("skill-zoom");
const nodeArea = document.getElementById("node-area");
const svg = document.getElementById("connections-svg");
const rootButton = document.getElementById("addRootSkill");

let nodes = [];
let connections = [];
let nodeCounter = 1;
const minNodeDistance = 140;

let scale = 1;
const minScale = 0.6;
const maxScale = 2.5;
const touchPointers = new Map();
let pinchStartDistance = 0;
let pinchStartScale = 1;

function setZoom(newScale) {
  scale = Math.min(maxScale, Math.max(minScale, newScale));
  skillZoom.style.transform = `scale(${scale})`;
  updateConnections();
}

function getDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

skillZoom.style.transformOrigin = "0 0";

skillCanvas.addEventListener("wheel", function(event) {
  if (!event.deltaY) return;
  event.preventDefault();

  const factor = event.deltaY > 0 ? 0.92 : 1.08;
  setZoom(scale * factor);
});

skillCanvas.addEventListener("pointerdown", function(event) {
  if (event.pointerType !== "touch") return;
  touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (touchPointers.size === 2) {
    const points = Array.from(touchPointers.values());
    pinchStartDistance = getDistance(points[0], points[1]);
    pinchStartScale = scale;
  }
});

skillCanvas.addEventListener("pointermove", function(event) {
  if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) return;
  touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (touchPointers.size === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    const points = Array.from(touchPointers.values());
    const currentDistance = getDistance(points[0], points[1]);
    if (currentDistance > 0) {
      setZoom(pinchStartScale * (currentDistance / pinchStartDistance));
    }
  }
});

skillCanvas.addEventListener("pointerup", function(event) {
  if (event.pointerType !== "touch") return;
  touchPointers.delete(event.pointerId);
  if (touchPointers.size < 2) {
    pinchStartDistance = 0;
  }
});

skillCanvas.addEventListener("pointercancel", function(event) {
  if (event.pointerType !== "touch") return;
  touchPointers.delete(event.pointerId);
  if (touchPointers.size < 2) {
    pinchStartDistance = 0;
  }
});

function addRootNode() {
  const existingRoots = nodes.filter(node => node.parentId === null).length;
  const areaWidth = nodeArea.clientWidth ? nodeArea.clientWidth : 800;
  
  // Для первого узла - максимально влево с небольшим отступом
  // Для остальных - распределять с интервалом 200px
  const x = existingRoots === 0 ? 20 : 20 + existingRoots * 200;

  const root = {
    id: nodeCounter++,
    label: "Навык",
    color: "yellow",
    x,
    y: 40,
    parentId: null,
  };

  nodes.push(root);
  createNode(root);
  updateConnections();
}

function addChildNode(parentId) {
  const source = nodes.find(node => node.id === parentId);
  if (!source) return;

  const sameLevelCount = nodes.filter(node => node.parentId === source.parentId).length;
  const x = Math.max(20, source.x + (sameLevelCount - 1) * 100);
  const y = source.y + 210;

  const sibling = {
    id: nodeCounter++,
    label: "Навык",
    color: source.color,
    x,
    y,
    parentId: source.parentId,
  };

  nodes.push(sibling);
  createNode(sibling);
  connectNodes(source.id, sibling.id);
  updateConnections();
}

function deleteNode(nodeId) {
  // Найти всех детей этого узла и удалить их рекурсивно
  const children = nodes.filter(node => node.parentId === nodeId);
  children.forEach(child => deleteNode(child.id));

  // Удалить сам узел из массива
  nodes = nodes.filter(node => node.id !== nodeId);

  // Удалить все связи, связанные с этим узлом
  connections = connections.filter(conn => {
    if (conn.from === nodeId || conn.to === nodeId) {
      conn.line.remove();
      return false;
    }
    return true;
  });

  // Удалить DOM элемент узла
  const wrapper = nodeArea.querySelector(`[data-id='${nodeId}']`);
  if (wrapper) {
    wrapper.classList.remove("visible");
    setTimeout(() => wrapper.remove(), 250);
  }

  updateConnections();
}

function createNode(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "node-wrapper";
  wrapper.dataset.id = node.id;
  wrapper.style.left = `${node.x}px`;
  wrapper.style.top = `${node.y}px`;

  wrapper.innerHTML = `
    <div class="node-card">
      <div class="node-circle ${node.color}">?</div>
      <button class="node-add" title="Добавить ещё один узел">+</button>
      <button class="node-del" title="Удалить узел">−</button>
    </div>
    <input class="node-label-input" placeholder="Название навыка" value="${node.label}">
  `;

  nodeArea.appendChild(wrapper);
  window.requestAnimationFrame(() => wrapper.classList.add("visible"));

  const labelInput = wrapper.querySelector(".node-label-input");
  labelInput.addEventListener("input", function (event) {
    node.label = event.target.value;
  });

  wrapper.querySelector(".node-add").addEventListener("click", function (event) {
    event.stopPropagation();
    addChildNode(node.id);
  });

  wrapper.querySelector(".node-del").addEventListener("click", function (event) {
    event.stopPropagation();
    deleteNode(node.id);
  });

  makeDraggable(wrapper, node.id);
}

function connectNodes(fromId, toId) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("connection-line");
  line.dataset.from = fromId;
  line.dataset.to = toId;

  const source = nodes.find(function (node) {
    return node.id === fromId;
  });
  line.setAttribute("stroke", source && source.color === "blue" ? "#00e5ff" : "#ffd54f");
  svg.appendChild(line);

  connections.push({
    from: fromId,
    to: toId,
    line: line
  });
  updateConnections();
}

function updateConnections() {
  const areaRect = nodeArea.getBoundingClientRect();
  svg.setAttribute("width", areaRect.width);
  svg.setAttribute("height", areaRect.height);

  connections.forEach(function (connection) {
    const fromWrapper = nodeArea.querySelector(`[data-id='${connection.from}']`);
    const toWrapper = nodeArea.querySelector(`[data-id='${connection.to}']`);
    if (!fromWrapper || !toWrapper) return;

    const fromCircle = fromWrapper.querySelector('.node-circle');
    const toCircle = toWrapper.querySelector('.node-circle');
    if (!fromCircle || !toCircle) return;

    const fromRect = fromCircle.getBoundingClientRect();
    const toRect = toCircle.getBoundingClientRect();
    const fromCX = fromRect.left - areaRect.left + fromRect.width / 2;
    const fromCY = fromRect.top - areaRect.top + fromRect.height / 2;
    const toCX = toRect.left - areaRect.left + toRect.width / 2;
    const toCY = toRect.top - areaRect.top + toRect.height / 2;

    const dx = toCX - fromCX;
    const dy = toCY - fromCY;
    const distance = Math.hypot(dx, dy) || 1;
    const fromRadius = fromRect.width / 2;
    const toRadius = toRect.width / 2;
    const x1 = fromCX + (dx / distance) * fromRadius;
    const y1 = fromCY + (dy / distance) * fromRadius;
    const x2 = toCX - (dx / distance) * toRadius;
    const y2 = toCY - (dy / distance) * toRadius;

    connection.line.setAttribute("x1", x1);
    connection.line.setAttribute("y1", y1);
    connection.line.setAttribute("x2", x2);
    connection.line.setAttribute("y2", y2);
  });
}

function getNodeById(id) {
  return nodes.find(function (node) {
    return node.id === id;
  });
}

function makeDraggable(wrapper, nodeId) {
  wrapper.style.touchAction = "none";

  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;
  let dragging = false;

  function onPointerMove(event) {
    if (!dragging) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    const dx = (clientX - startX) / scale;
    const dy = (clientY - startY) / scale;
    const areaRect = nodeArea.getBoundingClientRect();
    let newX = initialX + dx;
    let newY = initialY + dy;

    newX = Math.max(0, Math.min(newX, areaRect.width - wrapper.offsetWidth));
    newY = Math.max(0, Math.min(newY, areaRect.height - wrapper.offsetHeight));

    const centerX = newX + wrapper.offsetWidth / 2;
    const centerY = newY + wrapper.offsetHeight / 2;

    const collides = nodes.some(function (other) {
      if (other.id === nodeId) return false;
      const otherCenterX = other.x + wrapper.offsetWidth / 2;
      const otherCenterY = other.y + wrapper.offsetHeight / 2;
      return Math.hypot(otherCenterX - centerX, otherCenterY - centerY) < minNodeDistance;
    });

    if (!collides) {
      wrapper.style.left = `${newX}px`;
      wrapper.style.top = `${newY}px`;
      const node = getNodeById(nodeId);
      if (node) {
        node.x = newX;
        node.y = newY;
      }
      updateConnections();
    }
  }

  function endDrag(event) {
    dragging = false;

    try {
      wrapper.releasePointerCapture(event.pointerId);
    } catch (e) {}

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
  }

  wrapper.addEventListener("pointerdown", function (event) {
    // Пропустить, если это не первая кнопка мыши (игнорируем для touch events)
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".node-label-input, .node-add, .node-del")) return;
    event.preventDefault();
    dragging = true;
    const areaRect = nodeArea.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    initialX = (wrapperRect.left - areaRect.left) / scale;
    initialY = (wrapperRect.top - areaRect.top) / scale;
    wrapper.setPointerCapture(event.pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  });
}

rootButton.addEventListener("click", addRootNode);
window.addEventListener("resize", updateConnections);
addRootNode();