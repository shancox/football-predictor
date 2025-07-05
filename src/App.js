import { useState, useEffect } from "react";
import teamLogos from "./data/teamLogos"; // adjust path if needed

const leagues = {
  premierleague: {
    name: "Premier League",
    fixturesFile: "/public/premierleague-fixtures.json",
    teamsFile: "/public/premierleague-teams.csv",
    rounds: 38,
  },
  championship: {
    name: "Championship",
    fixturesFile: "/championship-fixtures.json",
    teamsFile: "/championship-teams.csv",
    rounds: 46,
  },
  // Add more leagues here if needed
};

function getRowStyle(leagueId, position) {
  if (leagueId === "premierleague") {
    if (position <= 4) return { backgroundColor: "#AFD179", fontWeight: "700" }; // Top 4
    if (position === 5) return { backgroundColor: "#D6EAB6", fontWeight: "700" }; // Europa League
    if (position > 17) return { backgroundColor: "#A5CCE9", color: "#a00", fontWeight: "700" }; // Relegation bottom 3
  }
  if (leagueId === "championship") {
    if (position <= 2) return { backgroundColor: "#AFD179", fontWeight: "700" }; // Promotion top 2
    if (position >= 3 && position <= 6) return { backgroundColor: "#fff7d0" }; // Playoffs 3-6
    if (position > 21) return { backgroundColor: "#A5CCE9", color: "#a00", fontWeight: "700" }; // Relegation bottom 3
  }
  return {}; // Default no style
}

export default function Home() {
  const [leagueId, setLeagueId] = useState("championship");
  const [fixtures, setFixtures] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState({});

  useEffect(() => {
    const league = leagues[leagueId];
    if (!league) return;

    setSelectedRound(1); // Reset round when league changes

    fetch(league.fixturesFile)
      .then((res) => res.json())
      .then((data) => setFixtures(data))
      .catch((err) => console.error("Failed to load fixtures:", err));

    fetch(league.teamsFile)
      .then((res) => res.text())
      .then((csvText) => {
        const lines = csvText.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const teamIndex = headers.findIndex((h) => h === "team");

        if (teamIndex === -1) throw new Error("Missing 'team' header in CSV");

        const parsedTeams = lines
          .slice(1)
          .map((line) => line.split(",")[teamIndex]?.trim())
          .filter(Boolean);

        setTeams(parsedTeams);
      })
      .catch((err) => console.error("Failed to load teams:", err));

    setMatches([]);
    setScores({});
  }, [leagueId]);

  const handleScoreChange = (matchNumber, side, value, match) => {
    setScores((prev) => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        [side]: value,
      },
    }));

    const homeScore =
      side === "homeScore"
        ? parseInt(value)
        : parseInt(scores[match.MatchNumber]?.homeScore);
    const awayScore =
      side === "awayScore"
        ? parseInt(value)
        : parseInt(scores[match.MatchNumber]?.awayScore);

    if (
      homeScore !== undefined &&
      !isNaN(homeScore) &&
      awayScore !== undefined &&
      !isNaN(awayScore)
    ) {
      setMatches((prev) => {
        const existingIndex = prev.findIndex(
          (m) => m.matchNumber === match.MatchNumber
        );
        const updatedMatch = {
          homeTeam: match.HomeTeam,
          awayTeam: match.AwayTeam,
          homeScore,
          awayScore,
          matchNumber: match.MatchNumber,
          roundNumber: match.RoundNumber,
        };

        if (existingIndex > -1) {
          const copy = [...prev];
          copy[existingIndex] = updatedMatch;
          return copy;
        } else {
          return [...prev, updatedMatch];
        }
      });
    } else {
      setMatches((prev) =>
        prev.filter((m) => m.matchNumber !== match.MatchNumber)
      );
    }
  };

  const league = leagues[leagueId];
  const filteredFixtures = fixtures.filter(
    (f) => f.RoundNumber === selectedRound
  );


  // Calculate league table stats
  const leagueTable = teams.map((team) => {
    let played = 0,
      won = 0,
      drawn = 0,
      lost = 0,
      gf = 0,
      ga = 0,
      points = 0;
    matches.forEach((m) => {
      if (m.homeTeam === team || m.awayTeam === team) {
        const isHome = m.homeTeam === team;
        const teamGoals = isHome ? m.homeScore : m.awayScore;
        const oppGoals = isHome ? m.awayScore : m.homeScore;

        played++;
        gf += teamGoals;
        ga += oppGoals;

        if (teamGoals > oppGoals) won++;
        else if (teamGoals < oppGoals) lost++;
        else drawn++;
      }
    });
    points = won * 3 + drawn;
    return {
      team,
      played,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      points,
    };
  });

  leagueTable.sort(
    (a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  );

const [savedGames, setSavedGames] = useState(() => {
  const data = localStorage.getItem("savedGames");
  return data ? JSON.parse(data) : {};
});

const [currentSaveName, setCurrentSaveName] = useState("autosave");

// Save current match predictions
const saveCurrentGame = (name) => {
  const newSavedGames = {
    ...savedGames,
    [name]: {
      leagueId,
      selectedRound,
      matches,
      scores,
      timestamp: new Date().toISOString(),
    },
  };

  // Optional: prune autosaves older than a certain number (e.g., keep last 5 autosaves)
  const autosaveKeys = Object.keys(newSavedGames)
    .filter((key) => key.startsWith("autosave-"))
    .sort((a, b) => (newSavedGames[b].timestamp > newSavedGames[a].timestamp ? 1 : -1));

  if (autosaveKeys.length > 5) {
    for (let i = 5; i < autosaveKeys.length; i++) {
      delete newSavedGames[autosaveKeys[i]];
    }
  }

  setSavedGames(newSavedGames);
  localStorage.setItem("savedGames", JSON.stringify(newSavedGames));
  setCurrentSaveName(name);
};

const [loading, setLoading] = useState(false);

const loadGame = (name) => {
  const save = savedGames[name];
  if (!save) return;

  setLoading(true);

  setLeagueId(save.leagueId);
  setSelectedRound(save.selectedRound);
  setMatches(save.matches);
  setScores(save.scores);
  setCurrentSaveName(name);
};

useEffect(() => {
  if (loading) {
    // After leagueId and selectedRound changed, stop loading
    setLoading(false);
  }
}, [leagueId, selectedRound]);

useEffect(() => {
  if (loading) return; // skip autosave while loading

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const saveFileName = `AutoSave_GW${selectedRound}_${timestamp}`;
  saveCurrentGame(saveFileName);
}, [leagueId, selectedRound, loading]);




<div style={{ maxWidth: "900px", margin: "1rem auto", fontSize: "12px" }}>
  <strong>Manual Save:</strong>
  <input
    type="text"
    placeholder="Save name"
    value={currentSaveName}
    onChange={(e) => setCurrentSaveName(e.target.value)}
    style={{ marginLeft: "0.5rem", padding: "2px" }}
  />
  <button onClick={() => saveCurrentGame(currentSaveName)} style={{ marginLeft: "0.5rem" }}>
    Save
  </button>

  <strong style={{ marginLeft: "1rem" }}>Load:</strong>
  <select
    value=""
    onChange={(e) => {
      if (e.target.value) loadGame(e.target.value);
    }}
    style={{ marginLeft: "0.5rem" }}
  >
    <option value="">Select a save</option>
    {Object.keys(savedGames).map((key) => (
      <option key={key} value={key}>
        {key} — {new Date(savedGames[key].timestamp).toLocaleString()}
      </option>
    ))}
  </select>
</div>

  return (
    <main
      style={{
        display: "flex",
        maxWidth: "900px",
        margin: "1rem auto",
        gap: "2rem",
        fontFamily: "'Roboto', sans-serif",
        fontSize: "12px",
      }}
    >
      <div style={{ marginTop: "1rem", fontSize: "12px" }}>
  <h3 style={{ fontWeight: "600" }}>Saved Games</h3>
  {Object.keys(savedGames).length === 0 ? (
    <p style={{ fontStyle: "italic", color: "#888" }}>No saved games yet.</p>
  ) : (
    <ul style={{ listStyle: "none", padding: 0 }}>
 {Object.entries(savedGames)
  .sort(([, a], [, b]) => new Date(b.timestamp) - new Date(a.timestamp))  // Sort descending by timestamp
  .map(([key, save]) => (
        <li key={key} style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center" }}>
          <button
            onClick={() => loadGame(key)}
            style={{
              marginRight: "0.5rem",
              padding: "4px 8px",
              fontSize: "12px",
              cursor: "pointer",
              backgroundColor: "#e5e7eb",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            Load
          </button>
          <span style={{ flex: 1 }}>{key} — {new Date(save.timestamp).toLocaleString()}</span>
          <button
            onClick={() => {
              const updated = { ...savedGames };
              delete updated[key];
              setSavedGames(updated);
              localStorage.setItem("savedGames", JSON.stringify(updated));
            }}
            style={{
              marginLeft: "0.5rem",
              color: "#a00",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              textDecoration: "underline",
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )}
</div>

      {/* League selector */}
      <section style={{ flex: "1 1 100%", marginBottom: "1rem" }}>
        <label htmlFor="league-select" style={{ marginRight: "0.5rem" }}>
          Select League:
        </label>
        <select
          id="league-select"
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          style={{ padding: "4px 8px", fontSize: "12px" }}
        >
          {Object.entries(leagues).map(([id, info]) => (
            <option key={id} value={id}>
              {info.name}
            </option>
          ))}
        </select>
      </section>

      {/* Fixtures section - two thirds */}
      <section style={{ flex: "2" }}>
        <h1
          style={{ fontWeight: "700", fontSize: "1.5rem", marginBottom: "1rem" }}
        >
          {league.name} - Predictor
        </h1>

<div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
  <button
    onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
    disabled={selectedRound === 1}
    style={{
      padding: "6px 10px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      backgroundColor: selectedRound === 1 ? "#ccc" : "#e5e7eb",
      cursor: selectedRound === 1 ? "not-allowed" : "pointer",
      fontSize: "14px",
      fontWeight: "700",
      userSelect: "none",
    }}
    aria-label="Previous Round"
  >
    &lt;
  </button>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(8, 36px)", // 8 buttons per row, each 36px wide
      gap: "6px",
      overflowX: "auto",
      flexGrow: 1,
      paddingBottom: "4px",
    }}
  >
    {[...Array(league.rounds)].map((_, i) => {
      const round = i + 1;
      const isSelected = round === selectedRound;
      return (
        <button
          key={round}
          onClick={() => setSelectedRound(round)}
          style={{
            width: "36px",
            height: "28px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: isSelected ? "#2563eb" : "#e5e7eb",
            color: isSelected ? "#fff" : "#000",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: isSelected ? "700" : "400",
            userSelect: "none",
          }}
          aria-current={isSelected ? "true" : undefined}
          aria-label={`Round ${round}`}
        >
          {round}
        </button>
      );
    })}
  </div>

  <button
    onClick={() => setSelectedRound((r) => Math.min(league.rounds, r + 1))}
    disabled={selectedRound === league.rounds}
    style={{
      padding: "6px 10px",
      borderRadius: "4px",
      border: "1px solid #ccc",
      backgroundColor: selectedRound === league.rounds ? "#ccc" : "#e5e7eb",
      cursor: selectedRound === league.rounds ? "not-allowed" : "pointer",
      fontSize: "14px",
      fontWeight: "700",
      userSelect: "none",
    }}
    aria-label="Next Round"
  >
    &gt;
  </button>
</div>


        <h2 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
          Fixtures - Week {selectedRound}
        </h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #ccc",
          }}
        >
          <tbody>
            {filteredFixtures.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "8px" }}>
                  No fixtures found for this round.
                </td>
              </tr>
            ) : (
              filteredFixtures.reduce((acc, match, i) => {
                const dateKey = new Date(match.DateUtc).toLocaleDateString();
                const prevDateKey =
                  i > 0
                    ? new Date(filteredFixtures[i - 1].DateUtc).toLocaleDateString()
                    : null;

                if (dateKey !== prevDateKey) {
                  acc.push(
                    <tr key={`date-${dateKey}`} style={{ backgroundColor: "#f0f0f0" }}>
                      <td
                        colSpan={6}
                        style={{
                          padding: "8px",
                          fontWeight: "600",
                          textAlign: "left",
                        }}
                      >
                        {dateKey}
                      </td>
                    </tr>
                  );
                }

                acc.push(
                  <tr key={match.MatchNumber} style={{ whiteSpace: "nowrap" }}>
                    <td style={{ padding: "6px", border: "1px solid #ccc" }}>
                      {new Date(match.DateUtc).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
<td style={{ padding: "6px", border: "1px solid #ccc", display: "flex", alignItems: "center", gap: "6px" }}>
  {teamLogos[match.HomeTeam] && (
    <img
      src={teamLogos[match.HomeTeam]}
      alt={`${match.HomeTeam} logo`}
      style={{ width: "18px", height: "18px", objectFit: "contain" }}
    />
  )}
  <span>{match.HomeTeam}</span>
</td>

                    <td
                      style={{
                        padding: "6px",
                        border: "1px solid #ccc",
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores[match.MatchNumber]?.homeScore || ""}
                        onChange={(e) =>
                          handleScoreChange(
                            match.MatchNumber,
                            "homeScore",
                            e.target.value,
                            match
                          )
                        }
                        style={{
                          width: "30px",
                          height: "20px",
                          textAlign: "center",
                          borderRadius: "4px",
                          padding: 0,
                          border: "1px solid #999",
                          fontSize: "12px",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "6px",
                        border: "1px solid #ccc",
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={scores[match.MatchNumber]?.awayScore || ""}
                        onChange={(e) =>
                          handleScoreChange(
                            match.MatchNumber,
                            "awayScore",
                            e.target.value,
                            match
                          )
                        }
                        style={{
                          width: "30px",
                          height: "20px",
                          textAlign: "center",
                          borderRadius: "4px",
                          padding: 0,
                          border: "1px solid #999",
                          fontSize: "12px",
                        }}
                      />
                    </td>
<td style={{ padding: "6px", border: "1px solid #ccc", display: "flex", alignItems: "center", gap: "6px" }}>
  {teamLogos[match.AwayTeam] && (
    <img
      src={teamLogos[match.AwayTeam]}
      alt={`${match.AwayTeam} logo`}
      style={{ width: "18px", height: "18px", objectFit: "contain" }}
    />
  )}
  <span>{match.AwayTeam}</span>
</td>

                  </tr>
                );
                return acc;
              }, [])
            )}
          </tbody>
        </table>
      </section>

      {/* League table section - one third */}
      <section style={{ flex: "1" }}>
        <h2 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
          {league.name} Table
        </h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #ccc",
            fontSize: "11px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#efefef" }}>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>#</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>Team</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>P</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>W</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>D</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>L</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>GF</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>GA</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>GD</th>
              <th style={{ padding: "4px", border: "1px solid #ccc" }}>Pts</th>
            </tr>
          </thead>
<tbody>
  {leagueTable.length === 0 ? (
    <tr>
      <td colSpan={10} style={{ textAlign: "center", padding: "8px" }}>
        No predictions entered yet.
      </td>
    </tr>
  ) : (
    leagueTable.map((teamData, i) => (
      <tr
        key={teamData.team}
        style={{ ...getRowStyle(leagueId, i + 1), whiteSpace: "nowrap" }}
        title={`Position ${i + 1}`}
      >
        <td style={{ padding: "4px", border: "1px solid #ccc" }}>
          {i + 1}
        </td>
<td style={{ padding: "4px", border: "1px solid #ccc", display: "flex", alignItems: "center", gap: "6px" }}>
  {teamLogos[teamData.team] && (
    <img
      src={teamLogos[teamData.team]}
      alt={`${teamData.team} logo`}
      style={{ width: "18px", height: "18px", objectFit: "contain" }}
    />
  )}
  <span>{teamData.team}</span>
</td>

<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.played}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.won}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.drawn}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.lost}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.gf}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.ga}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.gd}
</td>
<td style={{ padding: "4px", border: "1px solid #ccc", width: "40px", textAlign: "center" }}>
  {teamData.points}
</td>
      </tr>
    ))
  )}
</tbody>

        </table>
      </section>
    </main>
  );
}
