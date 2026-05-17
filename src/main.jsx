import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const PLAYERS = ['Nilesh', 'Mohit', 'Chanikya', 'Guru', 'Avinash', 'Samarth', 'Mukund', 'Omtej'];
const WIN_RECORD_KEY = 'pickleball-win-records';
const TARGET_SCORE = 11;

const createMatch = (id) => ({
  id,
  team1: [],
  team2: [],
  score1: 0,
  score2: 0,
  winner: null,
  isCompleted: false
});

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const pairKey = (team) => [...team].sort().join('|');

const readRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(WIN_RECORD_KEY)) ?? [];
  } catch {
    return [];
  }
};

function App() {
  const [matches, setMatches] = useState({
    sf1: createMatch('sf1'),
    sf2: createMatch('sf2'),
    final: createMatch('final')
  });
  const [view, setView] = useState('bracket');
  const [mobileStep, setMobileStep] = useState('sf1');
  const [records, setRecords] = useState([]);
  const [spinState, setSpinState] = useState({
    matchId: null,
    isSpinning: false,
    displayTeam1: ['Ready', 'Ready'],
    displayTeam2: ['Ready', 'Ready']
  });
  const confettiRef = useRef(null);

  useEffect(() => {
    setRecords(readRecords());
  }, []);

  const usedPlayers = useMemo(() => {
    return [...matches.sf1.team1, ...matches.sf1.team2, ...matches.sf2.team1, ...matches.sf2.team2];
  }, [matches]);

  const isMatchUnlocked = (matchId) => {
    if (matchId === 'sf1') return true;
    if (matchId === 'sf2') return matches.sf1.isCompleted;
    return matches.sf1.isCompleted && matches.sf2.isCompleted;
  };

  const canSpin = (matchId) => {
    if (spinState.isSpinning || matches[matchId].team1.length) return false;
    return isMatchUnlocked(matchId);
  };

  const spinTeams = (matchId) => {
    if (!canSpin(matchId)) return;

    const availablePlayers = matchId === 'sf1'
      ? PLAYERS
      : PLAYERS.filter((player) => !usedPlayers.includes(player));

    let ticks = 0;
    const totalTicks = 22;
    const interval = window.setInterval(() => {
      const rolling = shuffle(availablePlayers);
      setSpinState({
        matchId,
        isSpinning: true,
        displayTeam1: [rolling[0], rolling[1]],
        displayTeam2: [rolling[2], rolling[3]]
      });
      ticks += 1;

      if (ticks >= totalTicks) {
        window.clearInterval(interval);
        const picked = shuffle(availablePlayers);
        const nextTeams = {
          team1: [picked[0], picked[1]],
          team2: [picked[2], picked[3]]
        };

        setMatches((current) => ({
          ...current,
          [matchId]: {
            ...current[matchId],
            ...nextTeams
          }
        }));
        setSpinState({
          matchId: null,
          isSpinning: false,
          displayTeam1: nextTeams.team1,
          displayTeam2: nextTeams.team2
        });
      }
    }, 70);
  };

  const updateScore = (matchId, side, change) => {
    setMatches((current) => {
      const match = current[matchId];
      if (match.isCompleted || !isMatchUnlocked(matchId) || !match.team1.length || !match.team2.length) return current;
      const scoreKey = side === 1 ? 'score1' : 'score2';
      const nextScore = Math.min(TARGET_SCORE, Math.max(0, match[scoreKey] + change));

      return {
        ...current,
        [matchId]: {
          ...match,
          [scoreKey]: nextScore
        }
      };
    });
  };

  const submitMatch = (matchId) => {
    const match = matches[matchId];
    if (match.isCompleted || Math.max(match.score1, match.score2) !== TARGET_SCORE || match.score1 === match.score2) return;

    const winner = match.score1 === TARGET_SCORE ? match.team1 : match.team2;

    setMatches((current) => {
      const updated = {
        ...current,
        [matchId]: {
          ...current[matchId],
          winner,
          isCompleted: true
        }
      };

      if (matchId === 'sf1') {
        updated.final = {
          ...updated.final,
          team1: winner
        };
      }

      if (matchId === 'sf2') {
        updated.final = {
          ...updated.final,
          team2: winner
        };
      }

      return updated;
    });

    if (matchId === 'sf1') setMobileStep('sf2');
    if (matchId === 'sf2') setMobileStep('final');
    if (matchId === 'final') {
      saveFinalWinner(winner);
      launchConfetti();
    }
  };

  const saveFinalWinner = (winner) => {
    const key = pairKey(winner);
    const currentRecords = readRecords();
    const existing = currentRecords.find((record) => pairKey([record.player1, record.player2]) === key);
    const nextRecords = existing
      ? currentRecords.map((record) => (
          pairKey([record.player1, record.player2]) === key
            ? { ...record, totalWins: record.totalWins + 1 }
            : record
        ))
      : [...currentRecords, { player1: [...winner].sort()[0], player2: [...winner].sort()[1], totalWins: 1 }];

    localStorage.setItem(WIN_RECORD_KEY, JSON.stringify(nextRecords));
    setRecords(nextRecords);
  };

  const launchConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * pixelRatio;
    canvas.height = window.innerHeight * pixelRatio;
    context.scale(pixelRatio, pixelRatio);

    const pieces = Array.from({ length: 130 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight,
      size: 5 + Math.random() * 8,
      speed: 2 + Math.random() * 5,
      drift: -2 + Math.random() * 4,
      rotation: Math.random() * 360,
      color: Math.random() > 0.5 ? '#00f2fe' : '#f355da'
    }));

    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces.forEach((piece) => {
        piece.y += piece.speed;
        piece.x += piece.drift;
        piece.rotation += 7;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate((piece.rotation * Math.PI) / 180);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.55);
        context.restore();
      });
      frame += 1;
      if (frame < 150) {
        requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    draw();
  };

  const resetTournament = () => {
    setMatches({
      sf1: createMatch('sf1'),
      sf2: createMatch('sf2'),
      final: createMatch('final')
    });
    setMobileStep('sf1');
    setSpinState({
      matchId: null,
      isSpinning: false,
      displayTeam1: ['Ready', 'Ready'],
      displayTeam2: ['Ready', 'Ready']
    });
  };

  const sortedRecords = [...records].sort((a, b) => b.totalWins - a.totalWins);

  return (
    <main className="app-shell">
      <canvas ref={confettiRef} className="confetti-canvas" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">8 player pickleball bracket</p>
          <h1>2v2 Randomizer Tournament</h1>
        </div>
        <nav className="view-tabs" aria-label="Primary views">
          <button className={view === 'bracket' ? 'active' : ''} onClick={() => setView('bracket')}>Bracket</button>
          <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>Leaderboard</button>
        </nav>
      </header>

      {view === 'bracket' ? (
        <>
          <section className="status-strip" aria-label="Tournament status">
            <StatusItem label="SF1" match={matches.sf1} />
            <StatusItem label="SF2" match={matches.sf2} />
            <StatusItem label="Final" match={matches.final} />
            <button className="ghost-button" onClick={resetTournament}>New Tournament</button>
          </section>

          <section className="mobile-steps" aria-label="Match steps">
            {['sf1', 'sf2', 'final'].map((id, index) => (
              <button
                key={id}
                className={mobileStep === id ? 'active' : ''}
                onClick={() => setMobileStep(id)}
              >
                Step {index + 1}
              </button>
            ))}
          </section>

          <section className="bracket-grid">
            <MatchCard
              title="Semi-Final 1"
              match={matches.sf1}
              matchId="sf1"
              isVisible={mobileStep === 'sf1'}
              spinState={spinState}
              isUnlocked={isMatchUnlocked('sf1')}
              canSpin={canSpin('sf1')}
              onSpin={() => spinTeams('sf1')}
              onScore={updateScore}
              onSubmit={submitMatch}
            />
            <FinalBridge matches={matches} />
            <MatchCard
              title="Semi-Final 2"
              match={matches.sf2}
              matchId="sf2"
              isVisible={mobileStep === 'sf2'}
              spinState={spinState}
              isUnlocked={isMatchUnlocked('sf2')}
              canSpin={canSpin('sf2')}
              onSpin={() => spinTeams('sf2')}
              onScore={updateScore}
              onSubmit={submitMatch}
            />
            <MatchCard
              title="Final"
              match={matches.final}
              matchId="final"
              isVisible={mobileStep === 'final'}
              onScore={updateScore}
              onSubmit={submitMatch}
              isUnlocked={isMatchUnlocked('final')}
              isFinal
            />
          </section>
        </>
      ) : (
        <Leaderboard records={sortedRecords} onClear={() => {
          localStorage.removeItem(WIN_RECORD_KEY);
          setRecords([]);
        }} />
      )}
    </main>
  );
}

function StatusItem({ label, match }) {
  const status = match.isCompleted ? 'Completed' : match.team1.length ? 'Ready' : 'Waiting';
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  );
}

function MatchCard({ title, match, matchId, isVisible, spinState, canSpin, onSpin, onScore, onSubmit, isUnlocked, isFinal = false }) {
  const hasTeams = match.team1.length && match.team2.length;
  const isSpinningHere = spinState?.isSpinning && spinState.matchId === matchId;
  const showSubmit = hasTeams && !match.isCompleted && Math.max(match.score1, match.score2) === TARGET_SCORE && match.score1 !== match.score2;

  return (
    <article className={`match-card ${isFinal ? 'final-card' : ''} ${isVisible ? 'mobile-active' : ''}`}>
      <div className="match-heading">
        <p>{title}</p>
        {match.isCompleted && <span className="complete-pill">Locked</span>}
      </div>

      {!isFinal && (
        <button className="spin-button" onClick={onSpin} disabled={!canSpin}>
          {isSpinningHere ? 'Spinning...' : hasTeams ? 'Teams Locked' : 'Spin Teams'}
        </button>
      )}

      {isSpinningHere ? (
        <div className="spin-preview" aria-live="polite">
          <TeamNames team={spinState.displayTeam1} tone="cyan" />
          <span className="versus">vs</span>
          <TeamNames team={spinState.displayTeam2} tone="magenta" />
        </div>
      ) : (
        <div className="scoreboard">
          <TeamScore
            team={match.team1}
            fallback={isFinal ? 'SF1 winner' : 'Team 1'}
            score={match.score1}
            tone="cyan"
            disabled={!hasTeams || match.isCompleted || !isUnlocked}
            onIncrement={() => onScore(matchId, 1, 1)}
            onDecrement={() => onScore(matchId, 1, -1)}
          />
          <span className="versus">vs</span>
          <TeamScore
            team={match.team2}
            fallback={isFinal ? 'SF2 winner' : 'Team 2'}
            score={match.score2}
            tone="magenta"
            disabled={!hasTeams || match.isCompleted || !isUnlocked}
            onIncrement={() => onScore(matchId, 2, 1)}
            onDecrement={() => onScore(matchId, 2, -1)}
          />
        </div>
      )}

      {showSubmit && (
        <button className="submit-button" onClick={() => onSubmit(matchId)}>
          Submit Match Results
        </button>
      )}

      {match.winner && (
        <p className="winner-line">
          Winner: <strong>{match.winner.join(' + ')}</strong>
        </p>
      )}
    </article>
  );
}

function TeamScore({ team, fallback, score, tone, disabled, onIncrement, onDecrement }) {
  return (
    <div className={`team-panel ${tone}`}>
      <TeamNames team={team} fallback={fallback} tone={tone} />
      <div className="score-control">
        <button aria-label={`Decrease ${fallback} score`} onClick={onDecrement} disabled={disabled || score <= 0}>-</button>
        <strong>{score}</strong>
        <button aria-label={`Increase ${fallback} score`} onClick={onIncrement} disabled={disabled || score >= TARGET_SCORE}>+</button>
      </div>
    </div>
  );
}

function TeamNames({ team, fallback = 'Awaiting team', tone }) {
  const names = team.length ? team : [fallback, ''];
  return (
    <div className={`team-names ${tone}`}>
      <span>{names[0]}</span>
      {names[1] && <span>{names[1]}</span>}
    </div>
  );
}

function FinalBridge({ matches }) {
  return (
    <div className="final-bridge" aria-label="Finalists">
      <div>
        <span>Finalist 1</span>
        <strong>{matches.final.team1.length ? matches.final.team1.join(' + ') : 'SF1 pending'}</strong>
      </div>
      <div>
        <span>Finalist 2</span>
        <strong>{matches.final.team2.length ? matches.final.team2.join(' + ') : 'SF2 pending'}</strong>
      </div>
    </div>
  );
}

function Leaderboard({ records, onClear }) {
  return (
    <section className="leaderboard-panel">
      <div className="leaderboard-heading">
        <div>
          <p className="eyebrow">localStorage ledger</p>
          <h2>Combination Leaderboard</h2>
        </div>
        <button className="ghost-button" onClick={onClear} disabled={!records.length}>Clear Ledger</button>
      </div>

      {records.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Winning Pair</th>
                <th>Total Wins</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={`${record.player1}-${record.player2}`}>
                  <td>{index + 1}</td>
                  <td>{record.player1} + {record.player2}</td>
                  <td>{record.totalWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h3>No final winners yet</h3>
          <p>Finish a tournament final and the winning pair will appear here automatically.</p>
        </div>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
