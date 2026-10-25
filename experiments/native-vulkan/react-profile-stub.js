// CPU profiler does not render UI. Explicitly fail if an unexpected React hook
// is reached so the benchmark cannot silently use fake gameplay behavior.
export function useEffect(){throw Error('CPU profiler must not call React hooks');}
export function useState(){throw Error('CPU profiler must not call React hooks');}
export function useRef(){throw Error('CPU profiler must not call React hooks');}
