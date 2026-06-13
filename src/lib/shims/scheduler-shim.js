/**
 * scheduler-shim.js — Scheduler Shim für Vite/ESM
 * 
 * React 19 hat "scheduler" als internes Modul integriert, aber einige
 * node_modules Dependencies importieren es noch als separates Paket.
 * Vite kann den bare import nicht auflösen → wir stellen einen Shim bereit.
 * 
 * Die exports entsprechen dem originalen scheduler-Package von React 18.
 */
const Scheduler = {};

// unstable schedule helpers (genutzt von react-dom)
Scheduler.unstable_scheduleCallback = (priority, callback) => {
  const id = setTimeout(callback, 0);
  return { _id: id };
};
Scheduler.unstable_cancelCallback = (node) => {
  if (node && node._id) clearTimeout(node._id);
};
Scheduler.unstable_shouldYield = () => false;
Scheduler.unstable_requestPaint = () => {};
Scheduler.unstable_now = () => performance.now();
Scheduler.unstable_getFirstCallbackNode = () => null;
Scheduler.unstable_runWithPriority = (priority, callback) => callback();
Scheduler.unstable_wrapCallback = (callback) => callback;
Scheduler.unstable_getCurrentPriorityLevel = () => 3;
Scheduler.unstable_ImmediatePriority = 1;
Scheduler.unstable_UserBlockingPriority = 2;
Scheduler.unstable_NormalPriority = 3;
Scheduler.unstable_LowPriority = 4;
Scheduler.unstable_IdlePriority = 5;
Scheduler.unstable_forceFrameRate = () => {};
Scheduler.unstable_flushAll = () => {};
Scheduler.unstable_flushNumberOfYields = () => {};
Scheduler.unstable_flushExpired = () => {};

export default Scheduler;
export const {
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_shouldYield,
  unstable_requestPaint,
  unstable_now,
  unstable_getFirstCallbackNode,
  unstable_runWithPriority,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_LowPriority,
  unstable_IdlePriority,
  unstable_forceFrameRate,
  unstable_flushAll,
  unstable_flushNumberOfYields,
  unstable_flushExpired,
} = Scheduler;