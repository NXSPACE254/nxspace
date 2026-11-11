export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();
  return {
    getState: () => ({ ...state }),
    setState(update) {
      state = { ...state, ...(typeof update === "function" ? update(state) : update) };
      listeners.forEach((listener) => listener({ ...state }));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
