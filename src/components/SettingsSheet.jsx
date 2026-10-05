import { useState } from "react";
import GamePicker from "./GamePicker.jsx";
import MoneyForm from "./MoneyForm.jsx";
import PlayersEditor from "./PlayersEditor.jsx";
import { CourseForm } from "./CourseSheet.jsx";
import { Seg, Sheet } from "./ui.jsx";

/** Everything about the round, adjustable on the fly. */
export default function SettingsSheet({ round, a, onClose, start = "players" }) {
  const [tab, setTab] = useState(start);
  const [game, setGame] = useState(round.game);
  const [money, setMoney] = useState({ bets: round.bets, meal: round.meal });

  const saveGame = async () => { await a.run(() => a.patch({ game }), "Game updated"); };
  const saveMoney = async () => { await a.run(() => a.patch({ bets: money.bets, meal: money.meal }), "Bets & meal updated"); };

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="stack">
        <Seg value={tab} onChange={setTab} options={[["players", "Players"], ["game", "Game"], ["money", "Money"], ["course", "Course"]]} />
        {tab === "players" && <PlayersEditor round={round} a={a} />}
        {tab === "game" && (
          <>
            {round.status !== "setup" && <div className="warn">Changing the game re-scores the round from the scores already entered. Nothing is lost.</div>}
            <GamePicker game={game} onChange={setGame} holes={round.holes} />
            {round.setupErrors.length > 0 && <div className="warn">{round.setupErrors.map((e, i) => <div key={i}>• {e}</div>)}</div>}
            <button className="btn block" onClick={saveGame}>Save game</button>
          </>
        )}
        {tab === "money" && (
          <>
            <MoneyForm bets={money.bets} meal={money.meal} players={round.players} onChange={setMoney} />
            <button className="btn block" onClick={saveMoney}>Save bets & meal</button>
          </>
        )}
        {tab === "course" && <CourseForm round={round} a={a} />}
      </div>
    </Sheet>
  );
}
