// Builds tests/fixtures/parts-crossword.sdmod: synthetic module with three parts + a crossword.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const act = (id, n, title, parts) => ({ id, number: n, title, parts });
const info = (id, t) => ({ id, label: 'A', type: 'info', content: t });
const mod = {
  format: 'studydesk-module', formatVersion: 1, id: 'parts-crossword-demo', version: '1.0.0', title: 'Capitolo a tre parti', subtitle: 'Modulo sintetico di prova',
  course: 'Demo', level: 'A1', language: 'it', color: '#7cb342', description: 'Modulo sintetico con le tre parti e un cruciverba.',
  author: { name: 'Test' }, createdAt: '2026-10-30T00:00:00Z',
  objectives: [{ title: 'Obiettivi di prova', items: ['Provare le schede', 'Provare il cruciverba'] }],
  sections: [
    { id: 's-main', title: 'Lezione', icon: 'book-open', part: 'main', activities: [act('m1', '1', 'Leggi', [info('m1-a', 'Testo di prova.')])] },
    { id: 's-ex', title: 'Eserciziario', icon: 'pen', part: 'exercises', activities: [
      act('e1', '2', 'Cruciverba', [{
        id: 'e1-a', label: 'A', type: 'crossword', instructions: 'Completa il cruciverba.', rows: 4, cols: 4,
        entries: [
          { number: 1, direction: 'across', row: 0, col: 0, answer: 'MENU', clue: 'Lista dei piatti' },
          { number: 1, direction: 'down', row: 0, col: 0, answer: 'MELA', clue: 'Frutto rosso o verde' },
          { number: 2, direction: 'down', row: 0, col: 2, answer: 'NOTE', clue: 'Si scrivono sul quaderno' },
        ],
        solutionWord: { label: 'Parola nascosta', cells: [[0, 3], [0, 1]] },
      }]),
    ] },
    { id: 's-vid', title: 'Videocorso', icon: 'video', part: 'video', activities: [act('v1', '3', 'Episodio', [info('v1-a', 'Guarda il video (finto).')])] },
  ],
};

(async () => {
  const zip = new JSZip();
  zip.file('module.json', JSON.stringify(mod, null, 2));
  const out = path.join(__dirname, '..', 'tests', 'fixtures', 'parts-crossword.sdmod');
  fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('written', out);
})();
