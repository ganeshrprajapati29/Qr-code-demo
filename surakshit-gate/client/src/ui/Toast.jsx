import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const show = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current);
    setT({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setT(null), 3500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">{t && <div key={t.key} className={`toast toast-${t.tone}`} role="status">{t.message}</div>}</div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
