const tg = window.Telegram.WebApp;
tg.expand();

let startTime = null;
let interval = null;

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

    statusEl.textContent = "Завершено";

    tg.sendData("stop");
};

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");

    timerEl.textContent = `${h}:${m}:${s}`;

    document.getElementById("resetBtn").onclick = () => {
        clearInterval(interval);
        interval = null;
        startTime = null;
        timerEl.textContent = "00:00:00";
        statusEl.textContent = "Остановлено";
        tg.sendData("reset");
    };
}