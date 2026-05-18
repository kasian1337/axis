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
let maxSession = Number(localStorage.getItem("maxSession")) || 0;
let sessions = JSON.parse(localStorage.getItem('timerSessions') || '[]');
let pausedSessionDur = 0;
let sessionBaseDur = 0;

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
  updateStats();
}

function saveSessions() {
  try {
    localStorage.setItem('timerSessions', JSON.stringify(sessions));
  } catch (e) {}
}

function saveSessionRecord(duration) {
  if (duration <= 0) return;
  if (duration > maxSession) {
    maxSession = duration;
    localStorage.setItem("maxSession", maxSession);
  }
  sessions.push({ ts: Date.now(), duration });
  saveSessions();
}

function commitPendingSession() {
  let sessionDur = 0;
  if (interval && startTime) {
    sessionDur = sessionBaseDur + (Date.now() - startTime);
  } else if (pausedSessionDur) {
    sessionDur = pausedSessionDur;
  }
  if (sessionDur > 0) {
    saveSessionRecord(sessionDur);
  }
  pausedSessionDur = 0;
  sessionBaseDur = 0;
  return sessionDur;
}

timerEl.addEventListener('click', () => {
  if (timerLongPressTriggered) { timerLongPressTriggered = false; return; }
  if (interval) {
    // pause and save a statistics record for this pause
    clearInterval(interval);
    interval = null;
    pausedSessionDur = sessionBaseDur + (Date.now() - startTime);
    saveSessionRecord(pausedSessionDur);
    sessionBaseDur = 0;
    accumulatedTime += pausedSessionDur;
    startTime = null;
    saveTimer();
    if (statusEl) statusEl.textContent = "Пауза";
    tg.sendData("stop");
    updateStats();
  } else {
    sessionBaseDur = pausedSessionDur;
    pausedSessionDur = 0;
    startTime = Date.now();
    interval = setInterval(updateTimer, 1000);
    if (statusEl) statusEl.textContent = "Работает";
    tg.sendData("start");
  }
});

// Long-press (500ms) on timer to reset
let timerLongPressTimer = null;
let timerLongPressTriggered = false;

timerEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  timerLongPressTriggered = false;
  timerLongPressTimer = setTimeout(() => {
    timerLongPressTriggered = true;
    // reset timer and save this session into history if any
    if (interval && startTime) {
      const sessionDur = sessionBaseDur + (Date.now() - startTime);
      saveSessionRecord(sessionDur);
    } else if (pausedSessionDur) {
      saveSessionRecord(pausedSessionDur);
    }
    clearInterval(interval);
    interval = null;
    startTime = null;
    accumulatedTime = 0;
    pausedSessionDur = 0;
    sessionBaseDur = 0;
    saveTimer();
    timerEl.textContent = "00:00:00";
    if (statusEl) statusEl.textContent = "Сброшено";
    tg.sendData("reset");
    updateStats();
  }, 500);
});

function clearTimerLongPress() {
  if (timerLongPressTimer) {
    clearTimeout(timerLongPressTimer);
    timerLongPressTimer = null;
  }
}

['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  timerEl.addEventListener(ev, clearTimerLongPress)
);

// --- Статистика таймера ---
const currentSessionLabel = document.getElementById('currentSessionLabel');
const maxSessionLabel = document.getElementById('maxSessionLabel');
const statFill = document.getElementById('statFill');
const sessionHistory = document.getElementById('session-history');

function formatDuration(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateStats() {
  try {
    const currentMs = (interval && startTime) ? (Date.now() - startTime) : pausedSessionDur;
    const displayMax = maxSession || currentMs || 0;

    if (currentSessionLabel) currentSessionLabel.textContent = timerEl.textContent;
    if (maxSessionLabel) maxSessionLabel.textContent = '/ ' + formatDuration(displayMax);
    if (statFill) {
      const percent = displayMax === 0 ? 0 : Math.min(100, Math.round((currentMs / displayMax) * 100));
      statFill.style.width = percent + '%';
    }
    renderSessionHistory();
  } catch (e) {
    // ignore UI update errors when elements are missing
  }
}

function deleteSession(index) {
  sessions.splice(index, 1);
  saveSessions();
  if (Array.isArray(sessions) && sessions.length) {
    maxSession = sessions.reduce((max, rec) => Math.max(max, rec.duration), 0);
    localStorage.setItem('maxSession', maxSession);
  } else {
    maxSession = 0;
    localStorage.removeItem('maxSession');
  }
  updateStats();
}

function renderSessionHistory() {
  if (!sessionHistory) return;
  sessionHistory.innerHTML = '';
  if (!Array.isArray(sessions) || sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'session-history-empty';
    empty.textContent = 'Нет статистики сессий';
    sessionHistory.appendChild(empty);
    return;
  }

  const maxDuration = maxSession || sessions.reduce((max, rec) => Math.max(max, rec.duration), 0);
  for (let i = sessions.length - 1; i >= 0; i--) {
    const rec = sessions[i];
    const item = document.createElement('div');
    item.className = 'session-history-item';

    const label = document.createElement('div');
    label.className = 'session-label';
    label.textContent = formatDuration(rec.duration);

    const bar = document.createElement('div');
    bar.className = 'session-bar';

    const fill = document.createElement('div');
    fill.className = 'session-fill';
    const widthPct = maxDuration === 0 ? 0 : Math.min(100, Math.round((rec.duration / maxDuration) * 100));
    fill.style.width = widthPct + '%';

    bar.appendChild(fill);
    item.appendChild(label);
    item.appendChild(bar);

    let deleteTimer = null;
    item.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      deleteTimer = setTimeout(() => {
        if (confirm('Удалить эту сессию?')) {
          deleteSession(i);
        }
      }, 500);
    });
    item.addEventListener('pointerup', () => {
      if (deleteTimer) {
        clearTimeout(deleteTimer);
        deleteTimer = null;
      }
    });
    item.addEventListener('pointercancel', () => {
      if (deleteTimer) {
        clearTimeout(deleteTimer);
        deleteTimer = null;
      }
    });
    item.addEventListener('pointerleave', () => {
      if (deleteTimer) {
        clearTimeout(deleteTimer);
        deleteTimer = null;
      }
    });

    sessionHistory.appendChild(item);
  }
}

// При инициализации, если maxSession не задан, восстановим из истории
(function initStatsFromHistory(){
  try{
    if ((!maxSession || maxSession === 0) && Array.isArray(sessions) && sessions.length) {
      maxSession = sessions.reduce((m,s)=> Math.max(m, s.duration), 0);
      localStorage.setItem('maxSession', maxSession);
    }
  }catch(e){}
})();

document.getElementById("resetTimer")?.addEventListener("click", () => {
  if (interval && startTime) {
    const sessionDur = sessionBaseDur + (Date.now() - startTime);
    saveSessionRecord(sessionDur);
  } else if (pausedSessionDur) {
    saveSessionRecord(pausedSessionDur);
  }
  clearInterval(interval);
  interval = null;
  startTime = null;
  accumulatedTime = 0;
  pausedSessionDur = 0;
  sessionBaseDur = 0;
  saveTimer();
  timerEl.textContent = "00:00:00";
  if (statusEl) statusEl.textContent = "Сброшено";
  tg.sendData("reset");
  updateStats();
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

  const sameLevelCount = nodes.filter(node => node.parentId === source.id).length;
  const x = Math.max(20, source.x + (sameLevelCount - 1) * 100);
  const y = source.y + 210;

  const sibling = {
    id: nodeCounter++,
    label: "Навык",
    color: source.color,
    x,
    y,
    parentId: source.id,
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

function getCircleCenter(node) {
  const wrapper = nodeArea.querySelector(`[data-id='${node.id}']`);
  if (!wrapper) return null;
  const circle = wrapper.querySelector('.node-circle');
  if (!circle) return null;

  const centerX = node.x + circle.offsetLeft + circle.offsetWidth / 2;
  const centerY = node.y + circle.offsetTop + circle.offsetHeight / 2;
  const radius = circle.offsetWidth / 2;

  return { centerX, centerY, radius };
}

function updateConnections() {
  connections.forEach(conn => {
    const from = nodes.find(n => n.id === conn.from);
    const to = nodes.find(n => n.id === conn.to);

    if (!from || !to) return;

    const fromCircle = getCircleCenter(from);
    const toCircle = getCircleCenter(to);
    if (!fromCircle || !toCircle) return;

    const dx = toCircle.centerX - fromCircle.centerX;
    const dy = toCircle.centerY - fromCircle.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const x1 = fromCircle.centerX + nx * fromCircle.radius;
    const y1 = fromCircle.centerY + ny * fromCircle.radius;
    const x2 = toCircle.centerX - nx * toCircle.radius;
    const y2 = toCircle.centerY - ny * toCircle.radius;

    conn.line.setAttribute("x1", x1);
    conn.line.setAttribute("y1", y1);
    conn.line.setAttribute("x2", x2);
    conn.line.setAttribute("y2", y2);
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
  let touchTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;

  function cancelTouchStart() {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    wrapper.removeEventListener("pointermove", onTouchMoveBeforeDrag);
    wrapper.removeEventListener("pointerup", cancelTouchStart);
    wrapper.removeEventListener("pointercancel", cancelTouchStart);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    const dx = (clientX - startX) / scale;
    const dy = (clientY - startY) / scale;
    const areaRect = nodeArea.getBoundingClientRect();
    const areaWidth = areaRect.width / scale;
    const areaHeight = areaRect.height / scale;
    const nodeWidth = wrapper.offsetWidth / scale;
    const nodeHeight = wrapper.offsetHeight / scale;
    let newX = initialX + dx;
    let newY = initialY + dy;

    newX = Math.max(0, Math.min(newX, areaWidth - nodeWidth));
    newY = Math.max(0, Math.min(newY, areaHeight - nodeHeight));

    const centerX = newX + nodeWidth / 2;
    const centerY = newY + nodeHeight / 2;

    const collides = nodes.some(function (other) {
      if (other.id === nodeId) return false;
      const otherCenterX = other.x + nodeWidth / 2;
      const otherCenterY = other.y + nodeHeight / 2;
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
    cancelTouchStart();

    try {
      wrapper.releasePointerCapture(event.pointerId);
    } catch (e) {}

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
  }

  function onTouchMoveBeforeDrag(event) {
    const dx = Math.abs(event.clientX - touchStartX);
    const dy = Math.abs(event.clientY - touchStartY);
    if (dx > 10 || dy > 10) {
      cancelTouchStart();
      wrapper.removeEventListener("pointermove", onTouchMoveBeforeDrag);
      wrapper.removeEventListener("pointerup", cancelTouchStart);
      wrapper.removeEventListener("pointercancel", cancelTouchStart);
    }
  }

  wrapper.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".node-label-input, .node-add, .node-del")) return;

    const areaRect = nodeArea.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    if (event.pointerType === "touch") {
      touchStartX = event.clientX;
      touchStartY = event.clientY;
      touchTimer = setTimeout(() => {
        touchTimer = null;
        wrapper.removeEventListener("pointermove", onTouchMoveBeforeDrag);
        wrapper.removeEventListener("pointerup", cancelTouchStart);
        wrapper.removeEventListener("pointercancel", cancelTouchStart);
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        initialX = (wrapperRect.left - areaRect.left) / scale;
        initialY = (wrapperRect.top - areaRect.top) / scale;
        try {
          wrapper.setPointerCapture(event.pointerId);
        } catch (e) {}
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
      }, 300);
      wrapper.addEventListener("pointermove", onTouchMoveBeforeDrag);
      wrapper.addEventListener("pointerup", cancelTouchStart);
      wrapper.addEventListener("pointercancel", cancelTouchStart);
      return;
    }

    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    initialX = (wrapperRect.left - areaRect.left) / scale;
    initialY = (wrapperRect.top - areaRect.top) / scale;
    try {
      wrapper.setPointerCapture(event.pointerId);
    } catch (e) {}
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
  });
}

rootButton.addEventListener("click", addRootNode);
window.addEventListener("resize", updateConnections);
addRootNode();
updateStats();