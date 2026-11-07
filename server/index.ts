import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import "express-async-errors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET manquant");
const isProd = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

type AuthedRequest = Request & { userId: string };
const uid = (req: Request) => (req as AuthedRequest).userId;

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const cleanTitle = (s: unknown, fallback: string) =>
  typeof s === "string" && s.trim() ? s.trim().slice(0, 200) : fallback;

function setCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET!, { expiresIn: "7d" });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = jwt.verify(req.cookies.token, JWT_SECRET!) as { sub: string };
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Non connecté" });
  }
}

const validEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// ---------- Auth ----------
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!validEmail(email)) return res.status(400).json({ error: "Email invalide" });
  if (typeof password !== "string" || password.length < 8)
    return res.status(400).json({ error: "Mot de passe : 8 caractères minimum" });
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return res.status(409).json({ error: "Email déjà utilisé" });
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), password: await bcrypt.hash(password, 12) },
  });
  setCookie(res, user.id);
  res.status(201).json({ id: user.id, email: user.email });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = validEmail(email)
    ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    : null;
  if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Identifiants incorrects" });
  setCookie(res, user.id);
  res.json({ id: user.id, email: user.email });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: uid(req) } });
  if (!user) return res.status(401).json({ error: "Non connecté" });
  res.json({ id: user.id, email: user.email });
});

// ---------- Textes ----------
const withChapters = { chapters: { orderBy: { position: "asc" as const } } };

app.get("/api/texts", auth, async (req, res) => {
  res.json(
    await prisma.text.findMany({
      where: { userId: uid(req) },
      orderBy: { updatedAt: "desc" },
      include: withChapters,
    })
  );
});

app.post("/api/texts", auth, async (req, res) => {
  const text = await prisma.text.create({
    data: {
      title: cleanTitle(req.body?.title, "Sans titre"),
      userId: uid(req),
      chapters: { create: { title: "Chapitre 1", position: 0 } },
    },
    include: withChapters,
  });
  res.status(201).json(text);
});

app.put("/api/texts/:id", auth, async (req, res) => {
  const r = await prisma.text.updateMany({
    where: { id: req.params.id, userId: uid(req) },
    data: { title: cleanTitle(req.body?.title, "Sans titre") },
  });
  if (!r.count) return res.status(404).json({ error: "Texte introuvable" });
  res.json({ ok: true });
});

app.delete("/api/texts/:id", auth, async (req, res) => {
  const r = await prisma.text.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!r.count) return res.status(404).json({ error: "Texte introuvable" });
  res.json({ ok: true });
});

// ---------- Chapitres ----------
app.post("/api/texts/:id/chapters", auth, async (req, res) => {
  const text = await prisma.text.findFirst({ where: { id: req.params.id, userId: uid(req) } });
  if (!text) return res.status(404).json({ error: "Texte introuvable" });
  const [count, last] = await Promise.all([
    prisma.chapter.count({ where: { textId: text.id } }),
    prisma.chapter.aggregate({ where: { textId: text.id }, _max: { position: true } }),
  ]);
  const chapter = await prisma.chapter.create({
    data: {
      textId: text.id,
      title: cleanTitle(req.body?.title, `Chapitre ${count + 1}`),
      position: (last._max.position ?? -1) + 1,
    },
  });
  res.status(201).json(chapter);
});

app.put("/api/chapters/:id", auth, async (req, res) => {
  const userId = uid(req);
  const chapter = await prisma.chapter.findFirst({
    where: { id: req.params.id, text: { userId } },
  });
  if (!chapter) return res.status(404).json({ error: "Chapitre introuvable" });

  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const wordCount = countWords(content);
  const delta = wordCount - chapter.wordCount;
  const date = validDate(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10);

  const updated = await prisma.chapter.update({
    where: { id: chapter.id },
    data: { title: cleanTitle(req.body?.title, chapter.title), content, wordCount },
  });
  await prisma.text.update({ where: { id: chapter.textId }, data: { updatedAt: new Date() } });
  if (delta !== 0) {
    await prisma.wordLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, words: delta },
      update: { words: { increment: delta } },
    });
  }
  res.json(updated);
});


// ---------- Progression ----------
app.get("/api/stats", auth, async (req, res) => {
  const since = new Date(Date.now() - 62 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  res.json(
    await prisma.wordLog.findMany({
      where: { userId: uid(req), date: { gte: since } },
      select: { date: true, words: true },
      orderBy: { date: "asc" },
    })
  );
});

// ---------- Erreurs ----------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});

// ---------- Front (prod) ----------
if (isProd) {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`WritingTomate sur http://localhost:${port}`));
