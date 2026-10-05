import { useState } from "react";
import { api } from "../api.js";
import { Sheet } from "./ui.jsx";
import { LayoutName, ParsGrid } from "./ParsEditor.jsx";

/** Edit course name, which nines are being played and their pars, any time (even mid-round). */
export function CourseForm({ round, a, onDone }) {
  const [name, setName] = useState(round.name || "");
  const [courseName, setCourseName] = useState(round.courseName);
  const [pars, setPars] = useState(round.pars);
  const [saveNew, setSaveNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await a.run(() => a.patch({ name, pars, courseName }), "Course updated");
    if (saveNew && name.trim()) {
      try {
        let state = "Other";
        if (round.courseId) state = (await api(`/courses/${round.courseId}`)).course.state;
        await api("/courses", { method: "POST", body: { name: `${courseName} (${name.trim()})`, state, holes: pars.map(par => ({ par })) } });
        a.toast("Saved to the course list too");
      } catch (e) { a.toast(e.message); }
    }
    setBusy(false);
    onDone?.();
  };

  return (
    <div className="stack">
      <div className="field"><label>Course</label><input value={courseName} maxLength={160} onChange={e => setCourseName(e.target.value)} /></div>
      <LayoutName value={name} onChange={setName} />
      <ParsGrid pars={pars} onChange={setPars} />
      <label className="row" style={{ fontWeight: 500 }}>
        <input type="checkbox" style={{ width: 22, height: 22 }} checked={saveNew} onChange={e => setSaveNew(e.target.checked)} />
        <span>Also add this layout to the course list for next time</span>
      </label>
      <button className="btn block" disabled={busy} onClick={save}>Save course</button>
    </div>
  );
}

export default function CourseSheet({ round, a, onClose }) {
  return (
    <Sheet title="Course & pars" onClose={onClose}>
      <CourseForm round={round} a={a} onDone={onClose} />
    </Sheet>
  );
}
