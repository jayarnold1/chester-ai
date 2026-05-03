import { useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------
   Generic state-space search (BFS, DFS, UCS, Greedy, A*)
   Each problem provides: start, isGoal, successors(state)->[{state,action,cost}], heuristic(state)
------------------------------------------------------------------- */

type Successor<S> = { state: S; action: string; cost: number };
type Problem<S> = {
  start: S;
  isGoal: (s: S) => boolean;
  successors: (s: S) => Successor<S>[];
  heuristic: (s: S) => number;
  key: (s: S) => string;
};
type Algo = "BFS" | "DFS" | "UCS" | "GREEDY" | "ASTAR";
type Trace<S> = {
  visited: { state: S; depth: number; cost: number; h: number; f: number; action?: string }[];
  path: { state: S; action?: string; cost: number }[];
  expansions: number;
  found: boolean;
};

function search<S>(p: Problem<S>, algo: Algo, maxExpansions = 4000): Trace<S> {
  type Node = { state: S; parent?: Node; action?: string; g: number; depth: number };
  const startNode: Node = { state: p.start, g: 0, depth: 0 };
  const visited: Trace<S>["visited"] = [];
  const seen = new Map<string, number>();
  const frontier: Node[] = [startNode];
  // priority based on algo
  const priority = (n: Node) => {
    if (algo === "BFS") return n.depth;
    if (algo === "DFS") return -n.depth;
    if (algo === "UCS") return n.g;
    if (algo === "GREEDY") return p.heuristic(n.state);
    return n.g + p.heuristic(n.state);
  };
  let expansions = 0;
  while (frontier.length && expansions < maxExpansions) {
    // pick min priority
    let idx = 0;
    if (algo === "DFS") idx = frontier.length - 1;
    else {
      let best = priority(frontier[0]);
      for (let i = 1; i < frontier.length; i++) {
        const pi = priority(frontier[i]);
        if (pi < best) { best = pi; idx = i; }
      }
    }
    const node = frontier.splice(idx, 1)[0];
    const k = p.key(node.state);
    if (seen.has(k) && seen.get(k)! <= node.g) continue;
    seen.set(k, node.g);
    expansions++;
    const h = p.heuristic(node.state);
    visited.push({ state: node.state, depth: node.depth, cost: node.g, h, f: node.g + h, action: node.action });
    if (p.isGoal(node.state)) {
      const path: Trace<S>["path"] = [];
      let cur: Node | undefined = node;
      while (cur) { path.unshift({ state: cur.state, action: cur.action, cost: cur.g }); cur = cur.parent; }
      return { visited, path, expansions, found: true };
    }
    for (const s of p.successors(node.state)) {
      const nk = p.key(s.state);
      const ng = node.g + s.cost;
      if (!seen.has(nk) || seen.get(nk)! > ng) {
        frontier.push({ state: s.state, parent: node, action: s.action, g: ng, depth: node.depth + 1 });
      }
    }
  }
  return { visited, path: [], expansions, found: false };
}

/* ------------- 5 Problems (one per AI feature) ------------- */

// 1) Color Palette Optimizer (BFS): hue 0..330 step 30, start->target by ±30
function paletteProblem(start: number, target: number): Problem<number> {
  return {
    start,
    isGoal: (s) => s === target,
    successors: (s) => [
      { state: (s + 30) % 360, action: "+30°", cost: 1 },
      { state: (s + 330) % 360, action: "-30°", cost: 1 },
    ],
    heuristic: (s) => Math.min(Math.abs(s - target), 360 - Math.abs(s - target)) / 30,
    key: (s) => String(s),
  };
}

// 2) Smart Crop Path (DFS): grid 6x6, agent at (x,y) → target
type Pos = { x: number; y: number };
function cropProblem(start: Pos, target: Pos, size = 6): Problem<Pos> {
  return {
    start,
    isGoal: (s) => s.x === target.x && s.y === target.y,
    successors: (s) => {
      const out: Successor<Pos>[] = [];
      const moves = [[1, 0, "R"], [-1, 0, "L"], [0, 1, "D"], [0, -1, "U"]] as const;
      for (const [dx, dy, a] of moves) {
        const nx = s.x + dx, ny = s.y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size) out.push({ state: { x: nx, y: ny }, action: a, cost: 1 });
      }
      return out;
    },
    heuristic: (s) => Math.abs(s.x - target.x) + Math.abs(s.y - target.y),
    key: (s) => `${s.x},${s.y}`,
  };
}

// 3) Sticker Layout Solver (UCS): 3 stickers on 1D line, minimize overlap cost
type Layout = number[]; // positions of stickers (0..N)
function stickerProblem(N = 8, target: Layout = [1, 4, 7]): Problem<Layout> {
  const start: Layout = [0, 0, 0];
  return {
    start,
    isGoal: (s) => s.every((v, i) => v === target[i]),
    successors: (s) => {
      const out: Successor<Layout>[] = [];
      for (let i = 0; i < s.length; i++) {
        if (s[i] + 1 <= N) {
          const ns = s.slice(); ns[i] += 1;
          // overlap cost: extra cost if too close to neighbors
          let overlap = 0;
          for (let j = 0; j < ns.length; j++) for (let k = j + 1; k < ns.length; k++) {
            if (Math.abs(ns[j] - ns[k]) < 2) overlap += 2;
          }
          out.push({ state: ns, action: `S${i + 1}+`, cost: 1 + overlap });
        }
      }
      return out;
    },
    heuristic: (s) => s.reduce((acc, v, i) => acc + Math.abs(v - target[i]), 0),
    key: (s) => s.join(","),
  };
}

// 4) Beauty Preset Tuner (Greedy): (brightness, contrast) reach target
type Beauty = { b: number; c: number };
function beautyProblem(start: Beauty, target: Beauty): Problem<Beauty> {
  return {
    start,
    isGoal: (s) => s.b === target.b && s.c === target.c,
    successors: (s) => {
      const out: Successor<Beauty>[] = [];
      const opts = [[10, 0, "B+"], [-10, 0, "B-"], [0, 10, "C+"], [0, -10, "C-"]] as const;
      for (const [db, dc, a] of opts) {
        const nb = s.b + db, nc = s.c + dc;
        if (nb >= 50 && nb <= 200 && nc >= 50 && nc <= 200) out.push({ state: { b: nb, c: nc }, action: a, cost: 1 });
      }
      return out;
    },
    heuristic: (s) => Math.abs(s.b - target.b) / 10 + Math.abs(s.c - target.c) / 10,
    key: (s) => `${s.b},${s.c}`,
  };
}

// 5) Animation Timeline Planner (A*): build sequence of N keyframes, each with chosen effect (cost varies)
type Timeline = string[];
const EFFECTS: { name: string; cost: number }[] = [
  { name: "fadeIn", cost: 1 },
  { name: "zoomIn", cost: 2 },
  { name: "slide", cost: 2 },
  { name: "bounce", cost: 3 },
  { name: "pan", cost: 2 },
];
function timelineProblem(target: Timeline): Problem<Timeline> {
  return {
    start: [],
    isGoal: (s) => s.length === target.length && s.every((v, i) => v === target[i]),
    successors: (s) => {
      if (s.length >= target.length) return [];
      return EFFECTS.map((e) => ({ state: [...s, e.name], action: e.name, cost: e.cost }));
    },
    heuristic: (s) => {
      // remaining frames * min cost; bonus if mismatched at current index
      let h = (target.length - s.length);
      for (let i = 0; i < s.length; i++) if (s[i] !== target[i]) h += 5;
      return h;
    },
    key: (s) => s.join(">"),
  };
}

/* ----------------- UI ----------------- */

const FEATURES = [
  { id: "palette", name: "Color Palette Optimizer", algo: "BFS" as Algo, desc: "Cari urutan rotasi hue minimum dari warna awal ke target." },
  { id: "crop", name: "Smart Crop Path", algo: "DFS" as Algo, desc: "Telusuri grid untuk menemukan area crop ideal." },
  { id: "stickers", name: "Sticker Layout Solver", algo: "UCS" as Algo, desc: "Susun posisi stiker dengan biaya overlap minimum." },
  { id: "beauty", name: "Beauty Preset Tuner", algo: "GREEDY" as Algo, desc: "Greedy menuju preset target (brightness, contrast)." },
  { id: "timeline", name: "Animation Timeline Planner", algo: "ASTAR" as Algo, desc: "A* menyusun urutan keyframe paling murah & cocok." },
];

export function SearchSimulator() {
  const [active, setActive] = useState(FEATURES[0].id);
  const [algo, setAlgo] = useState<Algo>(FEATURES[0].algo);
  const [step, setStep] = useState(0);
  const playRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // problem-specific config
  const [paletteStart, setPaletteStart] = useState(0);
  const [paletteTarget, setPaletteTarget] = useState(180);
  const [cropTarget, setCropTarget] = useState<Pos>({ x: 5, y: 5 });
  const [beautyTarget, setBeautyTarget] = useState<Beauty>({ b: 150, c: 130 });
  const [timelineTarget, setTimelineTarget] = useState<Timeline>(["fadeIn", "zoomIn", "pan"]);

  const trace = useMemo(() => {
    if (active === "palette") return search(paletteProblem(paletteStart, paletteTarget), algo);
    if (active === "crop") return search(cropProblem({ x: 0, y: 0 }, cropTarget), algo);
    if (active === "stickers") return search(stickerProblem(), algo);
    if (active === "beauty") return search(beautyProblem({ b: 100, c: 100 }, beautyTarget), algo);
    return search(timelineProblem(timelineTarget), algo);
  }, [active, algo, paletteStart, paletteTarget, cropTarget, beautyTarget, timelineTarget]);

  function play() {
    if (playing) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      setPlaying(false); return;
    }
    setPlaying(true); setStep(0);
    let s = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (t - last > 150) {
        s++;
        last = t;
        setStep(s);
        if (s >= trace.visited.length) { setPlaying(false); return; }
      }
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
  }

  const cur = trace.visited[Math.min(step, trace.visited.length - 1)];

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-emerald-700 to-teal-700 text-white">
        <h1 className="flex items-center gap-2">AI Search Simulator</h1>
        <p className="text-xs opacity-90">5 fitur AI dimodelkan sebagai state space — diselesaikan via BFS, DFS, UCS, Greedy & A*.</p>
      </div>

      <div className="p-4 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <div className="text-xs text-gray-500">Pilih fitur:</div>
          {FEATURES.map((f) => (
            <button key={f.id} onClick={() => { setActive(f.id); setAlgo(f.algo); setStep(0); }}
              className={`w-full text-left p-3 rounded-xl border ${active === f.id ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <div className="flex items-center justify-between">
                <span>{f.name}</span>
                <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded">{f.algo}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
            </button>
          ))}

          <div className="p-3 bg-gray-50 rounded-xl">
            <label className="text-xs text-gray-600">Algoritma override:</label>
            <select value={algo} onChange={(e) => { setAlgo(e.target.value as Algo); setStep(0); }} className="w-full p-2 border rounded mt-1 text-sm">
              <option value="BFS">BFS (Uninformed)</option>
              <option value="DFS">DFS (Uninformed)</option>
              <option value="UCS">Uniform Cost Search</option>
              <option value="GREEDY">Greedy Best-First (Informed)</option>
              <option value="ASTAR">A* Search (Informed)</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {active === "palette" && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-600 mb-1">Hue awal: {paletteStart}°</div>
              <input type="range" min={0} max={330} step={30} value={paletteStart} onChange={(e) => { setPaletteStart(+e.target.value); setStep(0); }} className="w-full" />
              <div className="text-xs text-gray-600 mb-1 mt-2">Target: {paletteTarget}°</div>
              <input type="range" min={0} max={330} step={30} value={paletteTarget} onChange={(e) => { setPaletteTarget(+e.target.value); setStep(0); }} className="w-full" />
            </div>
          )}
          {active === "crop" && (
            <div className="p-3 bg-gray-50 rounded-xl text-xs">
              <div>Target X: {cropTarget.x} <input type="range" min={0} max={5} value={cropTarget.x} onChange={(e) => { setCropTarget({ ...cropTarget, x: +e.target.value }); setStep(0); }} /></div>
              <div>Target Y: {cropTarget.y} <input type="range" min={0} max={5} value={cropTarget.y} onChange={(e) => { setCropTarget({ ...cropTarget, y: +e.target.value }); setStep(0); }} /></div>
            </div>
          )}
          {active === "beauty" && (
            <div className="p-3 bg-gray-50 rounded-xl text-xs">
              <div>Target Brightness: {beautyTarget.b} <input type="range" min={50} max={200} step={10} value={beautyTarget.b} onChange={(e) => { setBeautyTarget({ ...beautyTarget, b: +e.target.value }); setStep(0); }} /></div>
              <div>Target Contrast: {beautyTarget.c} <input type="range" min={50} max={200} step={10} value={beautyTarget.c} onChange={(e) => { setBeautyTarget({ ...beautyTarget, c: +e.target.value }); setStep(0); }} /></div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={play} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">{playing ? "⏸ Pause" : "▶ Play"}</button>
            <button onClick={() => setStep(Math.max(0, step - 1))} className="px-3 py-2 bg-gray-200 rounded-lg">◀</button>
            <button onClick={() => setStep(Math.min(trace.visited.length - 1, step + 1))} className="px-3 py-2 bg-gray-200 rounded-lg">▶</button>
            <button onClick={() => setStep(trace.visited.length - 1)} className="px-3 py-2 bg-gray-200 rounded-lg">⏭</button>
            <button onClick={() => setStep(0)} className="px-3 py-2 bg-gray-200 rounded-lg">⏮</button>
          </div>

          <div className="text-xs text-gray-600">Step {Math.min(step + 1, trace.visited.length)} / {trace.visited.length} • Expansions: {trace.expansions} • {trace.found ? `✅ Path length: ${trace.path.length - 1}` : "🔍 Mencari..."}</div>

          {/* Visualization */}
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl min-h-[260px]">
            {active === "palette" && cur && <PaletteViz state={cur.state as number} target={paletteTarget} visited={trace.visited.slice(0, step + 1).map((v) => v.state as number)} />}
            {active === "crop" && cur && <CropViz state={cur.state as Pos} target={cropTarget} visited={trace.visited.slice(0, step + 1).map((v) => v.state as Pos)} />}
            {active === "stickers" && cur && <StickerViz state={cur.state as Layout} target={[1, 4, 7]} />}
            {active === "beauty" && cur && <BeautyViz state={cur.state as Beauty} target={beautyTarget} />}
            {active === "timeline" && cur && <TimelineViz state={cur.state as Timeline} target={timelineTarget} />}
          </div>

          <div className="p-3 bg-white border rounded-xl">
            <div className="text-xs text-gray-500 mb-1">Node detail:</div>
            {cur && (
              <div className="text-xs grid grid-cols-2 gap-2">
                <div><b>Action:</b> {cur.action ?? "(start)"}</div>
                <div><b>Depth:</b> {cur.depth}</div>
                <div><b>g(n) cost:</b> {cur.cost}</div>
                <div><b>h(n):</b> {cur.h.toFixed(2)}</div>
                <div className="col-span-2"><b>f(n)=g+h:</b> {cur.f.toFixed(2)}</div>
              </div>
            )}
          </div>

          {trace.found && (
            <div className="p-3 bg-white border rounded-xl">
              <div className="text-xs text-gray-500 mb-1">Solution path:</div>
              <div className="text-xs">
                {trace.path.map((n, i) => (
                  <span key={i} className="inline-block mr-2">
                    {i > 0 && <span className="text-gray-400">→</span>} <span className="px-2 py-0.5 bg-emerald-100 rounded">{n.action ?? "start"}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaletteViz({ state, target, visited }: { state: number; target: number; visited: number[] }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <div className="text-xs">Now</div>
        <div className="w-20 h-20 rounded-full" style={{ background: `hsl(${state},80%,55%)` }} />
        <div className="text-xs">→</div>
        <div className="w-20 h-20 rounded-full" style={{ background: `hsl(${target},80%,55%)` }} />
        <div className="text-xs">Target</div>
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {visited.map((v, i) => <div key={i} className="w-5 h-5 rounded" style={{ background: `hsl(${v},80%,55%)` }} title={`${v}°`} />)}
      </div>
    </div>
  );
}
function CropViz({ state, target, visited }: { state: Pos; target: Pos; visited: Pos[] }) {
  const N = 6;
  const seen = new Set(visited.map((v) => `${v.x},${v.y}`));
  return (
    <div className="grid gap-0.5 mx-auto" style={{ gridTemplateColumns: `repeat(${N},28px)` }}>
      {Array.from({ length: N * N }, (_, i) => {
        const x = i % N, y = Math.floor(i / N);
        const isCur = x === state.x && y === state.y;
        const isTar = x === target.x && y === target.y;
        const visitedCell = seen.has(`${x},${y}`);
        return <div key={i} className={`w-7 h-7 rounded ${isCur ? "bg-emerald-500" : isTar ? "bg-orange-400" : visitedCell ? "bg-emerald-200" : "bg-gray-200"}`} />;
      })}
    </div>
  );
}
function StickerViz({ state, target }: { state: Layout; target: Layout }) {
  const N = 9;
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-1">
          {Array.from({ length: N }, (_, x) => {
            const isCur = state[i] === x;
            const isTar = target[i] === x;
            return <div key={x} className={`w-7 h-7 rounded text-center text-xs flex items-center justify-center ${isCur && isTar ? "bg-emerald-500 text-white" : isCur ? "bg-blue-400 text-white" : isTar ? "bg-orange-300" : "bg-gray-100"}`}>{isCur ? "S" : isTar ? "★" : ""}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
function BeautyViz({ state, target }: { state: Beauty; target: Beauty }) {
  return (
    <div className="space-y-3">
      <Bar label={`Brightness ${state.b}`} value={state.b} target={target.b} max={200} />
      <Bar label={`Contrast ${state.c}`} value={state.c} target={target.c} max={200} />
      <div className="w-full h-32 rounded-lg" style={{ filter: `brightness(${state.b}%) contrast(${state.c}%)`, background: "linear-gradient(45deg,#fbbf24,#ec4899,#3b82f6)" }} />
    </div>
  );
}
function Bar({ label, value, target, max }: { label: string; value: number; target: number; max: number }) {
  return (
    <div>
      <div className="text-xs">{label} (target {target})</div>
      <div className="w-full h-3 bg-gray-200 rounded relative">
        <div className="h-3 bg-emerald-500 rounded" style={{ width: `${(value / max) * 100}%` }} />
        <div className="absolute top-0 h-3 w-0.5 bg-orange-500" style={{ left: `${(target / max) * 100}%` }} />
      </div>
    </div>
  );
}
function TimelineViz({ state, target }: { state: Timeline; target: Timeline }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs mb-1">Current sequence:</div>
        <div className="flex gap-1">
          {state.length === 0 && <span className="text-xs text-gray-400">(empty)</span>}
          {state.map((s, i) => <span key={i} className={`px-2 py-1 text-xs rounded ${s === target[i] ? "bg-emerald-500 text-white" : "bg-yellow-200"}`}>{s}</span>)}
        </div>
      </div>
      <div>
        <div className="text-xs mb-1">Target:</div>
        <div className="flex gap-1">
          {target.map((s, i) => <span key={i} className="px-2 py-1 text-xs rounded bg-orange-200">{s}</span>)}
        </div>
      </div>
    </div>
  );
}
