import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "./api";
import StatsChart from "./StatsChart";
import { countWords, localDate, type Chapter, type Log, type Text, type User } from "./types";
import { useNoCopyPaste } from "./useNoCopyPaste";

function AuthForm({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      onAuth(await api<User>(`/auth/${mode}`, "POST", { email, password }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="auth">
      <h1>🍅 WritingTomate</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">{mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
      </button>
    </main>
  );
}

function Editor({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [texts, setTexts] = useState<Text[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [view, setView] = useState<"write" | "stats">("write");
  const [textId, setTextId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [chTitle, setChTitle] = useState("");
  const [pages, setPages] = useState<string[]>([""]);
  const [pageIndex, setPageIndex] = useState(0);
  const content = pages.join("\f");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");

  const text = texts.find((t) => t.id === textId) ?? null;
  const chapter = text?.chapters.find((c) => c.id === chapterId) ?? null;

  const loadLogs = () => api<Log[]>("/stats").then(setLogs).catch(() => {});

  useEffect(() => {
    api<Text[]>("/texts").then(setTexts).catch(() => {});
    loadLogs();
  }, []);

  function openChapter(t: Text, c: Chapter) {
    setTextId(t.id);
    setChapterId(c.id);
    setTextTitle(t.title);
    setChTitle(c.title);
    setPages(c.content.split("\f"));
    setPageIndex(0);
    setDirty(false);
    setStatus("");
    setView("write");
  }

  function guard(action: () => void) {
    if (dirty && !confirm("Modifications non enregistrées. Continuer ?")) return;
    action();
  }

  const edit = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  async function save() {
    if (!text || !chapter) return;
    try {
      if (textTitle !== text.title) await api(`/texts/${text.id}`, "PUT", { title: textTitle });
      const saved = await api<Chapter>(`/chapters/${chapter.id}`, "PUT", {
        title: chTitle,
        content,
        date: localDate(),
      });
      setTexts((prev) =>
        prev.map((t) =>
          t.id === text.id
            ? { ...t, title: textTitle, chapters: t.chapters.map((c) => (c.id === saved.id ? saved : c)) }
            : t
        )
      );
      setDirty(false);
      setStatus("Enregistré");
      loadLogs();
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  async function newText() {
    const t = await api<Text>("/texts", "POST", { title: "Sans titre" });
    setTexts((prev) => [t, ...prev]);
    openChapter(t, t.chapters[0]);
  }

  async function removeText() {
    if (!text || !confirm(`Supprimer « ${text.title} » et tous ses chapitres ?`)) return;
    await api(`/texts/${text.id}`, "DELETE");
    setTexts((prev) => prev.filter((t) => t.id !== text.id));
    setTextId(null);
    setChapterId(null);
    setDirty(false);
  }

  async function addChapter() {
    if (!text) return;
    const c = await api<Chapter>(`/texts/${text.id}/chapters`, "POST", {});
    const updated = { ...text, chapters: [...text.chapters, c] };
    setTexts((prev) => prev.map((t) => (t.id === text.id ? updated : t)));
    openChapter(updated, c);
  }

  function addPage() {
    setPages((p) => [...p.slice(0, pageIndex + 1), "", ...p.slice(pageIndex + 1)]);
    setPageIndex(pageIndex + 1);
    setDirty(true);
  }

  const chapterWords = countWords(content);
  const textWords = text
    ? text.chapters.reduce((n, c) => n + (c.id === chapterId ? chapterWords : c.wordCount), 0)
    : 0;
  const todayWords = Math.max(0, logs.find((l) => l.date === localDate())?.words ?? 0);

  return (
    <div className="layout">
      <aside>
        <header>
          <span>{user.email}</span>
          <button className="link" onClick={() => guard(onLogout)}>Déconnexion</button>
        </header>
        <button onClick={() => guard(newText)}>Nouveau texte</button>
        <button className="secondary" onClick={() => guard(() => setView(view === "stats" ? "write" : "stats"))}>
          {view === "stats" ? "Retour à l'écriture" : `Progression (${todayWords} aujourd'hui)`}
        </button>
        <ul>
          {texts.map((t) => (
            <li key={t.id}>
              <button
                className={t.id === textId && view === "write" ? "active" : ""}
                onClick={() => guard(() => openChapter(t, t.chapters[0]))}
              >
                <span className="name">{t.id === textId ? textTitle : t.title}</span>
                <span className="count">
                  {t.id === textId ? textWords : t.chapters.reduce((n, c) => n + c.wordCount, 0)} mots
                </span>
              </button>
            </li>
          ))}
        </ul>
        {texts.length === 0 && <p className="muted">Aucun texte pour l'instant.</p>}
      </aside>

      {view === "stats" ? (
        <section className="editor">
          <h2>Progression</h2>
          <StatsChart logs={logs} />
        </section>
      ) : text && chapter ? (
        <section className="editor">
          <input className="title" placeholder="Titre du texte" value={textTitle} onChange={edit(setTextTitle)} />
          <nav className="chapters">
            {text.chapters.map((c) => (
              <button
                key={c.id}
                className={c.id === chapterId ? "tab active" : "tab"}
                onClick={() => c.id !== chapterId && guard(() => openChapter(text, c))}
              >
                {c.id === chapterId ? chTitle || "Sans titre" : c.title}
              </button>
            ))}
            <button className="tab add" onClick={() => guard(addChapter)}>+ Chapitre</button>
          </nav>
          <input className="chapter-title" placeholder="Titre du chapitre" value={chTitle} onChange={edit(setChTitle)} />
          <textarea
              placeholder="Écris ici…"
              value={pages[pageIndex]}
              onChange={(e) => {
                setPages((p) => p.map((v, i) => (i === pageIndex ? e.target.value : v)));
                setDirty(true);
              }}
            />
            <div className="pager">
              <button className="secondary" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>‹</button>
              <span>Page {pageIndex + 1} / {pages.length}</span>
              <button className="secondary" disabled={pageIndex === pages.length - 1} onClick={() => setPageIndex(pageIndex + 1)}>›</button>
              <button className="link" onClick={addPage}>+ Page</button>
            </div>
          <footer>
            <button onClick={save}>Enregistrer</button>
            <button className="link danger-link" onClick={removeText}>Supprimer le texte</button>
            <span className="muted">{dirty && !status ? "Non enregistré" : status}</span>
            <span className="counter">
              <strong>{chapterWords}</strong> mots dans ce chapitre, <strong>{textWords}</strong> dans le texte
            </span>
          </footer>
        </section>
      ) : (
        <section className="editor empty">
          <p className="muted">Crée un texte ou ouvre-en un pour écrire.</p>
        </section>
      )}
    </div>
  );
}

export default function App() {
  useNoCopyPaste();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) return <AuthForm onAuth={setUser} />;
  return (
    <Editor
      user={user}
      onLogout={async () => {
        await api("/auth/logout", "POST");
        setUser(null);
      }}
    />
  );
}
