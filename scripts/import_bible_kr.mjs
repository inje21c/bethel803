import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile(path.resolve('.env'));
loadEnvFile(path.resolve('.env.local'));

const biblePath = process.argv[2] ?? 'docs/bible_kr.json';
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const oldTestamentCount = 39;
const bible = JSON.parse(fs.readFileSync(path.resolve(biblePath), 'utf8'));
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function cleanVerseText(text) {
  return String(text).replaceAll('\u0000', '');
}

const bookEntries = Object.entries(bible);
const books = bookEntries.map(([name, chapters], index) => ({
  id: index + 1,
  korean_name: name,
  abbreviation: name,
  testament: index < oldTestamentCount ? 'old' : 'new',
  book_order: index + 1,
  chapter_count: Object.keys(chapters).length,
}));

const verses = [];
for (const [bookIndex, [, chapters]] of bookEntries.entries()) {
  for (const [chapter, chapterVerses] of Object.entries(chapters)) {
    for (const [verse, text] of Object.entries(chapterVerses)) {
      verses.push({
        book_id: bookIndex + 1,
        chapter: Number(chapter),
        verse: Number(verse),
        text: cleanVerseText(text),
      });
    }
  }
}

const { error: booksError } = await supabase
  .from('bible_books')
  .upsert(books, { onConflict: 'id' });
if (booksError) throw booksError;

for (const batch of chunk(verses, 1000)) {
  const { error } = await supabase
    .from('bible_verses')
    .upsert(batch, { onConflict: 'book_id,chapter,verse' });
  if (error) throw error;
}

console.log(`Imported ${books.length} books and ${verses.length} verses from ${biblePath}.`);
