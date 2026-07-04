import fs from 'node:fs';
import path from 'node:path';

const biblePath = process.argv[2] ?? 'docs/bible_kr.json';
const outputPath = process.argv[3] ?? 'docs/bible_kr_seed.sql';
const chunkDir = process.argv[4];
const oldTestamentCount = 39;

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function rowsToValues(rows) {
  return rows.map(row => `  (${row.map(sql).join(', ')})`).join(',\n');
}

function cleanVerseText(text) {
  return String(text).replaceAll('\u0000', '');
}

const bible = JSON.parse(fs.readFileSync(path.resolve(biblePath), 'utf8'));
const bookEntries = Object.entries(bible);
const books = bookEntries.map(([name, chapters], index) => [
  index + 1,
  name,
  name,
  index < oldTestamentCount ? 'old' : 'new',
  index + 1,
  Object.keys(chapters).length,
]);

const verses = [];
for (const [bookIndex, [, chapters]] of bookEntries.entries()) {
  for (const [chapter, chapterVerses] of Object.entries(chapters)) {
    for (const [verse, text] of Object.entries(chapterVerses)) {
      verses.push([
        bookIndex + 1,
        Number(chapter),
        Number(verse),
        cleanVerseText(text),
      ]);
    }
  }
}

const statements = [
  '-- Generated from docs/bible_kr.json',
  'BEGIN;',
  '',
  `INSERT INTO public.bible_books (id, korean_name, abbreviation, testament, book_order, chapter_count)\nVALUES\n${rowsToValues(books)}\nON CONFLICT (id) DO UPDATE SET\n  korean_name = EXCLUDED.korean_name,\n  abbreviation = EXCLUDED.abbreviation,\n  testament = EXCLUDED.testament,\n  book_order = EXCLUDED.book_order,\n  chapter_count = EXCLUDED.chapter_count;`,
  '',
];

const batchSize = 1000;
for (let index = 0; index < verses.length; index += batchSize) {
  const batch = verses.slice(index, index + batchSize);
  statements.push(
    `INSERT INTO public.bible_verses (book_id, chapter, verse, text)\nVALUES\n${rowsToValues(batch)}\nON CONFLICT (book_id, chapter, verse) DO UPDATE SET\n  text = EXCLUDED.text;`,
    ''
  );
}

statements.push('COMMIT;', '');

fs.writeFileSync(path.resolve(outputPath), statements.join('\n'), 'utf8');
console.log(`Generated ${outputPath} with ${books.length} books and ${verses.length} verses.`);

if (chunkDir) {
  const resolvedChunkDir = path.resolve(chunkDir);
  fs.mkdirSync(resolvedChunkDir, { recursive: true });

  const chunkSize = 500;
  const header = [
    '-- Generated from docs/bible_kr.json',
    '-- Run files in filename order.',
    '',
  ];

  const bookStatement = `INSERT INTO public.bible_books (id, korean_name, abbreviation, testament, book_order, chapter_count)\nVALUES\n${rowsToValues(books)}\nON CONFLICT (id) DO UPDATE SET\n  korean_name = EXCLUDED.korean_name,\n  abbreviation = EXCLUDED.abbreviation,\n  testament = EXCLUDED.testament,\n  book_order = EXCLUDED.book_order,\n  chapter_count = EXCLUDED.chapter_count;\n`;

  fs.writeFileSync(
    path.join(resolvedChunkDir, '001_bible_books.sql'),
    [...header, bookStatement].join('\n'),
    'utf8'
  );

  let fileNumber = 2;
  for (let index = 0; index < verses.length; index += chunkSize) {
    const batch = verses.slice(index, index + chunkSize);
    const statement = `INSERT INTO public.bible_verses (book_id, chapter, verse, text)\nVALUES\n${rowsToValues(batch)}\nON CONFLICT (book_id, chapter, verse) DO UPDATE SET\n  text = EXCLUDED.text;\n`;
    const filename = `${String(fileNumber).padStart(3, '0')}_bible_verses_${index + 1}_${index + batch.length}.sql`;
    fs.writeFileSync(path.join(resolvedChunkDir, filename), [...header, statement].join('\n'), 'utf8');
    fileNumber += 1;
  }

  console.log(`Generated ${fileNumber - 1} chunk files in ${chunkDir}.`);
}
