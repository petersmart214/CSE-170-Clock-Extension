// Content script that runs on all web pages
// Displays FocusGuard notifications directly on the page being viewed

console.log('[FocusGuard Content] Script loaded on', window.location.href);

try {
  console.log('[FocusGuard Content] Chrome API available:', typeof chrome !== 'undefined');
  console.log('[FocusGuard Content] Runtime available:', typeof chrome.runtime !== 'undefined');
  console.log('[FocusGuard Content] SendMessage available:', typeof chrome.runtime.sendMessage !== 'undefined');
} catch (e) {
  console.error('[FocusGuard Content] Chrome API check failed:', e);
}

// Track recent notifications to avoid excessive repetition
const notificationHistory = {};
const DEDUP_TIMEOUT = 5000; // Don't show same notification type within 5 seconds

/**
 * Create and display a notification on the current webpage
 */
function displayNotification(title, message, type = 'info', duration = 3000, dedupKey = null) {
  console.log('[FocusGuard Notification] Creating:', title, message, type);
  
  try {
    // Check for duplicate notifications
    if (dedupKey && notificationHistory[dedupKey]) {
      const timeSinceLastNotification = Date.now() - notificationHistory[dedupKey];
      if (timeSinceLastNotification < DEDUP_TIMEOUT) {
        console.log('[FocusGuard Notification] Skipped duplicate');
        return;
      }
    }

    // Record this notification
    if (dedupKey) {
      notificationHistory[dedupKey] = Date.now();
    }

    // Ensure body exists
    const attemptDisplay = () => {
      if (!document.body) {
        console.log('[FocusGuard Notification] Waiting for body...');
        setTimeout(attemptDisplay, 50);
        return;
      }

      // Remove any existing notifications
      const existingContainer = document.getElementById('focusGuardNotificationContainer');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create notification container
      const notification = document.createElement('div');
      notification.className = `focusGuard-notification focusGuard-notification-${type}`;
      
      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'focusGuard-notification-close';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Close notification');
      
      // Create content
      const content = document.createElement('div');
      content.className = 'focusGuard-notification-content';
      
      const titleEl = document.createElement('div');
      titleEl.className = 'focusGuard-notification-title';
      titleEl.textContent = title;
      
      const messageEl = document.createElement('div');
      messageEl.className = 'focusGuard-notification-message';
      messageEl.textContent = message;
      
      content.appendChild(titleEl);
      content.appendChild(messageEl);
      notification.appendChild(closeBtn);
      notification.appendChild(content);
      
      // Create container
      const container = document.createElement('div');
      container.id = 'focusGuardNotificationContainer';
      container.className = 'focusGuard-notification-container';
      document.body.appendChild(container);
      container.appendChild(notification);
      
      console.log('[FocusGuard Notification] Displayed on DOM at', window.location.href);
      
      // Close button handler
      const closeNotification = () => {
        notification.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      };
      
      closeBtn.addEventListener('click', closeNotification);
      
      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(closeNotification, duration);
      }
    };

    attemptDisplay();
  } catch (error) {
    console.error('[FocusGuard Notification] Error:', error);
  }
}

/**
 * Inject CSS styling for notifications
 */
function injectNotificationStyles() {
  if (document.getElementById('focusGuardNotificationStyles')) {
    console.log('[FocusGuard Styles] Already injected');
    return; // Already injected
  }

  const attemptInject = () => {
    if (!document.head) {
      console.log('[FocusGuard Styles] Waiting for head...');
      setTimeout(attemptInject, 50);
      return;
    }

    const style = document.createElement('style');
    style.id = 'focusGuardNotificationStyles';
    style.textContent = `
      .focusGuard-notification-container {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 999999 !important;
        max-width: 400px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }

      .focusGuard-notification {
        display: flex !important;
        align-items: flex-start !important;
        gap: 12px !important;
        padding: 16px 20px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        animation: focusGuardSlideIn 0.3s ease-out !important;
        word-wrap: break-word !important;
        max-width: 100% !important;
        pointer-events: auto !important;
        position: relative !important;
        border: 1px solid !important;
      }

      @keyframes focusGuardSlideIn {
        from {
          transform: translateX(450px) !important;
          opacity: 0 !important;
        }
        to {
          transform: translateX(0) !important;
          opacity: 1 !important;
        }
      }

      /* Notification Types */
      .focusGuard-notification-success {
        background-color: #d4edda !important;
        border-color: #c3e6cb !important;
        color: #155724 !important;
      }

      .focusGuard-notification-warning {
        background-color: #fff3cd !important;
        border-color: #ffeaa7 !important;
        color: #856404 !important;
      }

      .focusGuard-notification-error {
        background-color: #f8d7da !important;
        border-color: #f5c6cb !important;
        color: #721c24 !important;
      }

      .focusGuard-notification-info {
        background-color: #d1ecf1 !important;
        border-color: #bee5eb !important;
        color: #0c5460 !important;
      }

      /* Notification Content */
      .focusGuard-notification-content {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        flex: 1 !important;
      }

      .focusGuard-notification-title {
        font-weight: 600 !important;
        font-size: 15px !important;
        margin: 0 !important;
      }

      .focusGuard-notification-message {
        font-size: 13px !important;
        opacity: 0.9 !important;
        margin: 0 !important;
      }

      /* Close Button */
      .focusGuard-notification-close {
        flex-shrink: 0 !important;
        background: none !important;
        border: none !important;
        font-size: 20px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        opacity: 0.6 !important;
        padding: 0 !important;
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: opacity 0.2s ease !important;
        color: inherit !important;
      }

      .focusGuard-notification-close:hover {
        opacity: 1 !important;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .focusGuard-notification-success {
          background-color: #1e4620 !important;
          border-color: #2d5a3d !important;
          color: #a6e3a1 !important;
        }

        .focusGuard-notification-warning {
          background-color: #4a3f1f !important;
          border-color: #6b5a2f !important;
          color: #f0d586 !important;
        }

        .focusGuard-notification-error {
          background-color: #5a1f1f !important;
          border-color: #7a2f2f !important;
          color: #ff9a9a !important;
        }

        .focusGuard-notification-info {
          background-color: #1f3a4a !important;
          border-color: #2f5a6a !important;
          color: #7fc3e6 !important;
        }
      }
    `;
    document.head.appendChild(style);
    console.log('[FocusGuard Styles] Successfully injected');
  };

  attemptInject();
}

/**
 * Listen for timer phase changes
 */
function initializeTimerListener() {
  console.log('[FocusGuard Timer] Initializing timer listener');
  let lastPhase = null;
  let lastNotificationPhase = null;
  let checkCount = 0;

  const timerInterval = setInterval(() => {
    checkCount++;
    
    try {
      chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state) => {
        if (chrome.runtime.lastError) {
          console.error('[FocusGuard Timer] Message error:', chrome.runtime.lastError);
          return;
        }

        if (!state) {
          if (checkCount % 30 === 0) {
            console.log('[FocusGuard Timer] No state returned (check #' + checkCount + ')');
          }
          return;
        }

        // Log every 30 checks
        if (checkCount % 30 === 0) {
          console.log('[FocusGuard Timer] Check #' + checkCount + ': Phase=' + state.phase + ', TimeRemaining=' + state.timeRemaining + ', LastPhase=' + lastPhase);
        }

        // Detect phase change
        if (lastPhase && lastPhase !== state.phase && lastNotificationPhase !== state.phase) {
          console.log('[FocusGuard Timer] PHASE CHANGE DETECTED!', lastPhase, '->', state.phase);
          
          if (state.phase === 'BREAK') {
            console.log('[FocusGuard Timer] Sending BREAK notification to background');
            chrome.runtime.sendMessage({
              action: 'SHOW_BREAK_NOTIFICATION'
            });
            lastNotificationPhase = 'BREAK';
          } else if (state.phase === 'WORK') {
            console.log('[FocusGuard Timer] Sending WORK notification to background');
            chrome.runtime.sendMessage({
              action: 'SHOW_WORK_NOTIFICATION'
            });
            lastNotificationPhase = 'WORK';
          }
        }

        lastPhase = state.phase;
      });
    } catch (error) {
      console.error('[FocusGuard Timer] Error in timer check:', error);
    }
  }, 1000);
}

/**
 * Listen for blacklist/whitelist violations
 */
function initializeSiteMonitoring() {
  console.log('[FocusGuard Site Monitor] Initializing');
  
  try {
    chrome.storage.local.get(['blacklist', 'whitelist'], (data) => {
      const blacklist = data.blacklist || [];
      const whitelist = data.whitelist || [];
      console.log('[FocusGuard Site Monitor] Blacklist:', blacklist);
      console.log('[FocusGuard Site Monitor] Whitelist:', whitelist);
      
      // Check current page
      checkCurrentPage(blacklist, whitelist);
      
      // Listen for navigation
      let lastUrl = window.location.href;
      setInterval(() => {
        if (lastUrl !== window.location.href) {
          console.log('[FocusGuard Site Monitor] URL changed to:', window.location.href);
          lastUrl = window.location.href;
          checkCurrentPage(blacklist, whitelist);
        }
      }, 100);
    });
  } catch (error) {
    console.error('[FocusGuard Site Monitor] Error:', error);
  }
}

/**
 * Check if current page matches blacklist/whitelist
 */
function checkCurrentPage(blacklist, whitelist) {
  const url = window.location.href;
  const domain = window.location.hostname;
  
  function isBlacklisted(url, blacklist) {
    try {
      const domain = new URL(url).hostname;
      return blacklist.some(item => domain.includes(item) || url.includes(item));
    } catch {
      return false;
    }
  }

  function isWhitelisted(url, whitelist) {
    if (!whitelist || whitelist.length === 0) return true;
    try {
      const domain = new URL(url).hostname;
      return whitelist.some(item => domain.includes(item) || url.includes(item));
    } catch {
      return false;
    }
  }

  // Check if site is blacklisted
  if (isBlacklisted(url, blacklist)) {
    console.log('[FocusGuard Site Monitor] Sending blacklist violation notification');
    chrome.runtime.sendMessage({
      action: 'SHOW_BLACKLIST_NOTIFICATION',
      domain: domain
    });
  }
  // Check if site is not on whitelist (if whitelist is enabled)
  else if (whitelist.length > 0 && !isWhitelisted(url, whitelist)) {
    console.log('[FocusGuard Site Monitor] Sending whitelist violation notification');
    chrome.runtime.sendMessage({
      action: 'SHOW_WHITELIST_NOTIFICATION',
      domain: domain
    });
  }
}

/**
 * Listen for inactivity on this page
 */
function initializeInactivityTracking() {
  console.log('[FocusGuard Inactivity] Initializing');
  
  const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes
  let inactivityTimer = null;
  let lastInactivityNotificationTime = 0;
  
  function resetInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    
    inactivityTimer = setTimeout(() => {
      console.log('[FocusGuard Inactivity] 3 minute timeout triggered');
      const now = Date.now();
      if (now - lastInactivityNotificationTime > 10 * 60 * 1000) {
        lastInactivityNotificationTime = now;
        console.log('[FocusGuard Inactivity] Sending inactivity notification to background');
        chrome.runtime.sendMessage({
          action: 'SHOW_INACTIVITY_NOTIFICATION'
        });
      }
    }, INACTIVITY_TIMEOUT);
  }

  // Listen for user activity
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  document.addEventListener('click', resetInactivityTimer);
  document.addEventListener('scroll', resetInactivityTimer);
  document.addEventListener('touchstart', resetInactivityTimer);
  
  console.log('[FocusGuard Inactivity] Event listeners registered');
  
  resetInactivityTimer();
}  
  // Listen for user activity
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  document.addEventListener('click', resetInactivityTimer);
  document.addEventListener('scroll', resetInactivityTimer);
  document.addEventListener('touchstart', resetInactivityTimer);
  
  console.log('[FocusGuard Inactivity] Event listeners registered');
  
  resetInactivityTimer();


// Content script that runs on all web pages
// Displays FocusGuard notifications directly on the page being viewed

console.log('[FocusGuard Content] Script loaded on', window.location.href);

try {
  console.log('[FocusGuard Content] Chrome API available:', typeof chrome !== 'undefined');
  console.log('[FocusGuard Content] Runtime available:', typeof chrome.runtime !== 'undefined');
  console.log('[FocusGuard Content] SendMessage available:', typeof chrome.runtime.sendMessage !== 'undefined');
} catch (e) {
  console.error('[FocusGuard Content] Chrome API check failed:', e);
}

// Test basic functionality
console.log('[FocusGuard Content] Document body exists:', !!document.body);
console.log('[FocusGuard Content] Document head exists:', !!document.head);

// Initialize when page is loaded
console.log('[FocusGuard Init] Document readyState:', document.readyState);

if (document.readyState === 'loading') {
  console.log('[FocusGuard Init] Waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[FocusGuard Init] DOMContentLoaded fired, initializing');
    try {
      injectNotificationStyles();
      initializeTimerListener();
      initializeSiteMonitoring();
      initializeInactivityTracking();
      console.log('[FocusGuard Init] All systems initialized');
    } catch (error) {
      console.error('[FocusGuard Init] Initialization error:', error);
    }
  });
} else {
  console.log('[FocusGuard Init] Document already loaded, initializing now');
  try {
    injectNotificationStyles();
    initializeTimerListener();
    initializeSiteMonitoring();
    initializeInactivityTracking();
    console.log('[FocusGuard Init] All systems initialized');
  } catch (error) {
    console.error('[FocusGuard Init] Initialization error:', error);
  }
}
// content/content.js
// FocusGuard — Main content script orchestrating activity monitoring, inactivity detection, and site enforcement.
//
// Dependencies: activity-tracker.js, inactivity-monitor.js, website-monitor.js, ui-manager.js
//
// Reads from chrome.storage.sync:
//   isSessionActive    {boolean}  — whether a focus session is currently running
//   allowedSites       {string[]} — hostnames the user is allowed to visit
//   inactivityEnabled  {boolean}  — whether inactivity alerts are on
//   inactivityTimeout  {number}   — minutes before inactivity alert fires

let isSessionActive = false;
let activityTracker = null;
let inactivityMonitor = null;
let websiteMonitor = null;
let uiManager = null;
let currentInactivityTimeout = 10; // minutes, kept in sync with storage

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function initializeModules() {
  websiteMonitor = new WebsiteMonitor();
  uiManager = new UIManager();

  inactivityMonitor = new InactivityMonitor(
    () => onInactivityTriggered(),
    () => onInactivityReset()
  );

  activityTracker = new ActivityTracker(
    () => onUserActivity()
  );
}

// ---------------------------------------------------------------------------
// Inactivity and Activity Handlers
// ---------------------------------------------------------------------------

function onInactivityTriggered() {
  uiManager.showInactivityBanner(() => onDismissInactivityBanner(), currentInactivityTimeout);
}

function onDismissInactivityBanner() {
  uiManager.removeInactivityBanner();
  inactivityMonitor.reset();
}

function onInactivityReset() {
  uiManager.removeInactivityBanner();
}

function onUserActivity() {
  if (inactivityMonitor) {
    inactivityMonitor.reset();
  }
}

// ---------------------------------------------------------------------------
// Site Monitoring
// ---------------------------------------------------------------------------

function startMonitoring(allowedSites, inactivityEnabled, inactivityTimeout) {
  currentInactivityTimeout = inactivityTimeout;
  if (!websiteMonitor.isSiteAllowed(allowedSites)) {
    uiManager.showBlockedSiteWarning();
  }

  inactivityMonitor.configure(inactivityEnabled, inactivityTimeout);
  activityTracker.start();
  inactivityMonitor.start();
}

function stopMonitoring() {
  if (activityTracker) activityTracker.stop();
  if (inactivityMonitor) inactivityMonitor.stop();
  if (uiManager) uiManager.hideAll();
}

// ---------------------------------------------------------------------------
// Storage Listeners
// ---------------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  // Session toggled
  if (changes.isSessionActive !== undefined) {
    const wasActive = isSessionActive;
    isSessionActive = !!changes.isSessionActive.newValue;

    if (isSessionActive && !wasActive) {
      chrome.storage.sync.get(
        ['allowedSites', 'inactivityEnabled', 'inactivityTimeout'],
        (data) => {
          startMonitoring(
            data.allowedSites || [],
            data.inactivityEnabled !== false,
            data.inactivityTimeout || 10
          );
        }
      );
    } else if (!isSessionActive && wasActive) {
      stopMonitoring();
    }
  }

  // Allowed-sites list updated while session is running
  if (changes.allowedSites !== undefined && isSessionActive) {
    const updatedList = changes.allowedSites.newValue || [];
    if (!websiteMonitor.isSiteAllowed(updatedList)) {
      uiManager.showBlockedSiteWarning();
    } else {
      uiManager.removeBlockedOverlay();
    }
  }

  // Inactivity settings changed while session is running
  if ((changes.inactivityEnabled !== undefined || changes.inactivityTimeout !== undefined) && isSessionActive) {
    chrome.storage.sync.get(['inactivityEnabled', 'inactivityTimeout'], (data) => {
      currentInactivityTimeout = data.inactivityTimeout || 10;
      inactivityMonitor.configure(data.inactivityEnabled !== false, currentInactivityTimeout);
      inactivityMonitor.reset();
    });
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function initSession() {
  initializeModules();

  chrome.storage.sync.get(
    ['isSessionActive', 'allowedSites', 'inactivityEnabled', 'inactivityTimeout'],
    (data) => {
      isSessionActive = !!data.isSessionActive;
      if (!isSessionActive) return;
      startMonitoring(
        data.allowedSites || [],
        data.inactivityEnabled !== false,
        data.inactivityTimeout || 10
      );
    }
  );
}

initSession();
