const tg = window.Telegram.WebApp;
tg.expand();

let startTime = null;
let interval = null;
let accumulatedTime = 0;

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

document.getElementById("startBtn").onclick = () => {
    if (interval) return;

    startTime = Date.now();
    statusEl.textContent = "В процессе";

    interval = setInterval(updateTimer, 1000);

    tg.sendData("start");
};

document.getElementById("stopBtn").onclick = () => {
    if (!interval) return;

    clearInterval(interval);
    interval = null;

    accumulatedTime += Date.now() - startTime;

    statusEl.textContent = "Завершено";

    tg.sendData("stop");
};

document.getElementById("resetBtn").onclick = () => {
    clearInterval(interval);
    interval = null;

    startTime = null;
    accumulatedTime = 0;

    timerEl.textContent = "00:00:00";
    statusEl.textContent = "Остановлено";

    tg.sendData("reset");
};

function updateTimer() {
    const current = Date.now() - startTime;
    const total = accumulatedTime + current;

    const totalSeconds = Math.floor(total / 1000);

    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");

    timerEl.textContent = `${h}:${m}:${s}`;
}

const fab = document.getElementById("fabMain");
const options = document.getElementById("fabOptions");

let pressTimer = null;

fab.addEventListener("mousedown", startPress);
fab.addEventListener("touchstart", startPress);

fab.addEventListener("mouseup", cancelPress);
fab.addEventListener("mouseleave", cancelPress);
fab.addEventListener("touchend", cancelPress);

function startPress() {
    pressTimer = setTimeout(() => {
        options.style.display = "flex";
    }, 300);
}

function cancelPress() {
    clearTimeout(pressTimer);
}
const buttons = document.querySelectorAll(".opt");

let isHolding = false;

fab.addEventListener("mousedown", () => {
    isHolding = true;
    options.style.display = "block";
});

document.addEventListener("mouseup", () => {
    if (!isHolding) return;

    const active = document.querySelector(".opt.active");
    if (active) {
        const page = active.dataset.page;
    }

    options.style.display = "none";
    clearActive();
    isHolding = false;
});

document.addEventListener("mousemove", (    e) => {
    if (!isHolding) return;

    let closest = null;
    let minDist = Infinity;

    buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

        if (dist < minDist) {
            minDist = dist;
            closest = btn;
        }
    });

    clearActive();
    if (closest) closest.classList.add("active");
});

function clearActive() {
    buttons.forEach(b => b.classList.remove("active"));
}