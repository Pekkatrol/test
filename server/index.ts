import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
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

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

type AuthedRequest = Request & { userId: string };

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
  const user = await prisma.user.findUnique({ where: { id: (req as AuthedRequest).userId } });
  if (!user) return res.status(401).json({ error: "Non connecté" });
  res.json({ id: user.id, email: user.email });
});

// ---------- Textes ----------
const textBody = (b: any) => ({
  title: typeof b?.title === "string" && b.title.trim() ? b.title.trim().slice(0, 200) : "Sans titre",
  content: typeof b?.content === "string" ? b.content : "",
});

app.get("/api/texts", auth, async (req, res) => {
  res.json(
    await prisma.text.findMany({
      where: { userId: (req as AuthedRequest).userId },
      orderBy: { updatedAt: "desc" },
    })
  );
});

app.post("/api/texts", auth, async (req, res) => {
  const text = await prisma.text.create({
    data: { ...textBody(req.body), userId: (req as AuthedRequest).userId },
  });
  res.status(201).json(text);
});

app.put("/api/texts/:id", auth, async (req, res) => {
  const r = await prisma.text.updateMany({
    where: { id: req.params.id, userId: (req as AuthedRequest).userId },
    data: textBody(req.body),
  });
  if (!r.count) return res.status(404).json({ error: "Texte introuvable" });
  res.json(await prisma.text.findUnique({ where: { id: req.params.id } }));
});

app.delete("/api/texts/:id", auth, async (req, res) => {
  const r = await prisma.text.deleteMany({
    where: { id: req.params.id, userId: (req as AuthedRequest).userId },
  });
  if (!r.count) return res.status(404).json({ error: "Texte introuvable" });
  res.json({ ok: true });
});

// ---------- Front (prod) ----------
if (isProd) {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`EpiCenter Notes sur http://localhost:${port}`));
