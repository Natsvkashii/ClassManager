// Copies third-party browser assets from node_modules into app/vendor so the app works fully offline.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'app', 'vendor');
const nm = (...p) => path.join(root, 'node_modules', ...p);

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

copy(nm('jszip', 'dist', 'jszip.min.js'), path.join(vendor, 'jszip.min.js'));
copy(nm('@fortawesome', 'fontawesome-free', 'css', 'all.min.css'), path.join(vendor, 'fontawesome', 'css', 'all.min.css'));
copy(nm('@fortawesome', 'fontawesome-free', 'webfonts'), path.join(vendor, 'fontawesome', 'webfonts'));
for (const w of ['400', '500', '600', '700', '800']) {
  copy(nm('@fontsource', 'inter', 'files', `inter-latin-${w}-normal.woff2`), path.join(vendor, 'inter', `inter-${w}.woff2`));
}
console.log('vendor assets copied to', vendor);
