"use strict";
window.chrome = {
  runtime: {
    // Minimal stub — enough to pass Google's presence check
    id: void 0,
    connect: () => void 0,
    sendMessage: () => void 0
  },
  loadTimes: () => ({}),
  csi: () => ({}),
  app: {}
};
Object.defineProperty(navigator, "webdriver", {
  get: () => false,
  configurable: true
});
