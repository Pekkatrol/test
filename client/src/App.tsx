import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { useNoCopyPaste } from "./useNoCopyPaste";

type User = { id: string; email: string };
type Text = { id: string; title: string; content: string; updatedAt: string };

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
      <h1>EpiCenter Notes</h1>
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
  const [current, setCurrent] = useState<Text | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api<Text[]>("/texts").then(setTexts).catch(() => {});
  }, []);

  function open(t: Text | null) {
    setCurrent(t);
    setTitle(t?.title ?? "");
    setContent(t?.content ?? "");
    setStatus("");
  }

  async function save() {
    try {
      const saved = current
        ? await api<Text>(`/texts/${current.id}`, "PUT", { title, content })
        : await api<Text>("/texts", "POST", { title, content });
      setCurrent(saved);
      setTexts((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      setStatus("Enregistré");
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  async function remove() {
    if (!current || !confirm("Supprimer ce texte ?")) return;
    await api(`/texts/${current.id}`, "DELETE");
    setTexts((prev) => prev.filter((t) => t.id !== current.id));
    open(null);
  }

  return (
    <div className="layout">
      <aside>
        <header>
          <span>{user.email}</span>
          <button className="link" onClick={onLogout}>Déconnexion</button>
        </header>
        <button onClick={() => open(null)}>Nouveau texte</button>
        <ul>
          {texts.map((t) => (
            <li key={t.id}>
              <button className={current?.id === t.id ? "active" : ""} onClick={() => open(t)}>
                {t.title}
              </button>
            </li>
          ))}
        </ul>
        {texts.length === 0 && <p className="muted">Aucun texte pour l'instant.</p>}
      </aside>
      <section className="editor">
        <input className="title" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Écris ici…" value={content} onChange={(e) => setContent(e.target.value)} />
        <footer>
          <button onClick={save}>Enregistrer</button>
          {current && <button className="danger" onClick={remove}>Supprimer</button>}
          <span className="muted">{status}</span>
        </footer>
      </section>
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
