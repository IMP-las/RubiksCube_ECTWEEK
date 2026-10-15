const APP_FIELD_SEPARATOR = "|";

const appBridge = { bestMs: 0, seq: 0 };

function isInApp() {
  return Boolean(window.AppInventor);
}

function rememberBestForApp(ms) {
  appBridge.bestMs = Math.round(ms);
}

function readAppBestText() {
  return window.AppInventor.getWebViewString().split(APP_FIELD_SEPARATOR)[0];
}

function sendToApp(event) {
  if (!isInApp()) return;
  appBridge.seq++;
  const fields = [appBridge.bestMs, event, appBridge.seq];
  try {
    window.AppInventor.setWebViewString(fields.join(APP_FIELD_SEPARATOR));
  } catch (error) {
    // bridge not ready, the app just misses this one sound
  }
}
