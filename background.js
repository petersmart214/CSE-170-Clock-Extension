// background.js
// FocusGuard Background Service Worker
// Uses chrome.alarms for persistence — MV3 service workers can be terminated at any time,
// so setInterval is unreliable. Timer state is stored in chrome.storage.local.

let timerState = {
  isRunning: false,
  phase: 'WORK', // 'WORK' or 'BREAK'
  timeRemaining: 0,
  workDuration: 60 * 60, // Default 1 hour in seconds
  breakDuration: 20 * 60, // Default 20 mins in seconds
};

let timerInterval = null;
let inactivityNotificationActive = false;
const inactivityNotificationId = 'focusguard_inactivity';

// The heartbeat function
function tick() {
  if (timerState.timeRemaining > 0) {
    timerState.timeRemaining--;
  } else {
    switchPhase();
  }
// ---------------------------------------------------------------------------
// Installation defaults
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    ['allowedSites', 'isSessionActive', 'inactivityEnabled', 'inactivityTimeout'],
    (data) => {
      const defaults = {};
      if (!data.allowedSites)                   defaults.allowedSites = [];
      if (data.isSessionActive === undefined)    defaults.isSessionActive = false;
      if (data.inactivityEnabled === undefined)  defaults.inactivityEnabled = true;
      if (data.inactivityTimeout === undefined)  defaults.inactivityTimeout = 10; // minutes
      if (Object.keys(defaults).length) chrome.storage.sync.set(defaults);
    }
  );

  // Initialize persisted timer states
  chrome.storage.local.set({
    pomodoroState: {
      isRunning: false, phase: 'WORK', endTime: null,
      remainingSeconds: 0, workDuration: 3600, breakDuration: 1200,
    },
    countdownState: {
      isRunning: false, endTime: null, remainingSeconds: 0, duration: 1500,
    },
  });
});

// ---------------------------------------------------------------------------
// Pomodoro helpers
// ---------------------------------------------------------------------------

function pomodoroStart(workDuration, breakDuration, phase, remainingSeconds) {
  const endTime = Date.now() + remainingSeconds * 1000;
  chrome.storage.local.set({
    pomodoroState: {
      isRunning: true, phase, endTime,
      remainingSeconds: 0, workDuration, breakDuration,
    },
  });
  chrome.alarms.clear('pomodoroEnd', () => {
    chrome.alarms.create('pomodoroEnd', { when: endTime });
  });
}

function pomodoroSwitchPhase(currentState) {
  const { phase, workDuration, breakDuration } = currentState;
  const nextPhase = phase === 'WORK' ? 'BREAK' : 'WORK';
  const nextDuration = nextPhase === 'WORK' ? workDuration : breakDuration;
  const endTime = Date.now() + nextDuration * 1000;

  chrome.storage.local.set({
    pomodoroState: {
      isRunning: true, phase: nextPhase, endTime,
      remainingSeconds: 0, workDuration, breakDuration,
    },
  });
  chrome.alarms.create('pomodoroEnd', { when: endTime });

  chrome.notifications.create(`pomodoro_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'FocusGuard',
    message: nextPhase === 'BREAK'
      ? 'Great job! Time for a break.'
      : 'Break is over. Time to focus!',
  });
}

// ---------------------------------------------------------------------------
// Countdown helpers
// ---------------------------------------------------------------------------

function countdownStart(duration, remainingSeconds) {
  const endTime = Date.now() + remainingSeconds * 1000;
  chrome.storage.local.set({
    countdownState: { isRunning: true, endTime, remainingSeconds: 0, duration },
  });
  chrome.alarms.clear('countdownEnd', () => {
    chrome.alarms.create('countdownEnd', { when: endTime });
  });
}

// ---------------------------------------------------------------------------
// Alarm handler — fires when a timer phase expires
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroEnd') {
    chrome.storage.local.get(['pomodoroState'], ({ pomodoroState }) => {
      if (pomodoroState && pomodoroState.isRunning) {
        pomodoroSwitchPhase(pomodoroState);
      }
    });
  } else if (alarm.name === 'countdownEnd') {
    chrome.storage.local.get(['countdownState'], ({ countdownState }) => {
      if (countdownState && countdownState.isRunning) {
        chrome.storage.local.set({
          countdownState: {
            isRunning: false, endTime: null, remainingSeconds: 0,
            duration: countdownState.duration || 0,
          },
        });
        chrome.notifications.create(`countdown_${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'FocusGuard',
          message: 'Time is up! Great work.',
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // --- Pomodoro: get state ---
  if (message.action === 'POMODORO_GET_STATE') {
    chrome.storage.local.get(['pomodoroState'], ({ pomodoroState }) => {
      const state = pomodoroState || {
        isRunning: false, phase: 'WORK', remainingSeconds: 0,
        workDuration: 3600, breakDuration: 1200,
      };
      // Compute live remaining time when running
      if (state.isRunning && state.endTime) {
        state.remainingSeconds = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
      }
      sendResponse(state);
    });
    return true; // async
  }

  // --- Pomodoro: start / resume ---
  if (message.action === 'POMODORO_START') {
    chrome.storage.local.get(['pomodoroState'], ({ pomodoroState }) => {
      const state = pomodoroState || {};
      if (!state.isRunning) {
        const workDuration = message.workTime;
        const breakDuration = message.breakTime;
        const phase = state.phase || 'WORK';
        // Resume from paused remainder, or start fresh
        const remaining = (state.remainingSeconds > 0) ? state.remainingSeconds : workDuration;
        pomodoroStart(workDuration, breakDuration, phase, remaining);
      }
      sendResponse({ status: 'started' });
    });
    return true;
  }

  // --- Pomodoro: pause ---
  if (message.action === 'POMODORO_PAUSE') {
    chrome.alarms.clear('pomodoroEnd');
    chrome.storage.local.get(['pomodoroState'], ({ pomodoroState }) => {
      if (pomodoroState && pomodoroState.isRunning && pomodoroState.endTime) {
        const remaining = Math.max(0, Math.round((pomodoroState.endTime - Date.now()) / 1000));
        chrome.storage.local.set({
          pomodoroState: {
            ...pomodoroState, isRunning: false, endTime: null, remainingSeconds: remaining,
          },
        });
      }
      sendResponse({ status: 'paused' });
    });
    return true;
  }

  // --- Pomodoro: reset ---
  if (message.action === 'POMODORO_RESET') {
    chrome.alarms.clear('pomodoroEnd');
    const reset = {
      isRunning: false, phase: 'WORK', endTime: null,
      remainingSeconds: 0, workDuration: 3600, breakDuration: 1200,
    };
    chrome.storage.local.set({ pomodoroState: reset });
    sendResponse(reset);
  }

  else if (message.action === 'SHOW_INACTIVITY_NOTIFICATION') {
    if (!inactivityNotificationActive) {
      inactivityNotificationActive = true;
      chrome.notifications.create(inactivityNotificationId, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'FocusGuard',
        message: 'No activity detected. Get back to work when you\'re ready.',
        requireInteraction: true
      });
    } else {
      console.log('[background] Inactivity notification already active, skipping');
    }
  }

  else if (message.action === 'SHOW_ACTIVITY_RESUMED') {
    if (inactivityNotificationActive) {
      inactivityNotificationActive = false;
      chrome.notifications.clear(inactivityNotificationId);
      console.log('[background] Activity resumed, cleared inactivity notification');
    }
  }

  else if (message.action === 'SHOW_BREAK_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusGuard',
      message: 'Great job! Time for a break.'
    });
  }

  else if (message.action === 'SHOW_WORK_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusGuard',
      message: 'Break is over. Time to focus!'
    });
  }

  else if (message.action === 'SHOW_BLACKLIST_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusGuard',
      message: `Distraction detected on ${message.domain}. Consider focusing on your work instead.`
    });
  }

  else if (message.action === 'SHOW_WHITELIST_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'FocusGuard',
      message: `Off-topic site detected. Stay on track with your goals.`
    });
  }

  // Keep the message channel open for async responses
  return true; 
});
  // --- Countdown: get state ---
  if (message.action === 'COUNTDOWN_GET_STATE') {
    chrome.storage.local.get(['countdownState'], ({ countdownState }) => {
      const state = countdownState || {
        isRunning: false, remainingSeconds: 0, duration: 1500,
      };
      if (state.isRunning && state.endTime) {
        state.remainingSeconds = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
      }
      sendResponse(state);
    });
    return true;
  }

  // --- Countdown: start / resume ---
  if (message.action === 'COUNTDOWN_START') {
    chrome.storage.local.get(['countdownState'], ({ countdownState }) => {
      const state = countdownState || {};
      if (!state.isRunning) {
        const duration = message.duration;
        // Resume from paused remainder, or start fresh
        const remaining = (state.remainingSeconds > 0) ? state.remainingSeconds : duration;
        countdownStart(duration, remaining);
        sendResponse({ status: 'started' });
      } else {
        sendResponse({ status: 'already_running' });
      }
    });
    return true;
  }

  // --- Countdown: pause ---
  if (message.action === 'COUNTDOWN_PAUSE') {
    chrome.alarms.clear('countdownEnd');
    chrome.storage.local.get(['countdownState'], ({ countdownState }) => {
      if (countdownState && countdownState.isRunning && countdownState.endTime) {
        const remaining = Math.max(0, Math.round((countdownState.endTime - Date.now()) / 1000));
        chrome.storage.local.set({
          countdownState: {
            ...countdownState, isRunning: false, endTime: null, remainingSeconds: remaining,
          },
        });
      }
      sendResponse({ status: 'paused' });
    });
    return true;
  }

  // --- Countdown: reset ---
  if (message.action === 'COUNTDOWN_RESET') {
    chrome.alarms.clear('countdownEnd');
    const reset = {
      isRunning: false, endTime: null, remainingSeconds: 0,
      duration: message.duration || 1500,
    };
    chrome.storage.local.set({ countdownState: reset });
    sendResponse(reset);
  }

  // --- Session toggle ---
  if (message.action === 'SET_SESSION') {
    chrome.storage.sync.set({ isSessionActive: message.isActive });
    sendResponse({ status: 'ok', isActive: message.isActive });
  }

  // --- Reserved ---
  if (message.type === 'SHOW_NOTIFICATION') {
    sendResponse({ success: true });
  }
});
