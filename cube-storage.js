const BEST_TIME_KEY = 'ectCube.bestMs';

// Inside App Inventor the WebViewString can be saved by a TinyDB block; elsewhere localStorage keeps the best time
function readBestMs() {
  const sources = [
    () => window.AppInventor && window.AppInventor.getWebViewString(),
    () => localStorage.getItem(BEST_TIME_KEY),
  ];
  for (const read of sources) {
    try {
      const value = Number(read());
      if (value > 0) return value;
    } catch (error) {
      // storage blocked, try the next source
    }
  }
  return null;
}

function writeBestMs(ms) {
  const text = String(Math.round(ms));
  try {
    localStorage.setItem(BEST_TIME_KEY, text);
  } catch (error) {
    // private mode or blocked storage, the best time only lasts for this session
  }
  try {
    if (window.AppInventor) window.AppInventor.setWebViewString(text);
  } catch (error) {
    // not running inside App Inventor
  }
}
