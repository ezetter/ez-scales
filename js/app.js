/*
 * Piano Scale Fingerings: the controls, the grand staff (drawn with VexFlow) and the fingering
 * table. The music theory, including the fingering itself, is in theory.js.
 */
(() => {
  'use strict';

  const T = window.ScaleTheory;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'piano-scale-fingerings';
  const DEFAULTS = { root: 'C', family: 'major', mode: 'ionian', form: 'natural', octaves: 1, order: 'alphabetical' };
  // Horizontal room per note on the staff, in px: the fewest before the staff scrolls sideways,
  // and the most before a short scale looks stretched.
  const MIN_SPACING = 30;
  const MAX_SPACING = 64;
  const VEX_ALTER = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
  const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

  const $ = id => document.getElementById(id);
  const controls = $('controls');
  // Every setting: the scale controls plus the display options at the top right.
  const settingsEl = document.querySelector('.page');
  const rootsEl = $('roots');
  const scoreEl = $('score');

  const state = loadState();
  let current = null;
  let renderedWidth = 0;

  // Settings last until the next visit where the browser allows storage; nothing depends on it.
  function loadState() {
    const settings = { ...DEFAULTS };
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      saved = null;
    }
    if (saved && typeof saved === 'object') {
      if (T.parseId(saved.root)) settings.root = saved.root;
      if (saved.family === 'major' || saved.family === 'minor') settings.family = saved.family;
      if (T.MODES.some(m => m.id === saved.mode)) settings.mode = saved.mode;
      if (T.MINOR_FORMS.some(f => f.id === saved.form)) settings.form = saved.form;
      if (saved.octaves === 1 || saved.octaves === 2) settings.octaves = saved.octaves;
      if (saved.order === 'alphabetical' || saved.order === 'fifths') settings.order = saved.order;
    }
    settings.root = T.idOf(T.matchRoot(T.parseId(settings.root), settings));
    return settings;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private windows and blocked storage just start from the defaults next time.
    }
  }

  const escapeHTML = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // A note name as HTML, with its sharp or flat in a span styled to sit like a printed accidental.
  function nameHTML(note) {
    const name = T.nameOf(note);
    return name.length > 1 ? `${name[0]}<span class="acc">${name.slice(1)}</span>` : name;
  }
  const namesHTML = notes => notes.map(nameHTML).join(' ');

  function choiceHTML(name, value, label) {
    return `<label class="pick choice"><input type="radio" name="${name}" id="${name}-${value}" value="${value}">` +
      `<span>${escapeHTML(label)}</span></label>`;
  }

  $('modes').innerHTML = T.MODES.map(m => choiceHTML('mode', m.id, m.name)).join('');
  $('forms').innerHTML = T.MINOR_FORMS.map(f => choiceHTML('form', f.id, f.name)).join('');

  // The 13 root buttons, spelled for the current scale, alphabetically or round the circle of
  // fifths. They're only rebuilt when the spellings or order change, so keyboard focus stays put
  // while moving through them.
  function renderRoots() {
    const roots = T.rootsFor(state, state.order);
    const spellings = roots.map(T.idOf).join(' ');
    if (rootsEl.dataset.roots === spellings) return;
    rootsEl.dataset.roots = spellings;
    rootsEl.innerHTML = roots.map(root => {
      const id = T.idOf(root);
      return `<label class="pick key${T.isBlackKey(root) ? ' is-black' : ''}">` +
        `<input type="radio" name="root" id="root-${id}" value="${id}" aria-label="${T.spokenName(root)}">` +
        `<span>${nameHTML(root)}</span></label>`;
    }).join('');
  }

  function syncControls() {
    renderRoots();
    const values = { root: state.root, family: state.family, mode: state.mode, form: state.form, octaves: String(state.octaves), order: state.order };
    for (const [name, value] of Object.entries(values)) {
      const input = settingsEl.querySelector(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    }
    $('mode-field').hidden = state.family !== 'major';
    $('form-field').hidden = state.family !== 'minor';
  }

  settingsEl.addEventListener('change', event => {
    const { name, value } = event.target;
    if (name === 'root') {
      state.root = value;
    } else if (name === 'octaves') {
      state.octaves = Number(value);
    } else if (name === 'order') {
      state.order = value;
    } else if (name === 'family' || name === 'mode' || name === 'form') {
      state[name] = value;
      // Same key, spelled the new scale's way: G♭ major becomes F♯ minor.
      state.root = T.idOf(T.matchRoot(T.parseId(state.root), state));
    }
    update();
  });
  controls.addEventListener('submit', event => event.preventDefault());

  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  function signatureHTML(signature) {
    if (!signature.count) return 'No sharps or flats';
    return `${plural(signature.count, signature.kind)}: ${namesHTML(signature.accidentals)}`;
  }

  // Title, subtitle and the facts beside them. Values are HTML built from note names.
  function renderHeading(scale) {
    const rootName = T.nameOf(scale.root);
    $('scale-title').innerHTML = nameHTML(scale.root) + escapeHTML(scale.title.slice(rootName.length));
    $('scale-sub').textContent = `${scale.octaves === 1 ? 'One octave' : 'Two octaves'}, ascending and descending`;
    const parent = `${nameHTML(scale.signature.major)} major`;
    const facts = [['Key signature', signatureHTML(scale.signature)]];
    if (scale.type.family === 'major') {
      const { mode } = scale.type;
      facts.push(['Mode', mode.number === 1 ? 'Ionian, the major scale' : `${ORDINALS[mode.number]} mode of ${parent}`]);
    } else {
      facts.push(['Relative major', parent]);
      if (scale.type.form.id === 'harmonic') facts.push(['Raised 7th', nameHTML(scale.up[6])]);
      if (scale.type.form.id === 'melodic') facts.push(['Raised going up', `${nameHTML(scale.up[5])} and ${nameHTML(scale.up[6])}`]);
    }
    if (scale.type.family === 'minor' && scale.type.form.id === 'melodic') {
      facts.push(['Ascending', namesHTML(scale.up)]);
      facts.push(['Descending', namesHTML([...scale.down].reverse())]);
    } else {
      facts.push(['Notes', namesHTML(scale.up)]);
    }
    $('facts').innerHTML = facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
  }

  // Colors for what VexFlow draws; the finger numbers take theirs from the stylesheet.
  function tokens() {
    const css = getComputedStyle(document.documentElement);
    const get = name => css.getPropertyValue(name).trim();
    return { ink: get('--ink'), staff: get('--staff') };
  }

  const vexKey = note => `${'cdefgab'[note.letter]}${VEX_ALTER[note.alter]}/${note.octave}`;

  function svgElement(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function addText(svg, x, y, text, className, anchor = 'middle') {
    const node = svgElement('text', { x, y, 'text-anchor': anchor, class: className });
    node.textContent = text;
    svg.appendChild(node);
  }

  // Staff positions are 5px apart and stems 35px long. Each hand's finger row sits clear of every
  // notehead, stem and accidental on its side of the system, and the staves move apart to fit
  // notes that reach toward each other. tops[] is each staff's top-line y; rows[] is the baseline
  // of each finger row.
  function verticalLayout(scale) {
    const [treble, bass] = scale.staves.map(part => {
      const topStep = part.clef === 'treble' ? 38 : 26;
      let above = 0;
      let below = 0;
      part.notes.forEach(note => {
        const y = (topStep - note.step) * 5;
        const stemUp = note.step < topStep - 4;
        const high = Math.min(stemUp ? y - 35 : y - 6, note.accidental ? y - 16 : y - 6);
        const low = Math.max(stemUp ? y + 6 : y + 35, note.accidental ? y + 12 : y + 6);
        above = Math.max(above, -high);
        below = Math.max(below, low - 40);
      });
      return { above, below };
    });
    const rightRow = Math.max(24, treble.above + 12);
    const trebleTop = 30 + rightRow;
    const bassTop = trebleTop + 40 + Math.max(60, treble.below + bass.above + 24);
    const leftRow = bassTop + 40 + Math.max(32, bass.below + 24);
    return { tops: [trebleTop, bassTop], rows: [trebleTop - rightRow, leftRow], height: leftRow + 16 };
  }

  function describeScore(scale) {
    const rootName = T.nameOf(scale.root);
    const name = T.spokenName(scale.root) + scale.title.slice(rootName.length);
    const signature = scale.signature.count ? plural(scale.signature.count, scale.signature.kind) : 'no sharps or flats';
    return `Grand staff: ${name}, ${scale.octaves === 1 ? 'one octave' : 'two octaves'} up and down, ` +
      `with ${signature} in the key signature. The table below lists each note's finger.`;
  }

  // The system: treble over bass, joined by a brace. The first bar runs up to the top note and
  // the second comes back down.
  function renderScore(scale) {
    scoreEl.setAttribute('aria-label', describeScore(scale));
    renderedWidth = Math.floor(scoreEl.clientWidth);
    if (!window.Vex) {
      scoreEl.innerHTML = '<p class="score-error">The notation library didn’t load, so the staff can’t be drawn. ' +
        'Check your internet connection and reload the page. The fingering table below still works.</p>';
      return;
    }
    const VF = Vex.Flow;
    const colors = tokens();
    const width = renderedWidth;
    const count = scale.staves[0].notes.length;
    const bars = [[0, scale.top], [scale.top + 1, count - 1]];

    // Clefs and key signature, then the same room for every note: as much as fits, within limits.
    const brace = 16;
    const header = Math.max(...scale.staves.map(part =>
      new VF.Stave(0, 0, 400).addClef(part.clef).addKeySignature(scale.signature.vexKey).getNoteStartX()));
    const lead = new VF.Stave(0, 0, 400).getNoteStartX();
    const tail = 18;
    const spacing = Math.max(MIN_SPACING, Math.min(MAX_SPACING, (width - brace - 2 - header - lead - 2 * tail) / count));
    const widths = [header + (scale.top + 1) * spacing + tail, lead + scale.top * spacing + tail];
    const lineWidth = brace + widths[0] + widths[1] + 2;
    const left = brace + Math.max(0, Math.floor((width - lineWidth) / 2));
    const layout = verticalLayout(scale);

    // VexFlow pins an inline size on its host, so it draws into a child and #score stays fluid.
    const host = document.createElement('div');
    scoreEl.replaceChildren(host);
    const renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG);
    renderer.resize(Math.max(width, Math.ceil(lineWidth)), layout.height);
    const ctx = renderer.getContext();
    ctx.setFillStyle(colors.ink);
    ctx.setStrokeStyle(colors.ink);
    const svg = host.querySelector('svg');
    svg.setAttribute('aria-hidden', 'true');

    const placed = [];
    let x = left;
    bars.forEach(([from, to], bar) => {
      const last = bar === bars.length - 1;
      const staves = scale.staves.map((part, p) => {
        // VexFlow draws a staff's top line 40px below the y it's given.
        const stave = new VF.Stave(x, layout.tops[p] - 40, widths[bar]);
        stave.options.fill_style = colors.staff;
        // VexFlow's own ledger-line color is a fixed dark grey that vanishes in dark mode.
        stave.setDefaultLedgerLineStyle({ strokeStyle: colors.staff, lineWidth: 1.3 });
        if (bar === 0) {
          stave.addClef(part.clef).addKeySignature(scale.signature.vexKey);
          // Start both staves' notes at the same x whatever their clefs' widths.
          stave.setNoteStartX(x + header);
        } else {
          stave.setBegBarType(VF.Barline.type.NONE);
        }
        if (last) stave.setEndBarType(VF.Barline.type.END);
        stave.setContext(ctx).draw();
        return stave;
      });
      const connect = type => new VF.StaveConnector(staves[0], staves[1]).setType(type).setContext(ctx).draw();
      if (bar === 0) {
        connect('brace');
        connect('singleLeft');
      }
      connect(last ? 'boldDoubleRight' : 'singleRight');

      const voices = scale.staves.map((part, p) => {
        const notes = part.notes.slice(from, to + 1).map(note => {
          const staveNote = new VF.StaveNote({ clef: part.clef, keys: [vexKey(note)], duration: 'q', auto_stem: true });
          if (note.accidental) staveNote.addModifier(new VF.Accidental(note.accidental), 0);
          placed.push({ row: layout.rows[p], staveNote, note });
          return staveNote;
        });
        return new VF.Voice({ num_beats: notes.length, beat_value: 4 })
          .setMode(VF.Voice.Mode.SOFT)
          .addTickables(notes)
          .setStave(staves[p]);
      });
      // Formatting both staves together lines up each note of the right hand over the left's.
      const formatter = new VF.Formatter();
      voices.forEach(voice => formatter.joinVoices([voice]));
      formatter.formatToStave(voices, staves[0]);
      voices.forEach((voice, p) => voice.draw(ctx, staves[p]));
      x += widths[bar];
    });

    placed.forEach(({ row, staveNote, note }) => {
      const cx = (staveNote.getNoteHeadBeginX() + staveNote.getNoteHeadEndX()) / 2;
      if (note.crossing) svg.appendChild(svgElement('circle', { cx, cy: row - 6, r: 11, class: 'crossing-ring' }));
      addText(svg, cx, row, note.finger, note.crossing ? 'finger is-crossing' : 'finger');
    });
    addText(svg, left + 2, layout.rows[0], 'RH', 'hand-label', 'start');
    addText(svg, left + 2, layout.rows[1], 'LH', 'hand-label', 'start');

    $('scroll-hint').hidden = scoreEl.scrollWidth <= scoreEl.clientWidth + 1;
  }

  // A note keeps its finger on the way down unless the notes or fingers change (melodic minor).
  function mirrored(scale) {
    const last = 2 * scale.top;
    return scale.staves.every(({ notes }) => notes.slice(0, scale.top + 1).every((note, i) => {
      const back = notes[last - i];
      return back.step === note.step && back.alter === note.alter && back.finger === note.finger;
    }));
  }

  function glanceTable(caption, scale, from, to) {
    const [right, left] = scale.staves;
    const range = [];
    for (let i = from; i <= to; i++) range.push(i);
    // A crossing belongs to the move into its note, so the descending table's first note (the
    // top, reached going up) never shows one.
    const finger = (note, i) => (note.crossing && !(from === scale.top && i === from)
      ? `<td><span class="ring" title="Crossing">${note.finger}</span></td>`
      : `<td><span>${note.finger}</span></td>`);
    return `<div class="glance-scroll"><table><caption>${caption}</caption><tbody>` +
      `<tr class="hand"><th scope="row">Right hand</th>${range.map(i => finger(right.notes[i], i)).join('')}</tr>` +
      `<tr class="notes"><th scope="row">Note</th>${range.map(i => `<td>${nameHTML(right.notes[i])}</td>`).join('')}</tr>` +
      `<tr class="hand"><th scope="row">Left hand</th>${range.map(i => finger(left.notes[i], i)).join('')}</tr>` +
      '</tbody></table></div>';
  }

  function renderGlance(scale) {
    const up = glanceTable('Ascending', scale, 0, scale.top);
    $('glance').innerHTML = mirrored(scale)
      ? `${up}<p class="glance-note">Descending, each note keeps the finger it had going up.</p>`
      : up + glanceTable('Descending', scale, scale.top, 2 * scale.top);
  }

  function update() {
    current = T.buildScale({ ...state, root: T.parseId(state.root) });
    syncControls();
    renderHeading(current);
    renderScore(current);
    renderGlance(current);
    saveState();
  }

  update();

  // Redraw when the sheet changes width or the theme changes (VexFlow bakes its colors in).
  new ResizeObserver(() => {
    if (Math.floor(scoreEl.clientWidth) !== renderedWidth) renderScore(current);
  }).observe(scoreEl);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderScore(current));
  new MutationObserver(() => renderScore(current))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
