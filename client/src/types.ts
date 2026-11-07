export type User = { id: string; email: string };
export type Chapter = { id: string; title: string; content: string; position: number; wordCount: number };
export type Text = { id: string; title: string; chapters: Chapter[] };
export type Log = { date: string; words: number };

export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
