// Lets a screen ask the floating rest timer to start, without the two knowing
// about each other (checking off a set on Log starts the rest).
type Listener = () => void;

const listeners = new Set<Listener>();

/** The rest timer listens here. Returns the function that stops listening. */
export function onRestRequested(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the rest timer to start (or restart) its countdown. */
export function requestRest(): void {
  listeners.forEach((listener) => listener());
}
