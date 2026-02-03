import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";

const YEAR = 2026;

// Helpers
const formatDate = (iso) => {
  try {
    return iso ? new Date(iso).toLocaleString() : "";
  } catch {
    return "";
  }
};

export const MainPage = () => {
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [predictions, setPredictions] = useState([]);

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    picks: {}, // { category_id: nomineeText }
  });

  const [expandedPredictionId, setExpandedPredictionId] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  // Admin panel
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminFilter, setAdminFilter] = useState("");
  const [scoreboardFirst, setScoreboardFirst] = useState(false);
  const [hideOthersPicks, setHideOthersPicks] = useState(true);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState("predictions"); // "predictions" | "winners"
  const [winnerModalCategoryId, setWinnerModalCategoryId] = useState(null); // para abrir modal de elegir ganador

  // -----------------------------
  // Auth bootstrap
  // -----------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
      } catch (err) {
        console.error("Error getting user:", err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!email.trim()) {
      setAuthError("Escribe un correo primero.");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setAuthMessage("Te enviamos un enlace. Revisa tu correo para entrar. 📩");
    } catch (err) {
      console.error("Error signIn:", err);
      setAuthError("Hubo un problema enviando el enlace. Intenta de nuevo.");
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error("Error signOut:", err);
    }
  };

  // -----------------------------
  // Load data (categorías, nominados, predicciones)
  // -----------------------------
  useEffect(() => {
    const load = async () => {
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("*")
        .eq("year", YEAR)
        .order("sort_order", { ascending: true });

      const { data: nomData, error: nomErr } = await supabase
        .from("nominees")
        .select("*")
        .eq("year", YEAR)
        .order("sort_order", { ascending: true });

      const { data: predData, error: predErr } = await supabase
        .from("predictions")
        .select("*")
        .eq("year", YEAR)
        .order("created_at", { ascending: false });

      if (catErr) console.error(catErr);
      if (nomErr) console.error(nomErr);
      if (predErr) console.error(predErr);

      setCategories(catData || []);
      setNominees(nomData || []);
      setPredictions(predData || []);
    };

    load();
  }, []);

  // -----------------------------
  // Cargar settings globales (app_settings)
  // -----------------------------
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("hide_others_picks, scoreboard_on_top")
          .eq("year", YEAR)
          .single();

        if (error) {
          console.error("Error cargando app_settings:", error);
          return;
        }

        if (data) {
          setHideOthersPicks(!!data.hide_others_picks);
          setScoreboardFirst(!!data.scoreboard_on_top);
        }
      } catch (err) {
        console.error("Error inesperado cargando app_settings:", err);
      }
    };

    loadAppSettings();
  }, []);

  // Construir un diccionario: { [categoryId]: nomineeWinnerRow }
  const winnersByCategory = React.useMemo(() => {
    const map = {};
    nominees.forEach((n) => {
      if (n.is_winner) {
        map[n.category_id] = n;
      }
    });
    return map;
  }, [nominees]);

  // Calcular marcador: [{ id, name, points }]
  const scoreboard = React.useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    return predictions
      .map((p) => {
        let points = 0;

        categories.forEach((cat) => {
          const winner = winnersByCategory[cat.id];
          if (!winner) return; // aún no se ha marcado ganador en esa categoría

          const pick = p.picks ? p.picks[cat.id] : null;
          if (pick === winner.nominee) {
            points += 1;
          }
        });

        return {
          id: p.id,
          name: p.name,
          points,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
      });
  }, [predictions, categories, winnersByCategory]);

  // Helpers para marcador (top 3 + resto)
  const top3 = scoreboard.slice(0, 3);
  const restOfScoreboard = scoreboard.slice(3);

  const groupedNominees = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.id] = [];
    for (const n of nominees) {
      if (!map[n.category_id]) map[n.category_id] = [];
      map[n.category_id].push(n);
    }
    return map;
  }, [categories, nominees]);

  const currentCategory = categories[currentCategoryIndex] || null;
  const currentNominees = currentCategory
    ? groupedNominees[currentCategory.id] || []
    : [];

  const progressText = categories.length
    ? `${currentCategoryIndex + 1} / ${categories.length}`
    : "";

  const isAdmin = user && user.email === "pegomezp@gmail.com";

  // -----------------------------
  // Navigation
  // -----------------------------
  const prevCategory = () =>
    setCurrentCategoryIndex((i) => Math.max(0, i - 1));
  const nextCategory = () =>
    setCurrentCategoryIndex((i) =>
      Math.min(categories.length - 1, i + 1)
    );

  // -----------------------------
  // Predicción del usuario logueado
  // -----------------------------
  const myPrediction = useMemo(() => {
    if (!user) return null;
    const email = (user.email || "").toLowerCase();

    return (
      predictions.find(
        (p) => (p.email || "").toLowerCase() === email
      ) || null
    );
  }, [predictions, user]);

  // -----------------------------
  // Modal predicción
  // -----------------------------
  const openForm = (prediction = null) => {
    if (!user) {
      setAuthMessage(
        "Inicia sesión con tu correo para poder hacer predicciones."
      );
      return;
    }

    // Si me pasan una predicción (desde admin o lista), uso esa.
    // Si no, pero ya tengo una mía (myPrediction), la uso para editar.
    const base = prediction || myPrediction || null;

    if (base) {
      setEditingId(base.id);
      setForm({
        name: base.name || "",
        picks: base.picks || {},
      });
    } else {
      setEditingId(null);
      setForm({ name: "", picks: {} });
    }

    setModalOpen(true);
  };

  const closeForm = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const updatePick = (categoryId, nomineeText) => {
    setForm((prev) => ({
      ...prev,
      picks: {
        ...(prev.picks || {}),
        [categoryId]: nomineeText,
      },
    }));
  };

  const clearPick = (categoryId) => {
    setForm((prev) => {
      const next = { ...(prev.picks || {}) };
      delete next[categoryId];
      return { ...prev, picks: next };
    });
  };

  // -----------------------------
  // Submit / Delete
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!user) {
        setAuthMessage("Necesitas iniciar sesión para guardar tus predicciones.");
        return;
      }

      if (!form.name.trim()) return;

      if (editingId || myPrediction) {
        // UPDATE
        const idToUpdate = editingId || myPrediction.id;

        const { data, error } = await supabase
          .from("predictions")
          .update({
            name: form.name.trim(),
            picks: form.picks,
            user_id: user.id,
            email: (user.email || "").toLowerCase(),
          })
          .eq("id", idToUpdate)
          .select();

        if (error) throw error;

        const updated = data[0];
        setPredictions((prev) =>
          prev.map((p) => (p.id === idToUpdate ? updated : p))
        );
      } else {
        // INSERT
        const { data, error } = await supabase
          .from("predictions")
          .insert([
            {
              year: YEAR,
              name: form.name.trim(),
              picks: form.picks,
              user_id: user.id,
              email: (user.email || "").toLowerCase(),
            },
          ])
          .select();

        if (error) throw error;

        setPredictions((prev) => [data[0], ...prev]);
      }

      closeForm();
    } catch (err) {
      console.error("Error guardando predicción:", err);
    }
  };

  const deletePrediction = async (id) => {
    try {
      const { error } = await supabase.from("predictions").delete().eq("id", id);
      if (error) throw error;
      setPredictions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error eliminando predicción:", err);
    }
  };

  // -----------------------------
  // Admin panel helpers
  // -----------------------------
  const adminFilteredPredictions = useMemo(() => {
    const f = adminFilter.trim().toLowerCase();
    if (!f) return predictions;
    return predictions.filter((p) => {
      const email = (p.email || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      return email.includes(f) || name.includes(f);
    });
  }, [adminFilter, predictions]);

  const handleAdminBulkDelete = async () => {
    const f = adminFilter.trim().toLowerCase();
    if (!f) return;
    try {
      const { error } = await supabase
        .from("predictions")
        .delete()
        .eq("email", f);
      if (error) throw error;

      setPredictions((prev) =>
        prev.filter((p) => (p.email || "").toLowerCase() !== f)
      );
    } catch (err) {
      console.error("Error borrando en bloque:", err);
    }
  };

  const handleSetWinner = async (categoryId, nomineeId) => {
    try {
      // 1) limpiar ganadores previos de esa categoría
      const { error: clearErr } = await supabase
        .from("nominees")
        .update({ is_winner: false })
        .eq("year", YEAR)
        .eq("category_id", categoryId);

      if (clearErr) throw clearErr;

      // 2) marcar ganador
      const { error: setErr } = await supabase
        .from("nominees")
        .update({ is_winner: true })
        .eq("id", nomineeId);

      if (setErr) throw setErr;

      // 3) actualizar estado local
      setNominees((prev) =>
        prev.map((n) =>
          n.category_id === categoryId
            ? { ...n, is_winner: n.id === nomineeId }
            : n
        )
      );
    } catch (err) {
      console.error("Error marcando ganador:", err);
    }
  };

  // -----------------------------
  // Actualizar settings globales en app_settings (solo admin)
  // -----------------------------
  const updateGlobalSettings = async (patch) => {
    if (!isAdmin) {
      console.warn("Solo el admin puede cambiar los ajustes globales.");
      return;
    }

    try {
      // Optimistic update en el front
      if (Object.prototype.hasOwnProperty.call(patch, "hide_others_picks")) {
        setHideOthersPicks(!!patch.hide_others_picks);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "scoreboard_on_top")) {
        setScoreboardFirst(!!patch.scoreboard_on_top);
      }

      const { data, error } = await supabase
        .from("app_settings")
        .update(patch)
        .eq("year", YEAR)
        .select("hide_others_picks, scoreboard_on_top")
        .single();

      if (error) {
        console.error("Error actualizando app_settings:", error);
        return;
      }

      if (data) {
        setHideOthersPicks(!!data.hide_others_picks);
        setScoreboardFirst(!!data.scoreboard_on_top);
      }
    } catch (err) {
      console.error("Error inesperado actualizando app_settings:", err);
    }
  };

  // -----------------------------------
  // Styles (Oscars)
  // -----------------------------------
  const OSCAR_BLACK = "#0B0B0B";
  const OSCAR_GOLD = "#D4AF37";
  const OSCAR_GOLD_LIGHT = "#E6C65C";
  const OSCAR_TEXT = "#E5E5E5";

  const PosterTile = ({ title, imageUrl, selected }) => {
    return (
      <div
        className={[
          "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition",
          selected
            ? `bg-black`
            : "border-white/10 bg-black hover:border-white/25",
        ].join(" ")}
        style={{
          borderColor: selected ? OSCAR_GOLD : "rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="relative w-full rounded-xl overflow-hidden"
          style={{
            aspectRatio: "2/3",
            border: `1px solid ${
              selected ? OSCAR_GOLD : "rgba(212,175,55,0.35)"
            }`,
            boxShadow: selected
              ? `0 0 0 1px ${OSCAR_GOLD}, 0 0 18px rgba(212,175,55,0.35)`
              : "0 10px 25px rgba(0,0,0,0.35)",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-black via-black to-white/5 flex items-center justify-center px-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
                  Nominado
                </div>
                <div className="text-white/90 font-semibold leading-snug">
                  {title}
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0">
            <div className="spotlight absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-40 blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>

          <div
            className="pointer-events-none absolute top-3 right-3 h-2.5 w-2.5 rounded-full"
            style={{
              background: selected ? OSCAR_GOLD_LIGHT : "rgba(212,175,55,0.5)",
              boxShadow: selected
                ? `0 0 14px rgba(212,175,55,0.7)`
                : "none",
            }}
          />
        </div>

        <div className="mt-3">
          <div className="text-sm text-white/45 mb-1">Opción</div>
          <div
            className="font-semibold leading-snug"
            style={{ color: selected ? OSCAR_GOLD_LIGHT : OSCAR_TEXT }}
          >
            {title}
          </div>
        </div>

        {selected && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              boxShadow: `0 0 0 1px ${OSCAR_GOLD}, 0 0 22px rgba(212,175,55,0.22)`,
            }}
          />
        )}
      </div>
    );
  };

  const CrownIcon = () => (
    <svg
      viewBox="0 0 128 128"
      className="w-10 h-10 mb-2"
      style={{
        fill: OSCAR_GOLD,
        filter: "drop-shadow(0 0 6px rgba(212,175,55,0.6))",
      }}
    >
      <path d="M128 53.279c0 5.043-4.084 9.136-9.117 9.136-.091 0-.164 0-.255-.018l-8.914 34.06H18.286L8.734 65.01C3.884 64.81 0 60.808 0 55.892c0-5.043 4.084-9.136 9.117-9.136 5.032 0 9.117 4.093 9.117 9.136a9.557 9.557 0 0 1-.492 2.997l22.081 12.919 18.671-34.371a9.1 9.1 0 0 1-4.267-7.729c0-5.043 4.084-9.136 9.117-9.136s9.117 4.093 9.117 9.136a9.1 9.1 0 0 1-4.267 7.729l18.671 34.371 24.05-14.07a9.164 9.164 0 0 1-1.149-4.459c0-5.062 4.084-9.136 9.117-9.136 5.033 0 9.117 4.075 9.117 9.136zm-18.286 46.835H18.286v7.314h91.429v-7.314z" />
    </svg>
  );

  // ----- Secciones reutilizables para poder cambiar el orden -----

  const categorySection = (
    <>
      {/* Category section */}
      <div
        className="rounded-3xl p-6 sm:p-8 shadow-lg"
        style={{
          backgroundColor: "black",
          border: `1px solid rgba(212,175,55,0.35)`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">{progressText}</div>
            <h2
              className="text-2xl sm:text-3xl font-bold mt-1"
              style={{ color: OSCAR_GOLD }}
            >
              {currentCategory
                ? currentCategory.label
                : "Cargando categorías..."}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={prevCategory}
              disabled={currentCategoryIndex === 0}
              className="px-4 py-2 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: "rgba(212,175,55,0.45)",
                color: OSCAR_GOLD,
              }}
              onMouseEnter={(e) => {
                if (currentCategoryIndex === 0) return;
                e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                e.currentTarget.style.color = "black";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = OSCAR_GOLD;
              }}
            >
              ← Anterior
            </button>

            <button
              onClick={nextCategory}
              disabled={currentCategoryIndex >= categories.length - 1}
              className="px-4 py-2 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: "rgba(212,175,55,0.45)",
                color: OSCAR_GOLD,
              }}
              onMouseEnter={(e) => {
                if (currentCategoryIndex >= categories.length - 1) return;
                e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                e.currentTarget.style.color = "black";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = OSCAR_GOLD;
              }}
            >
              Siguiente →
            </button>

            <button
              onClick={() => openForm()}
              className="ml-0 sm:ml-2 px-6 py-2 rounded-xl font-semibold transition"
              style={{
                backgroundColor: user
                  ? OSCAR_GOLD
                  : "rgba(255,255,255,0.1)",
                color: user ? "black" : "rgba(255,255,255,0.5)",
                cursor: user ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (!user) return;
                e.currentTarget.style.backgroundColor = OSCAR_GOLD_LIGHT;
              }}
              onMouseLeave={(e) => {
                if (!user) return;
                e.currentTarget.style.backgroundColor = OSCAR_GOLD;
              }}
            >
              {user
                ? "Hacer Predicciones"
                : "Inicia sesión para participar"}
            </button>
          </div>
        </div>

        {/* Nominees */}
        <div className="mt-6">
          {currentNominees.length === 0 ? (
            <div className="text-white/60">
              No hay nominados cargados para esta categoría.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {currentNominees.map((n) => (
                <PosterTile
                  key={n.id}
                  title={n.nominee}
                  imageUrl={n.image_url}
                  selected={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const predictionsSection = (
    <>
      {/* Predictions list */}
      <div className="mt-10">
        <h3
          className="text-2xl font-bold mb-4"
          style={{ color: OSCAR_GOLD }}
        >
          Predicciones guardadas
        </h3>

        {predictions.length === 0 ? (
          <div className="text-white/60">Aún no hay predicciones.</div>
        ) : (
          <div className="space-y-4">
            {predictions.map((p) => {
              const isOpen = expandedPredictionId === p.id;
              const isMine = user && p.user_id === user.id;
              const canManage = isMine || isAdmin;
              const canSeePicks = isAdmin || isMine || !hideOthersPicks;

              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-5 shadow-sm"
                  style={{
                    backgroundColor: "black",
                    border: "1px solid rgba(212,175,55,0.25)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div
                        className="text-xl font-bold"
                        style={{ color: OSCAR_GOLD }}
                      >
                        {p.name}
                      </div>
                      <div className="text-sm text-white/50">
                        {formatDate(p.created_at)}
                      </div>
                      {isAdmin && p.email && (
                        <div className="text-xs text-white/40 mt-1">
                          ({p.email})
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          if (!canSeePicks) {
                            setShowRestrictionModal(true);
                            return;
                          }
                          setExpandedPredictionId(
                            isOpen ? null : p.id
                          );
                        }}
                        className="px-4 py-2 rounded-xl border transition"
                        style={{
                          borderColor: "rgba(212,175,55,0.45)",
                          color: OSCAR_GOLD,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            OSCAR_GOLD;
                          e.currentTarget.style.color = "black";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "transparent";
                          e.currentTarget.style.color = OSCAR_GOLD;
                        }}
                      >
                        {isOpen && canSeePicks ? "Ocultar" : "Ver picks"}
                      </button>

                      {canManage && (
                        <>
                          <button
                            onClick={() => openForm(p)}
                            className="px-4 py-2 rounded-xl border border-green-500 text-green-400 hover:bg-green-500 hover:text-black transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => deletePrediction(p.id)}
                            className="px-4 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-black transition"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isOpen && canSeePicks && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categories.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl p-3"
                            style={{
                              backgroundColor:
                                "rgba(255,255,255,0.03)",
                              border:
                                "1px solid rgba(212,175,55,0.18)",
                            }}
                          >
                            <div className="text-sm font-semibold text-white/70">
                              {c.label}
                            </div>
                            <div className="mt-1 text-white/90">
                              {p.picks && p.picks[c.id] ? (
                                p.picks[c.id]
                              ) : (
                                <span className="text-white/35">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const scoreboardSection = (
    <>
      {/* Marcador */}
      {(() => {
        if (!scoreboard || scoreboard.length === 0) {
          return (
            <div className="mt-12 mb-16 rounded-3xl border border-white/15 bg-black/60 px-6 py-6">
              <h2
                className="text-2xl font-bold text-center mb-6"
                style={{ color: OSCAR_GOLD }}
              >
                Marcador
              </h2>
              <p className="text-center text-gray-400">
                Aún no hay predicciones o todavía no se han marcado ganadores.
              </p>
            </div>
          );
        }

        // Configuración de alturas dinámicas
        const maxPoints = scoreboard[0]?.points ?? 0; // el que va ganando
        const MIN_HEIGHT = 180;
        const MAX_HEIGHT = 260;

        const getHeight = (points) => {
          if (maxPoints <= 0) return MIN_HEIGHT;
          const ratio = points / maxPoints; // 0–1
          return MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * ratio;
        };

        const top3 = scoreboard.slice(0, 3);
        const rest = scoreboard.slice(3);

        const Pillar = ({ entry, position }) => {
          const width =
            position === 1 ? "220px" : position === 2 ? "190px" : "170px";
          const height = getHeight(entry.points);

          const bgColor =
            position === 1
              ? "rgba(212,175,55,0.12)"
              : "rgba(255,255,255,0.04)";

          const borderColor =
            position === 1
              ? OSCAR_GOLD
              : "rgba(212,175,55,0.35)";

          const placeLabel =
            position === 1 ? "1° lugar" : position === 2 ? "2° lugar" : "3° lugar";

          return (
            <div
              className="rounded-2xl border shadow-sm px-5 py-5 flex flex-col items-center justify-end"
              style={{
                width,
                height: `${height}px`,
                backgroundColor: bgColor,
                borderColor,
              }}
            >
              {/* Corona solo para primer lugar */}
              {position === 1 && (
                <div className="mb-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 128 128"
                    className="w-9 h-9"
                  >
                    <path
                      d="M128 53.279c0 5.043-4.084 9.136-9.117 9.136-.091 0-.164 0-.255-.018l-8.914 34.06H18.286L8.734 65.01C3.884 64.81 0 60.808 0 55.892c0-5.043 4.084-9.136 9.117-9.136 5.032 0 9.117 4.093 9.117 9.136a9.557 9.557 0 0 1-.492 2.997l22.081 12.919 18.671-34.371a9.1 9.1 0 0 1-4.267-7.729c0-5.043 4.084-9.136 9.117-9.136s9.117 4.093 9.117 9.136a9.1 9.1 0 0 1-4.267 7.729l18.671 34.371 24.05-14.07a9.164 9.164 0 0 1-1.149-4.459c0-5.062 4.084-9.136 9.117-9.136 5.033 0 9.117 4.075 9.117 9.136zm-18.286 46.835H18.286v7.314h91.429v-7.314z"
                      fill={OSCAR_GOLD}
                    />
                  </svg>
                </div>
              )}

              <div
                className="text-xs uppercase tracking-wide mb-1"
                style={{
                  color:
                    position === 1 ? OSCAR_GOLD_LIGHT : "rgba(229,229,229,0.7)",
                }}
              >
                {placeLabel}
              </div>

              <div
                className="text-lg font-bold text-center mb-1"
                style={{ color: OSCAR_TEXT }}
              >
                {entry.name}
              </div>

              <div
                className="text-sm font-semibold px-3 py-1 rounded-full"
                style={{
                  color: position === 1 ? "#000" : OSCAR_GOLD_LIGHT,
                  backgroundColor:
                    position === 1 ? OSCAR_GOLD : "rgba(212,175,55,0.12)",
                  boxShadow:
                    position === 1
                      ? "0 0 16px rgba(212,175,55,0.6)"
                      : "0 0 10px rgba(212,175,55,0.25)",
                }}
              >
                {entry.points} punto{entry.points === 1 ? "" : "s"}
              </div>
            </div>
          );
        };

        return (
          <div className="max-w-5xl mx-auto mt-12 mb-16">
            <h2
              className="text-2xl font-bold text-center mb-6"
              style={{ color: OSCAR_GOLD }}
            >
              Marcador
            </h2>

            {/* Podio top 3 */}
            <div className="flex items-end justify-center gap-4 mb-10">
              {/* 2do lugar a la izquierda */}
              {top3[1] && (
                <Pillar
                  entry={top3[1]}
                  position={2}
                />
              )}

              {/* 1er lugar en el centro */}
              {top3[0] && (
                <Pillar
                  entry={top3[0]}
                  position={1}
                />
              )}

              {/* 3er lugar a la derecha */}
              {top3[2] && (
                <Pillar
                  entry={top3[2]}
                  position={3}
                />
              )}
            </div>

            {/* Resto de posiciones (4 en adelante) */}
            {rest.length > 0 && (
              <div
                className="rounded-3xl p-5 shadow-sm"
                style={{
                  backgroundColor: "black",
                  border: "1px solid rgba(212,175,55,0.35)",
                }}
              >
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: OSCAR_GOLD }}
                >
                  Resto del ranking
                </h3>

                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr
                      className="text-xs uppercase tracking-wide"
                      style={{ color: OSCAR_GOLD_LIGHT }}
                    >
                      <th className="px-3 py-2 text-left">Posición</th>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-right">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="border-t border-white/10 hover:bg-white/5 transition"
                      >
                        <td className="px-3 py-2">
                          {idx + 4}
                        </td>
                        <td className="px-3 py-2">
                          {entry.name}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {entry.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: OSCAR_BLACK,
        color: OSCAR_TEXT,
      }}
    >
      <style>{`
        @keyframes spotlightMove {
          0% { transform: translate(0px, 0px) scale(1); opacity: .35; }
          50% { transform: translate(42px, 28px) scale(1.05); opacity: .55; }
          100% { transform: translate(0px, 0px) scale(1); opacity: .35; }
        }
        .spotlight {
          background: radial-gradient(circle at center, rgba(212,175,55,0.55), rgba(212,175,55,0.0) 60%);
          animation: spotlightMove 6.5s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header con login y admin */}
        <header className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1
              className="text-4xl sm:text-5xl font-extrabold tracking-tight"
              style={{ color: OSCAR_GOLD }}
            >
              Predicciones de los Óscares
            </h1>
            <p className="text-gray-400 mt-2">
              Navega por categorías, revisa nominados y crea tu predicción (Año{" "}
              {YEAR}).
            </p>

            {isAdmin && (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold border border-white/25 text-white/80 hover:bg-white/10 transition"
              >
                Abrir panel admin
              </button>
            )}
          </div>

          {/* Login box */}
          <div
            className="w-full md:w-auto rounded-2xl p-4 border shadow-sm"
            style={{
              backgroundColor: "black",
              borderColor: "rgba(212,175,55,0.35)",
            }}
          >
            {authLoading ? (
              <div className="text-sm text-white/70">Cargando sesión...</div>
            ) : user ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-gray-400">
                  Conectado
                </div>
                <div className="text-sm font-semibold">{user.email}</div>
                <button
                  onClick={handleSignOut}
                  className="mt-2 px-4 py-2 rounded-xl border text-sm transition"
                  style={{
                    borderColor: "rgba(212,175,55,0.45)",
                    color: OSCAR_GOLD,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                    e.currentTarget.style.color = "black";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = OSCAR_GOLD;
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-gray-400">
                  Entra con tu correo
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent focus:outline-none"
                  style={{
                    borderColor: "rgba(255,255,255,0.18)",
                    color: OSCAR_TEXT,
                  }}
                  placeholder="tucorreo@example.com"
                />
                <button
                  type="submit"
                  className="w-full mt-1 px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    backgroundColor: OSCAR_GOLD,
                    color: "black",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      OSCAR_GOLD_LIGHT)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = OSCAR_GOLD)
                  }
                >
                  Enviarme enlace
                </button>
                {authMessage && (
                  <div className="text-xs text-green-400 mt-1">
                    {authMessage}
                  </div>
                )}
                {authError && (
                  <div className="text-xs text-red-400 mt-1">
                    {authError}
                  </div>
                )}
              </form>
            )}
          </div>
        </header>

        {scoreboardFirst ? (
          <>
            {scoreboardSection}
            {predictionsSection}
            {categorySection}
          </>
        ) : (
          <>
            {categorySection}
            {predictionsSection}
            {scoreboardSection}
          </>
        )}
      </div>

      {/* Modal de predicción */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden"
            style={{
              backgroundColor: "black",
              border: "1px solid rgba(212,175,55,0.40)",
            }}
          >
            <div className="p-6 sm:p-7 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: OSCAR_GOLD }}
                  >
                    {editingId ? "Editar Predicción" : "Nueva Predicción"}
                  </h2>
                  <p className="text-white/60 mt-1">
                    Elige un nominado por categoría. (Puedes dejar algunas en
                    blanco.)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-xl border transition"
                  style={{
                    borderColor: "rgba(212,175,55,0.45)",
                    color: OSCAR_GOLD,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                    e.currentTarget.style.color = "black";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = OSCAR_GOLD;
                  }}
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-white/70 mb-1">
                  Tu nombre
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-xl border px-4 py-3 focus:outline-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(212,175,55,0.25)",
                    color: OSCAR_TEXT,
                  }}
                  placeholder={"Ej. Pedro"}
                  required
                />
              </div>
            </div>

            <div className="p-6 sm:p-7 max-h-[65vh] overflow-y-auto">
              <div className="space-y-6">
                {categories.map((c) => {
                  const opts = groupedNominees[c.id] || [];
                  const selected = form.picks?.[c.id] || "";

                  return (
                    <div
                      key={c.id}
                      className="rounded-3xl p-5"
                      style={{
                        border: "1px solid rgba(212,175,55,0.18)",
                        backgroundColor: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className="text-lg font-bold"
                          style={{ color: OSCAR_GOLD }}
                        >
                          {c.label}
                        </div>

                        <div className="flex items-center gap-2">
                          {selected ? (
                            <span
                              className="text-sm px-3 py-1 rounded-full border"
                              style={{
                                borderColor: "rgba(212,175,55,0.45)",
                                color: OSCAR_GOLD_LIGHT,
                                backgroundColor:
                                  "rgba(212,175,55,0.08)",
                                boxShadow:
                                  "0 0 14px rgba(212,175,55,0.12)",
                              }}
                            >
                              Seleccionado
                            </span>
                          ) : (
                            <span className="text-sm px-3 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
                              Sin seleccionar
                            </span>
                          )}

                          {selected && (
                            <button
                              type="button"
                              onClick={() => clearPick(c.id)}
                              className="text-sm px-3 py-1 rounded-full border border-white/15 text-white/70 hover:bg-white/5 transition"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {opts.map((n) => {
                          const isPicked = selected === n.nominee;

                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => updatePick(c.id, n.nominee)}
                              className="text-left"
                              style={{ outline: "none" }}
                            >
                              <PosterTile
                                title={n.nominee}
                                imageUrl={n.image_url}
                                selected={isPicked}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {selected && (
                        <div className="mt-4 text-sm text-white/70">
                          Tu pick:{" "}
                          <span
                            className="font-semibold"
                            style={{
                              color: OSCAR_GOLD_LIGHT,
                              textShadow:
                                "0 0 12px rgba(212,175,55,0.35)",
                            }}
                          >
                            {selected}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 sm:p-7 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2 rounded-xl bg-transparent border border-white/15 text-white/70 hover:bg-white/5 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-6 py-2 rounded-xl font-semibold transition"
                style={{
                  backgroundColor: OSCAR_GOLD,
                  color: "black",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = OSCAR_GOLD_LIGHT)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = OSCAR_GOLD)
                }
              >
                {editingId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Panel Admin */}
      {adminModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 px-4">
          <div
            className="w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden"
            style={{
              backgroundColor: "black",
              border: "1px solid rgba(212,175,55,0.40)",
            }}
          >
            {/* Header */}
            <div className="p-6 sm:p-7 border-b border-white/10 flex items-start justify-between gap-4">
              {/* LADO IZQUIERDO */}
              <div className="flex flex-col gap-3">
                <div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: OSCAR_GOLD }}
                  >
                    Panel admin
                  </h2>
                  <p className="text-white/60 text-sm mt-1">
                    Filtra por correo o nombre para revisar y borrar predicciones.
                  </p>
                </div>
              </div>

              {/* LADO DERECHO */}
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm transition"
                style={{
                  borderColor: "rgba(212,175,55,0.45)",
                  color: OSCAR_GOLD,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                  e.currentTarget.style.color = "black";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = OSCAR_GOLD;
                }}
              >
                Cerrar
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 sm:px-7 pt-4 border-b border-white/10">
              <div className="inline-flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveAdminTab("predictions")}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    activeAdminTab === "predictions"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  Predicciones / borrar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab("winners")}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    activeAdminTab === "winners"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  Marcar ganadores
                </button>
              </div>
            </div>

            {/* TAB 1: Manejo de predicciones */}
            {activeAdminTab === "predictions" && (
              <>
                <div className="p-6 sm:p-7 border-b border-white/10">
                  <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <input
                      value={adminFilter}
                      onChange={(e) => setAdminFilter(e.target.value)}
                      className="w-full md:w-2/3 rounded-xl border px-4 py-2 text-sm bg-transparent focus:outline-none"
                      style={{
                        borderColor: "rgba(255,255,255,0.18)",
                        color: OSCAR_TEXT,
                      }}
                      placeholder="Buscar por correo (ej. alguien@mail.com) o nombre..."
                    />
                    <button
                      type="button"
                      onClick={handleAdminBulkDelete}
                      disabled={!adminFilter.trim()}
                      className="px-4 py-2 rounded-xl border text-sm transition disabled:opacity-40 disabled:cursor-not-allowed border-red-500 text-red-400 hover:bg-red-500 hover:text-black"
                    >
                      Borrar todas las de este correo
                    </button>
                  </div>

                  <div className="text-xs text-white/40 mt-2">
                    Nota: el borrado masivo usa coincidencia exacta con el campo
                    correo (email).
                  </div>
                </div>

                <div className="p-6 sm:p-7 max-h-[60vh] overflow-y-auto">
                  {adminFilteredPredictions.length === 0 ? (
                    <div className="text-white/60 text-sm">
                      No hay predicciones que coincidan con el filtro.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminFilteredPredictions.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-2xl p-4 border border-white/15 bg-black/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div>
                            <div
                              className="text-sm font-semibold"
                              style={{ color: OSCAR_GOLD }}
                            >
                              {p.name || "(sin nombre)"}
                            </div>
                            <div className="text-xs text-white/50">
                              {formatDate(p.created_at)}
                            </div>
                            {p.email && (
                              <div className="text-xs text-white/40 mt-1">
                                {p.email}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPredictionId(
                                  expandedPredictionId === p.id ? null : p.id
                                )
                              }
                              className="px-3 py-1 rounded-xl border text-xs transition"
                              style={{
                                borderColor: "rgba(212,175,55,0.45)",
                                color: OSCAR_GOLD,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  OSCAR_GOLD;
                                e.currentTarget.style.color = "black";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                                e.currentTarget.style.color = OSCAR_GOLD;
                              }}
                            >
                              {expandedPredictionId === p.id
                                ? "Ocultar picks"
                                : "Ver picks"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePrediction(p.id)}
                              className="px-3 py-1 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-black text-xs transition"
                            >
                              Eliminar
                            </button>
                          </div>

                          {expandedPredictionId === p.id && (
                            <div className="mt-3 w-full border-t border-white/10 pt-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {categories.map((c) => (
                                  <div
                                    key={c.id}
                                    className="rounded-xl p-2 text-xs"
                                    style={{
                                      backgroundColor:
                                        "rgba(255,255,255,0.03)",
                                      border:
                                        "1px solid rgba(212,175,55,0.18)",
                                    }}
                                  >
                                    <div className="font-semibold text-white/70">
                                      {c.label}
                                    </div>
                                    <div className="mt-1 text-white/90">
                                      {p.picks && p.picks[c.id] ? (
                                        p.picks[c.id]
                                      ) : (
                                        <span className="text-white/35">
                                          —
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: Marcar ganadores */}
            {activeAdminTab === "winners" && (
              <div className="p-6 sm:p-7 max-h-[70vh] overflow-y-auto">
                <p className="text-white/60 text-sm mb-2">
                  Cada tarjeta muestra la categoría y el ganador actual. Haz clic
                  en &quot;Elegir ganador&quot; para ver los nominados con sus
                  posters y seleccionar uno.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    updateGlobalSettings({
                      scoreboard_on_top: !scoreboardFirst,
                    })
                  }
                  className="self-start px-4 py-2 rounded-xl border text-sm font-semibold transition mb-2"
                  style={{
                    borderColor: "rgba(212,175,55,0.45)",
                    color: OSCAR_GOLD,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                    e.currentTarget.style.color = "black";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = OSCAR_GOLD;
                  }}
                >
                  {scoreboardFirst ? "Vista normal" : "Mostrar marcador arriba"}
                </button>

                {/* Toggle global de visibilidad de predicciones */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-white/80">
                  <div>
                    <div className="font-semibold">
                      Visibilidad de predicciones
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      Cuando está activado, cada usuario solo puede ver sus propios picks.
                      El admin siempre puede ver todo.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateGlobalSettings({
                        hide_others_picks: !hideOthersPicks,
                      })
                    }
                    className="px-4 py-2 rounded-xl border text-xs font-semibold transition"
                    style={{
                      borderColor: "rgba(212,175,55,0.45)",
                      color: hideOthersPicks ? OSCAR_GOLD : "white",
                      backgroundColor: hideOthersPicks
                        ? "rgba(212,175,55,0.15)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                      e.currentTarget.style.color = "black";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = hideOthersPicks
                        ? "rgba(212,175,55,0.15)"
                        : "transparent";
                      e.currentTarget.style.color = hideOthersPicks
                        ? OSCAR_GOLD
                        : "white";
                    }}
                  >
                    {hideOthersPicks
                      ? "Ocultar picks de otros"
                      : "Permitir ver picks de otros"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {categories.map((c) => {
                    const winner = winnersByCategory[c.id];

                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl p-4 border border-white/15 bg-black/40 flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="font-semibold text-sm"
                            style={{ color: OSCAR_GOLD }}
                          >
                            {c.label}
                          </div>
                          <div className="text-xs text-right text-white/60">
                            Winner:{" "}
                            <span
                              className="font-semibold"
                              style={{ color: OSCAR_GOLD_LIGHT }}
                            >
                              {winner ? winner.nominee : "Sin definir"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setWinnerModalCategoryId(c.id)}
                          className="self-end px-4 py-2 rounded-xl border text-xs sm:text-sm transition"
                          style={{
                            borderColor: "rgba(212,175,55,0.45)",
                            color: OSCAR_GOLD,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                            e.currentTarget.style.color = "black";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                            e.currentTarget.style.color = OSCAR_GOLD;
                          }}
                        >
                          Elegir ganador
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal elegir ganador (admin) */}
      {winnerModalCategoryId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          {(() => {
            const category = categories.find(
              (c) => c.id === winnerModalCategoryId
            );
            const opts = category ? groupedNominees[category.id] || [] : [];

            if (!category) {
              return null;
            }

            const currentWinner = winnersByCategory[category.id];

            return (
              <div
                className="w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden"
                style={{
                  backgroundColor: "black",
                  border: "1px solid rgba(212,175,55,0.40)",
                }}
              >
                <div className="p-6 sm:p-7 border-b border-white/10 flex items-start justify-between gap-3">
                  <div>
                    <h2
                      className="text-2xl font-bold"
                      style={{ color: OSCAR_GOLD }}
                    >
                      Elegir ganador
                    </h2>
                    <p className="text-white/60 mt-1 text-sm">
                      Categoría:{" "}
                      <span className="font-semibold">{category.label}</span>
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      Haz clic en un nominado para marcarlo como ganador.
                    </p>
                    {currentWinner && (
                      <p className="text-white/60 text-xs mt-2">
                        Ganador actual:{" "}
                        <span
                          className="font-semibold"
                          style={{ color: OSCAR_GOLD_LIGHT }}
                        >
                          {currentWinner.nominee}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWinnerModalCategoryId(null)}
                    className="px-4 py-2 rounded-xl border text-sm transition"
                    style={{
                      borderColor: "rgba(212,175,55,0.45)",
                      color: OSCAR_GOLD,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                      e.currentTarget.style.color = "black";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = OSCAR_GOLD;
                    }}
                  >
                    Cerrar
                  </button>
                </div>

                <div className="p-6 sm:p-7 max-h-[65vh] overflow-y-auto">
                  {opts.length === 0 ? (
                    <div className="text-white/60 text-sm">
                      No hay nominados cargados para esta categoría.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {opts.map((n) => {
                        const isWinner =
                          currentWinner && currentWinner.id === n.id;
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={async () => {
                              await handleSetWinner(category.id, n.id);
                              setWinnerModalCategoryId(null);
                            }}
                            className="text-left"
                            style={{ outline: "none" }}
                          >
                            <PosterTile
                              title={n.nominee}
                              imageUrl={n.image_url}
                              selected={isWinner}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal de restricción de visibilidad de picks */}
      {showRestrictionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div
            className="w-full max-w-md rounded-3xl shadow-xl p-6 sm:p-7 text-center"
            style={{
              backgroundColor: "black",
              border: "1px solid rgba(212,175,55,0.40)",
            }}
          >
            <h2
              className="text-2xl font-bold mb-3"
              style={{ color: OSCAR_GOLD }}
            >
              Picks ocultos hasta la ceremonia
            </h2>
            <p className="text-sm text-white/70 mb-4">
              Los picks de otros participantes están ocultos para que nadie copie
              las predicciones. Podrás verlos después de la ceremonia de los
              Óscares.
            </p>
            <button
              type="button"
              onClick={() => setShowRestrictionModal(false)}
              className="px-5 py-2 rounded-xl border text-sm font-semibold transition"
              style={{
                borderColor: "rgba(212,175,55,0.45)",
                color: OSCAR_GOLD,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = OSCAR_GOLD;
                e.currentTarget.style.color = "black";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = OSCAR_GOLD;
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
