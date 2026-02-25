import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconBot, IconRefresh, IconUsers } from "../icons";

type AgentProfile = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: string;
};

type BotConfig = {
  id: string;
  type: string;
  name: string;
  agent_profile_id: string;
  enabled: boolean;
};

type HealthStats = {
  [agentId: string]: {
    total_requests: number;
    successful: number;
    failed: number;
    success_rate: number;
    avg_latency_ms: number;
    pending_messages: number;
  };
};

// ────────────────────────────────────────────────────────────
// Utility: hex → rgba
// ────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ────────────────────────────────────────────────────────────
// Main Dashboard Component
// ────────────────────────────────────────────────────────────
export function AgentDashboardView({
  apiBaseUrl = "http://127.0.0.1:18900",
  visible = true,
  multiAgentEnabled = false,
}: {
  apiBaseUrl?: string;
  visible?: boolean;
  multiAgentEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [health, setHealth] = useState<HealthStats>({});
  const [loading, setLoading] = useState(false);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!multiAgentEnabled) return;
    setLoading(true);
    try {
      const [profileRes, botRes, healthRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/agents/profiles`),
        fetch(`${apiBaseUrl}/api/agents/bots`),
        fetch(`${apiBaseUrl}/api/agents/health`).catch(() => null),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfiles(data.profiles || []);
      }
      if (botRes.ok) {
        const data = await botRes.json();
        setBots(data.bots || []);
      }
      if (healthRes?.ok) {
        const data = await healthRes.json();
        setHealth(data.health || {});
      }
    } catch (e) {
      console.warn("Failed to fetch dashboard data:", e);
    }
    setLoading(false);
  }, [apiBaseUrl, multiAgentEnabled]);

  useEffect(() => {
    if (visible && multiAgentEnabled) fetchData();
  }, [visible, multiAgentEnabled, fetchData]);

  // Auto-refresh profiles + health every 10s so dynamic agents appear quickly
  useEffect(() => {
    if (!visible || !multiAgentEnabled) return;
    const interval = setInterval(async () => {
      try {
        const [profileRes, healthRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/agents/profiles`).catch(() => null),
          fetch(`${apiBaseUrl}/api/agents/health`).catch(() => null),
        ]);
        if (profileRes?.ok) {
          const data = await profileRes.json();
          setProfiles(data.profiles || []);
        }
        if (healthRes?.ok) {
          const data = await healthRes.json();
          setHealth(data.health || {});
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [visible, multiAgentEnabled, apiBaseUrl]);

  if (!multiAgentEnabled) {
    return (
      <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>
        <IconBot size={48} />
        <div style={{ marginTop: 12, fontWeight: 700 }}>{t("dashboard.disabled")}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{t("dashboard.enableHint")}</div>
      </div>
    );
  }

  const totalRequests = Object.values(health).reduce((a, h) => a + h.total_requests, 0);
  const totalSuccess = Object.values(health).reduce((a, h) => a + h.successful, 0);
  const totalFailed = Object.values(health).reduce((a, h) => a + h.failed, 0);
  const avgLatency = Object.values(health).length
    ? Object.values(health).reduce((a, h) => a + h.avg_latency_ms, 0) / Object.values(health).length
    : 0;

  return (
    <div className="agent-dash" style={{ height: "100%", overflow: "auto", position: "relative" }}>
      <DashStyles />
      <ParticleBackground visible={visible && multiAgentEnabled} profiles={profiles} />

      <div style={{ position: "relative", zIndex: 1, padding: 24 }}>
        {/* Header */}
        <div className="dash-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="dash-logo-ring">
              <IconUsers size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
                {t("dashboard.title")}
              </h2>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                {profiles.length} Agent{profiles.length !== 1 ? "s" : ""} · {bots.length} Bot{bots.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <button className="dash-btn-refresh" onClick={fetchData} disabled={loading}>
            <IconRefresh size={14} className={loading ? "spin" : ""} />
            {loading ? t("dashboard.loading") : t("dashboard.refresh")}
          </button>
        </div>

        {/* Stats Overview */}
        <div className="dash-stats-row">
          <StatCard label="Total Requests" value={totalRequests} icon="📊" color="#7c3aed" />
          <StatCard label="Successful" value={totalSuccess} icon="✅" color="#10b981" />
          <StatCard label="Failed" value={totalFailed} icon="❌" color="#ef4444" />
          <StatCard label="Avg Latency" value={`${avgLatency.toFixed(0)}ms`} icon="⚡" color="#f59e0b" />
        </div>

        {/* Orbital Visualization */}
        <OrbitalGraph
          profiles={profiles}
          bots={bots}
          health={health}
          hoveredAgent={hoveredAgent}
          onHoverAgent={setHoveredAgent}
        />

        {/* Agent Cards */}
        <h3 className="dash-section-title">{t("dashboard.agents")}</h3>
        <div className="dash-agent-grid">
          {profiles.map((agent) => {
            const h = health[agent.id];
            const botCount = bots.filter(b => b.agent_profile_id === agent.id).length;
            const isHovered = hoveredAgent === agent.id;
            const isActive = h && (h.pending_messages > 0 || h.total_requests > 0);
            const isDynamic = agent.type === "dynamic";
            return (
              <div
                key={agent.id}
                className={`dash-agent-card ${isHovered ? "hovered" : ""} ${isActive ? "active" : ""}`}
                style={{ "--agent-color": agent.color || "#3b82f6" } as React.CSSProperties}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                <div className="dash-agent-card-glow" />
                <div className="dash-agent-card-inner">
                  <div className="dash-agent-card-header">
                    <div className="dash-agent-icon" style={{ background: hexToRgba(agent.color || "#3b82f6", 0.15), position: "relative" }}>
                      <span>{agent.icon}</span>
                      {h && h.pending_messages > 0 && (
                        <span className="dash-agent-active-dot" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dash-agent-name">
                        {agent.name}
                        {isDynamic && <span className="dash-agent-dynamic-badge">动态</span>}
                      </div>
                      <div className="dash-agent-id">{agent.id}</div>
                    </div>
                    {botCount > 0 && (
                      <div className="dash-agent-bot-badge" style={{ background: hexToRgba(agent.color || "#3b82f6", 0.12) }}>
                        🤖 {botCount}
                      </div>
                    )}
                  </div>
                  <div className="dash-agent-desc">{agent.description}</div>
                  {h && (
                    <div className="dash-agent-stats">
                      <div className="dash-agent-stat">
                        <div className="dash-agent-stat-val" style={{ color: "#10b981" }}>
                          {(h.success_rate * 100).toFixed(0)}%
                        </div>
                        <div className="dash-agent-stat-label">Success</div>
                      </div>
                      <div className="dash-agent-stat">
                        <div className="dash-agent-stat-val" style={{ color: "#f59e0b" }}>
                          {h.avg_latency_ms.toFixed(0)}ms
                        </div>
                        <div className="dash-agent-stat-label">Latency</div>
                      </div>
                      <div className="dash-agent-stat">
                        <div className="dash-agent-stat-val" style={{ color: "#3b82f6" }}>
                          {h.total_requests}
                        </div>
                        <div className="dash-agent-stat-label">Requests</div>
                      </div>
                      {h.pending_messages > 0 && (
                        <div className="dash-agent-stat">
                          <div className="dash-agent-stat-val pulse-text" style={{ color: "#ef4444" }}>
                            {h.pending_messages}
                          </div>
                          <div className="dash-agent-stat-label">Pending</div>
                        </div>
                      )}
                    </div>
                  )}
                  {!h && (
                    <div className="dash-agent-idle">Idle — no requests yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bot Cards */}
        {bots.length > 0 && (
          <>
            <h3 className="dash-section-title">{t("dashboard.bots")}</h3>
            <div className="dash-bot-grid">
              {bots.map((bot) => {
                const agent = profiles.find(p => p.id === bot.agent_profile_id);
                return (
                  <div key={bot.id} className={`dash-bot-card ${bot.enabled ? "" : "disabled"}`}>
                    <div className="dash-bot-status">
                      <span className={`dash-bot-dot ${bot.enabled ? "online" : ""}`} />
                      <span className="dash-bot-name">{bot.name || bot.id}</span>
                      <span className="dash-bot-type">{bot.type}</span>
                    </div>
                    <div className="dash-bot-agent">
                      → {agent ? `${agent.icon} ${agent.name}` : bot.agent_profile_id}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Stats Card
// ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="dash-stat-card" style={{ "--stat-color": color } as React.CSSProperties}>
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Particle Background (Canvas)
// ────────────────────────────────────────────────────────────
function ParticleBackground({ visible, profiles }: { visible: boolean; profiles: AgentProfile[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    const colors = profiles.length
      ? profiles.map(p => p.color || "#3b82f6")
      : ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
    const particles: Particle[] = [];
    const MAX_PARTICLES = 80;

    const resize = () => {
      const dpr = window.devicePixelRatio;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 1 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      while (particles.length < MAX_PARTICLES) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.001 + Math.random() * 0.001;
        if (p.life <= 0 || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = Math.min(p.life / p.maxLife, 1) * 0.5;

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.08;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Lines between close particles
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 100) * alpha * 0.25;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [visible, profiles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0, opacity: 0.6,
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Orbital Graph (SVG with CSS animations)
// ────────────────────────────────────────────────────────────
function OrbitalGraph({
  profiles,
  bots,
  health,
  hoveredAgent,
  onHoverAgent,
}: {
  profiles: AgentProfile[];
  bots: BotConfig[];
  health: HealthStats;
  hoveredAgent: string | null;
  onHoverAgent: (id: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 700, H = 420;
  const CX = W / 2, CY = H / 2;

  const agentNodes = useMemo(() => profiles.map((p, i) => {
    const count = Math.max(profiles.length, 1);
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const r = Math.min(W, H) * 0.25;
    return { ...p, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), angle };
  }), [profiles, CX, CY, W, H]);

  const botNodes = useMemo(() => bots.map((b, i) => {
    const count = Math.max(bots.length, 1);
    const angle = (2 * Math.PI * i) / count - Math.PI / 2 + Math.PI / count;
    const r = Math.min(W, H) * 0.42;
    return { ...b, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
  }), [bots, CX, CY, W, H]);

  const edges = useMemo(() => {
    const result: { bx: number; by: number; ax: number; ay: number; color: string; botId: string; agentId: string }[] = [];
    for (const bot of botNodes) {
      const agent = agentNodes.find(a => a.id === bot.agent_profile_id);
      if (agent) {
        result.push({
          bx: bot.x, by: bot.y,
          ax: agent.x, ay: agent.y,
          color: agent.color || "#3b82f6",
          botId: bot.id,
          agentId: agent.id,
        });
      }
    }
    return result;
  }, [agentNodes, botNodes]);

  if (profiles.length === 0) return null;

  return (
    <div className="dash-orbital-container">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="dash-orbital-svg"
      >
        <defs>
          {/* Orbit rings */}
          <radialGradient id="orbit-grad">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="95%" stopColor="transparent" />
            <stop offset="100%" stopColor="var(--fg, #333)" stopOpacity="0.04" />
          </radialGradient>
          {/* Glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strong-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbit rings */}
        <circle cx={CX} cy={CY} r={Math.min(W, H) * 0.25} fill="none" stroke="var(--fg, #333)" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx={CX} cy={CY} r={Math.min(W, H) * 0.42} fill="none" stroke="var(--fg, #333)" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="3 8" />

        {/* Center core */}
        <circle cx={CX} cy={CY} r={18} fill="var(--fg, #333)" opacity={0.04} />
        <circle cx={CX} cy={CY} r={6} fill="#7c3aed" opacity={0.6}>
          <animate attributeName="r" values="5;8;5" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Edges with animated flowing dots */}
        {edges.map((e, i) => {
          const highlighted = hoveredAgent === e.agentId;
          return (
            <g key={`edge-${i}`} opacity={hoveredAgent && !highlighted ? 0.15 : 1} style={{ transition: "opacity 0.3s" }}>
              <line
                x1={e.bx} y1={e.by} x2={e.ax} y2={e.ay}
                stroke={e.color}
                strokeWidth={highlighted ? 2 : 1}
                strokeOpacity={highlighted ? 0.6 : 0.2}
                strokeDasharray="4 6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
              </line>
              {/* Flowing dot */}
              <circle r={highlighted ? 3 : 2} fill={e.color} filter={highlighted ? "url(#node-glow)" : undefined}>
                <animateMotion
                  dur={`${2 + i * 0.3}s`}
                  repeatCount="indefinite"
                  path={`M${e.bx},${e.by} L${e.ax},${e.ay}`}
                />
                <animate attributeName="opacity" values="0;1;1;0" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Bot nodes (outer) */}
        {botNodes.map((b) => {
          const agent = agentNodes.find(a => a.id === b.agent_profile_id);
          const highlighted = hoveredAgent === b.agent_profile_id;
          return (
            <g
              key={`bot-${b.id}`}
              opacity={hoveredAgent && !highlighted ? 0.2 : 1}
              style={{ transition: "opacity 0.3s", cursor: "pointer" }}
              onMouseEnter={() => onHoverAgent(b.agent_profile_id)}
              onMouseLeave={() => onHoverAgent(null)}
            >
              <rect
                x={b.x - 22} y={b.y - 14} width={44} height={28} rx={8}
                fill={b.enabled ? (agent?.color || "#10b981") : "#6b7280"}
                opacity={0.12}
              />
              <rect
                x={b.x - 18} y={b.y - 10} width={36} height={20} rx={6}
                fill={b.enabled ? (agent?.color || "#10b981") : "#6b7280"}
                opacity={highlighted ? 0.9 : 0.7}
                filter={highlighted ? "url(#node-glow)" : undefined}
              />
              <text x={b.x} y={b.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="11">🤖</text>
              <text x={b.x} y={b.y + 24} textAnchor="middle" fontSize="9" fill="var(--fg, #333)" opacity="0.6" fontWeight="500">
                {b.name || b.id}
              </text>
            </g>
          );
        })}

        {/* Agent nodes (inner) */}
        {agentNodes.map((a) => {
          const h = health[a.id];
          const highlighted = hoveredAgent === a.id;
          const hasActivity = h && h.total_requests > 0;
          return (
            <g
              key={`agent-${a.id}`}
              style={{ cursor: "pointer", transition: "opacity 0.3s" }}
              opacity={hoveredAgent && !highlighted ? 0.25 : 1}
              onMouseEnter={() => onHoverAgent(a.id)}
              onMouseLeave={() => onHoverAgent(null)}
            >
              {/* Pulse rings for active agents */}
              {hasActivity && (
                <>
                  <circle cx={a.x} cy={a.y} r={28} fill="none" stroke={a.color || "#3b82f6"} strokeWidth="1">
                    <animate attributeName="r" values="24;36;24" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
              {/* Outer glow */}
              <circle
                cx={a.x} cy={a.y} r={highlighted ? 30 : 26}
                fill={a.color || "#3b82f6"} opacity={highlighted ? 0.2 : 0.1}
                style={{ transition: "all 0.3s" }}
              />
              {/* Main circle */}
              <circle
                cx={a.x} cy={a.y} r={22}
                fill={a.color || "#3b82f6"}
                opacity={highlighted ? 1 : 0.85}
                filter={highlighted ? "url(#strong-glow)" : "url(#node-glow)"}
                style={{ transition: "all 0.3s" }}
              />
              {/* Icon */}
              <text x={a.x} y={a.y + 1} textAnchor="middle" dominantBaseline="central" fontSize="18">{a.icon}</text>
              {/* Name */}
              <text
                x={a.x} y={a.y + 38} textAnchor="middle" fontSize="11"
                fill="var(--fg, #333)" fontWeight="700" opacity={highlighted ? 1 : 0.8}
              >
                {a.name}
              </text>
              {/* Stats under name */}
              {h && highlighted && (
                <text x={a.x} y={a.y + 52} textAnchor="middle" fontSize="9" fill={a.color || "#3b82f6"} fontWeight="500">
                  {(h.success_rate * 100).toFixed(0)}% · {h.avg_latency_ms.toFixed(0)}ms · {h.total_requests} req
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// All CSS in one component
// ────────────────────────────────────────────────────────────
function DashStyles() {
  return (
    <style>{`
      .agent-dash {
        background:
          radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.04) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 100%, rgba(59,130,246,0.04) 0%, transparent 60%),
          var(--bg, #fff);
      }
      .dash-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 20px;
      }
      .dash-logo-ring {
        width: 40px; height: 40px; border-radius: 12px;
        background: linear-gradient(135deg, #7c3aed22, #3b82f622);
        display: flex; align-items: center; justify-content: center;
        border: 1px solid rgba(124,58,237,0.15);
      }
      .dash-btn-refresh {
        display: flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 10px;
        border: 1px solid var(--line); background: var(--panel);
        cursor: pointer; font-size: 13px; font-weight: 500;
        transition: all 0.2s;
      }
      .dash-btn-refresh:hover { border-color: #7c3aed; color: #7c3aed; }
      .dash-btn-refresh:disabled { opacity: 0.5; cursor: wait; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .spin { animation: spin 1s linear infinite; }

      /* Stats row */
      .dash-stats-row {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
        margin-bottom: 24px;
      }
      @media (max-width: 700px) { .dash-stats-row { grid-template-columns: repeat(2, 1fr); } }
      .dash-stat-card {
        padding: 16px; border-radius: 14px;
        background: var(--panel);
        border: 1px solid var(--line);
        position: relative; overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .dash-stat-card::before {
        content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: var(--stat-color, #3b82f6);
        opacity: 0.6;
      }
      .dash-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      }
      .dash-stat-icon { font-size: 20px; margin-bottom: 6px; }
      .dash-stat-value { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
      .dash-stat-label { font-size: 11px; opacity: 0.45; margin-top: 2px; font-weight: 500; }

      /* Section title */
      .dash-section-title {
        font-size: 13px; font-weight: 700; opacity: 0.5; margin: 24px 0 14px 0;
        text-transform: uppercase; letter-spacing: 0.5px;
      }

      /* Orbital */
      .dash-orbital-container {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px;
        margin-bottom: 8px;
        overflow: hidden;
        position: relative;
      }
      .dash-orbital-svg {
        width: 100%; height: auto; max-height: 420px;
        display: block;
      }

      /* Agent cards */
      .dash-agent-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;
      }
      .dash-agent-card {
        position: relative; border-radius: 14px; overflow: hidden;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .dash-agent-card:hover, .dash-agent-card.hovered {
        transform: translateY(-3px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.08);
      }
      .dash-agent-card-glow {
        position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px;
        border-radius: 15px;
        background: linear-gradient(135deg, var(--agent-color), transparent 60%);
        opacity: 0.12;
        transition: opacity 0.3s;
      }
      .dash-agent-card:hover .dash-agent-card-glow,
      .dash-agent-card.hovered .dash-agent-card-glow { opacity: 0.25; }
      .dash-agent-card-inner {
        position: relative; z-index: 1; padding: 18px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 14px;
      }
      .dash-agent-card:hover .dash-agent-card-inner,
      .dash-agent-card.hovered .dash-agent-card-inner {
        border-color: var(--agent-color);
      }
      .dash-agent-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
      .dash-agent-icon {
        width: 44px; height: 44px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; flex-shrink: 0;
      }
      .dash-agent-name { font-weight: 700; font-size: 15px; }
      .dash-agent-id { font-size: 11px; opacity: 0.4; font-family: monospace; }
      .dash-agent-bot-badge {
        padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600;
        white-space: nowrap;
      }
      .dash-agent-desc {
        font-size: 12px; opacity: 0.55; margin-bottom: 12px; line-height: 1.4;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .dash-agent-stats {
        display: flex; gap: 16px; padding-top: 10px;
        border-top: 1px solid var(--line);
      }
      .dash-agent-stat-val { font-size: 14px; font-weight: 800; }
      .dash-agent-stat-label { font-size: 10px; opacity: 0.4; margin-top: 1px; }
      .dash-agent-idle {
        font-size: 11px; opacity: 0.3; font-style: italic;
        padding-top: 10px; border-top: 1px solid var(--line);
      }

      @keyframes pulse-text { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      .pulse-text { animation: pulse-text 1.5s ease-in-out infinite; }

      .dash-agent-active-dot {
        position: absolute; top: 2px; right: 2px;
        width: 8px; height: 8px; border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
        animation: pulse-text 1.2s ease-in-out infinite;
      }
      .dash-agent-dynamic-badge {
        display: inline-block; margin-left: 6px;
        padding: 1px 6px; border-radius: 6px;
        font-size: 9px; font-weight: 600;
        background: rgba(124,58,237,0.1);
        color: #7c3aed; letter-spacing: 0.3px;
        vertical-align: middle;
      }
      .dash-agent-card.active .dash-agent-card-inner {
        border-color: var(--agent-color);
        box-shadow: 0 0 12px rgba(var(--agent-color), 0.15);
      }

      /* Bot cards */
      .dash-bot-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;
      }
      .dash-bot-card {
        padding: 14px; border-radius: 12px;
        background: var(--panel); border: 1px solid var(--line);
        transition: transform 0.2s;
      }
      .dash-bot-card:hover { transform: translateY(-1px); }
      .dash-bot-card.disabled { opacity: 0.45; }
      .dash-bot-status { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .dash-bot-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #6b7280; flex-shrink: 0;
      }
      .dash-bot-dot.online { background: #10b981; box-shadow: 0 0 6px #10b981; }
      .dash-bot-name { font-weight: 600; font-size: 13px; }
      .dash-bot-type { font-size: 11px; opacity: 0.35; margin-left: auto; }
      .dash-bot-agent { font-size: 12px; opacity: 0.55; }
    `}</style>
  );
}
