const BEST_TIME_KEY = "ectCube.bestMs";

// Inside App Inventor the WebViewString can be saved by a TinyDB block; elsewhere localStorage keeps the best time
function readBestMs() {
  const sources = [
    () => isInApp() && readAppBestText(),
    () => localStorage.getItem(BEST_TIME_KEY),
  ];
  for (const read of sources) {
    try {
      const value = Number(read());
      if (value > 0) {
        rememberBestForApp(value);
        return value;
      }
    } catch (error) {
      // storage blocked, try the next source
    }
  }
  return null;
}

function writeBestMs(ms) {
  const text = String(Math.round(ms));
  rememberBestForApp(ms); // reaches App Inventor with the next sendToApp event
  try {
    localStorage.setItem(BEST_TIME_KEY, text);
  } catch (error) {
    // private mode or blocked storage, the best time only lasts for this session
  }
}
