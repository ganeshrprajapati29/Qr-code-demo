import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import EN from './i18n/en.js';

// Text is written in Hindi in the code; t() returns the English version when English is chosen.
// Use {name} placeholders for values: t('{n} बच्चे', { n: 5 })
const KEY = 'sg-lang';
function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'hi') return saved;
  } catch { /* storage blocked */ }
  return 'hi';
}

let current = initial();
export const getLang = () => current;

export function t(hi, vars) {
  let s = current === 'en' ? EN[hi] ?? hi : hi;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return s;
}

const Ctx = createContext({ lang: current, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);
  const setLang = useCallback((l) => {
    current = l === 'en' ? 'en' : 'hi';
    try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
    setLangState(current);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? 'Surakshit Gate' : 'सुरक्षित गेट';
  }, [lang]);
  // remount the app so every screen re-renders in the new language
  return <Ctx.Provider value={{ lang, setLang }}><div key={lang} className="lang-root">{children}</div></Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language / भाषा">
      <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')} aria-pressed={lang === 'hi'}>हिंदी</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English</button>
    </div>
  );
}
