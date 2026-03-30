// --- UI Logic ---
const timeDisplay = document.getElementById('timeDisplay');
const phaseDisplay = document.getElementById('phaseDisplay');
const workHours = document.getElementById('workHours');
const workMins = document.getElementById('workMins');
const breakHours = document.getElementById('breakHours');
const breakMins = document.getElementById('breakMins');

let localDisplayInterval;

// Helper to format seconds into HH:MM:SS
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Fetches the real time from the background worker and updates the HTML
function syncDisplay() {
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state) => {
    if (state) {
      timeDisplay.innerText = formatTime(state.timeRemaining);
      phaseDisplay.innerText = state.phase + " PHASE";
      
      if (state.isRunning && !localDisplayInterval) {
        // Keep the UI ticking locally every second while the popup is open
        localDisplayInterval = setInterval(syncDisplay, 1000);
      } else if (!state.isRunning) {
        clearInterval(localDisplayInterval);
        localDisplayInterval = null;
      }
    }
  });
}

// --- Button Listeners ---
document.getElementById('startBtn').addEventListener('click', () => {
  const wTime = (parseInt(workHours.value) || 0) * 3600 + (parseInt(workMins.value) || 0) * 60;
  const bTime = (parseInt(breakHours.value) || 0) * 3600 + (parseInt(breakMins.value) || 0) * 60;

  chrome.runtime.sendMessage({ 
    action: 'START', 
    workTime: wTime, 
    breakTime: bTime 
  }, () => {
    syncDisplay();
  });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'STOP' }, () => {
    syncDisplay();
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'RESET' }, () => {
    timeDisplay.innerText = "00:00:00";
    phaseDisplay.innerText = "WORK PHASE";
    syncDisplay();
  });
});

// Run once when the popup is opened
syncDisplay();