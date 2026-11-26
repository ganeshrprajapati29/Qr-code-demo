import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { LangSwitch } from '../i18n.jsx';
import { t } from '../i18n.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError(t('यूज़रनेम और पासवर्ड डालें'));
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <LangSwitch className="login-lang" />
        <img src="/icon.svg" alt="" width="72" height="72" />
        <h1>{t('सुरक्षित गेट')}</h1>
        <p className="muted">{t('स्कूल QR आईडी कार्ड · गेट स्कैन · सुरक्षित पिकअप')}</p>
        <form onSubmit={submit} className="form" noValidate>
          <label className="field">
            <span>{t('यूज़रनेम')}</span>
            <input value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" inputMode="text" />
          </label>
          <label className="field">
            <span>{t('पासवर्ड')}</span>
            <div className="input-affix">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
              <button type="button" className="link" onClick={() => setShow(!show)}>{show ? t('छिपाएँ') : t('दिखाएँ')}</button>
            </div>
          </label>
          {error && <p className="alert alert-red" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? t('लॉगिन हो रहा है…') : t('लॉगिन करें')}</button>
        </form>
        <p className="tiny muted">{t('माँ-बाप को लॉगिन की ज़रूरत नहीं — उन्हें मैसेज में सुरक्षित लिंक मिलता है।')}</p>
      </div>
    </div>
  );
}
