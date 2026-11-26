import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../../api.js';
import Camera from '../../ui/Camera.jsx';
import { Photo, Spinner, ErrorBox } from '../../ui/bits.jsx';

const RELATIONS = ['पिता', 'माता', 'चाचा', 'चाची', 'मामा', 'दादा', 'दादी', 'नाना', 'भाई', 'बहन', 'ड्राइवर', 'पड़ोसी'];

export default function NewPickup() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get(`/gate/students/${studentId}`)
      .then((r) => {
        if (r.openPickupId) navigate(`/gate/pickup/${r.openPickupId}`, { replace: true });
        else setStudent(r.student);
      })
      .catch((e) => setError(e.message));
  }, [studentId, navigate]);

  async function send(e) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('लेने वाले का नाम लिखें');
    setBusy(true);
    try {
      const r = await post('/pickups', { studentId, pickerName: name.trim(), relation: relation.trim(), photo });
      navigate(`/gate/pickup/${r.pickup.id}`, { replace: true });
    } catch (err) {
      if (err.body?.pickupId) return navigate(`/gate/pickup/${err.body.pickupId}`, { replace: true });
      setError(err.message);
      setBusy(false);
    }
  }

  if (!student) return error ? <div className="page"><ErrorBox error={error} /></div> : <Spinner />;
  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/gate')}>← गेट</button>
      <div className="row gap center-v card">
        <Photo src={student.photoUrl} name={student.name} size={56} />
        <div><b>{student.name}</b><div className="muted">क्लास {student.className} · कोई और लेने आया है</div></div>
      </div>

      {!photo ? (
        <>
          <h2 className="step"><span>1</span> लेने वाले की फोटो लें</h2>
          <Camera onPhoto={setPhoto} />
        </>
      ) : (
        <form onSubmit={send} className="form">
          <h2 className="step"><span>2</span> नाम और रिश्ता लिखें</h2>
          <div className="picker-preview">
            <img src={photo} alt="लेने वाले की फोटो" />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPhoto('')}>दोबारा फोटो</button>
          </div>
          <label className="field">
            <span>लेने वाले का नाम</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="जैसे: राकेश कुमार" maxLength={60} autoFocus />
          </label>
          <div className="field">
            <span>रिश्ता</span>
            <div className="chips">
              {RELATIONS.map((r) => (
                <button type="button" key={r} className={relation === r ? 'chip-btn on' : 'chip-btn'} onClick={() => setRelation(r)}>{r}</button>
              ))}
            </div>
            <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="या खुद लिखें" maxLength={40} />
          </div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'भेजा जा रहा है…' : 'माँ-बाप को फोटो और OTP भेजो'}</button>
          <p className="tiny muted center">OTP सिर्फ माँ-बाप के फोन पर जाएगा। गार्ड को नहीं दिखेगा।</p>
        </form>
      )}
    </div>
  );
}
