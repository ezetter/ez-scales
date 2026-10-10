/*
 * Piano Scales with Fingerings: the controls, the grand staff (drawn with VexFlow) and the fingering
 * table. The music theory, including the fingering itself, is in theory.js.
 */
(() => {
  'use strict';

  const T = window.ScaleTheory;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'piano-scale-fingerings';
  const DEFAULTS = { root: 'C', family: 'major', mode: 'ionian', form: 'natural', octaves: 1, motion: 'parallel', order: 'alphabetical', shift: 0, tempo: 96 };
  // Horizontal room per note on the staff, in px: the fewest before the staff scrolls sideways,
  // and the most before a short scale looks stretched.
  const MIN_SPACING = 30;
  const MAX_SPACING = 64;
  const VEX_ALTER = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };
  const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
  // Playback tempo limits, in quarter notes a minute.
  const TEMPO_RANGE = [40, 208];

  const $ = id => document.getElementById(id);
  const controls = $('controls');
  // Every setting: the scale controls plus the display options at the top right.
  const settingsEl = document.querySelector('.page');
  const rootsEl = $('roots');
  const scoreEl = $('score');

  const state = loadState();
  let current = null;
  // What renderScore drew for each note, per staff: { x, parts } (see light()).
  let drawn = [];
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
      if (T.MOTIONS.some(m => m.id === saved.motion)) settings.motion = saved.motion;
      if (saved.order === 'alphabetical' || saved.order === 'fifths') settings.order = saved.order;
      if (Number.isInteger(saved.shift) && Math.abs(saved.shift) <= T.MAX_SHIFT) settings.shift = saved.shift;
      if (Number.isFinite(saved.tempo)) settings.tempo = clampTempo(saved.tempo);
      // Arpeggios used to be a separate Pattern setting.
      if (saved.pattern === 'arpeggio') settings.motion = 'arpeggios';
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
  $('motion').innerHTML = T.MOTIONS.map(m => `<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');

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
    const values = { root: state.root, family: state.family, mode: state.mode, form: state.form, octaves: String(state.octaves), motion: state.motion, order: state.order };
    for (const [name, value] of Object.entries(values)) {
      const select = settingsEl.querySelector(`select[name="${name}"]`);
      if (select) {
        select.value = value;
        continue;
      }
      const input = settingsEl.querySelector(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    }
    $('mode-field').hidden = state.family !== 'major';
    $('form-field').hidden = state.family !== 'minor';
    $('shift-value').textContent = state.shift > 0 ? `+${state.shift}` : state.shift < 0 ? `−${-state.shift}` : '0';
    $('shift-down').disabled = state.shift <= -T.MAX_SHIFT;
    $('shift-up').disabled = state.shift >= T.MAX_SHIFT;
    $('tempo').value = state.tempo;
  }

  // The octave shift: both hands move a whole octave per press, up to T.MAX_SHIFT either way.
  function shiftBy(octaves) {
    state.shift = Math.max(-T.MAX_SHIFT, Math.min(T.MAX_SHIFT, state.shift + octaves));
    update();
  }
  $('shift-down').addEventListener('click', () => shiftBy(-1));
  $('shift-up').addEventListener('click', () => shiftBy(1));

  settingsEl.addEventListener('change', event => {
    const { name, value } = event.target;
    if (name === 'tempo') {
      // Tempo only affects the next play, so nothing needs redrawing.
      state.tempo = clampTempo(value);
      event.target.value = state.tempo;
      saveState();
      return;
    }
    if (name === 'root') {
      state.root = value;
    } else if (name === 'octaves') {
      state.octaves = Number(value);
    } else if (name === 'motion') {
      state.motion = value;
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
    const span = scale.octaves === 1 ? 'One octave' : 'Two octaves';
    const intervals = {
      thirds: ' in thirds, the right hand a third above the left',
      sixths: ' in sixths, the right hand a sixth above the left',
    };
    if (scale.pattern === 'arpeggio') {
      $('scale-sub').textContent = `Root position, 1st and 2nd inversions, ${scale.octaves === 1 ? 'one octave' : 'two octaves'} each, ascending and descending`;
    } else if (scale.pattern === 'broken') {
      $('scale-sub').textContent = `Broken chords in 6/8, ${scale.octaves === 1 ? 'one octave' : 'two octaves'}, ascending and descending`;
    } else {
      $('scale-sub').textContent = scale.motion === 'contrary'
        ? `${span} in contrary motion, hands starting together on the tonic`
        : `${span}${intervals[scale.motion] || ''}, ascending and descending`;
    }
    const moved = { '-2': 'two octaves lower', '-1': 'an octave lower', 1: 'an octave higher', 2: 'two octaves higher' }[scale.shift];
    if (moved) $('scale-sub').textContent += `, ${moved} than usual`;
    const parent = `${nameHTML(scale.signature.major)} major`;
    const facts = [['Key signature', signatureHTML(scale.signature)]];
    if (scale.pattern === 'arpeggio' || scale.pattern === 'broken') {
      facts.push(['Chord', `${nameHTML(scale.triad[0])}${escapeHTML(scale.chord.slice(T.nameOf(scale.triad[0]).length))}`]);
      facts.push(['Notes', namesHTML(scale.triad)]);
      $('facts').innerHTML = facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
      return;
    }
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
    return node;
  }

  // Beaming: eighth notes go in groups of `size` (four in 4/4, half a bar; three in 6/8), fewer
  // before the last bar's held note or a clef change, which starts a new group, and a longer note
  // stands alone. Each group's stems point one way, chosen as VexFlow would: down when its notes
  // sit on or above the middle line on average, else up.
  const MIDDLE_STEP = { treble: 34, bass: 22 };
  const TOP_STEP = { treble: 38, bass: 26 };

  function stemGroups(part, bars, size) {
    const groups = [];
    for (const [from, to] of bars) {
      let group = null;
      for (let i = from; i <= to; i++) {
        const eighth = part.notes[i].duration === '8';
        if (!group || !eighth || !group.beamed || (i - from) % size === 0 || clefChanges(part, i)) {
          group = { notes: [], beamed: eighth };
          groups.push(group);
        }
        group.notes.push(i);
      }
    }
    for (const group of groups) {
      const lean = group.notes.reduce((sum, i) => sum + part.notes[i].step - MIDDLE_STEP[part.notes[i].clef], 0);
      group.down = lean >= 0;
      group.beamed = group.beamed && group.notes.length > 1;
    }
    return groups;
  }

  // Staff positions are 5px apart and stems about 35px long (a little more under a beam), measured
  // in each note's own clef. Each
  // hand's finger row sits clear of every notehead, stem, beam and accidental on its side of the
  // system, and the staves move apart to fit notes that reach toward each other. tops[] is each
  // staff's top-line y; rows[] is the baseline of each finger row.
  function verticalLayout(scale, plans) {
    const [treble, bass] = scale.staves.map((part, p) => {
      const y = i => (TOP_STEP[part.notes[i].clef] - part.notes[i].step) * 5;
      let above = 0;
      let below = 0;
      for (const group of plans[p]) {
        const stem = group.beamed ? 42 : 36;
        const stemmed = part.notes[group.notes[0]].duration !== 'w';
        for (const i of group.notes) {
          const mark = part.notes[i].accidental ? 16 : 6;
          above = Math.max(above, mark - y(i));
          below = Math.max(below, y(i) + (part.notes[i].accidental ? 12 : 6) - 40);
        }
        if (!stemmed) continue;
        const ys = group.notes.map(y);
        if (group.down) below = Math.max(below, Math.max(...ys) + stem - 40);
        else above = Math.max(above, stem - Math.min(...ys));
      }
      return { above, below };
    });
    const rightRow = Math.max(24, treble.above + 12);
    // Arpeggios name each inversion above the right hand's finger row.
    const labelRoom = scale.segments ? 22 : 0;
    const trebleTop = 30 + labelRoom + rightRow;
    const bassTop = trebleTop + 40 + Math.max(60, treble.below + bass.above + 24);
    const leftRow = bassTop + 40 + Math.max(32, bass.below + 24);
    return { tops: [trebleTop, bassTop], rows: [trebleTop - rightRow, leftRow], height: leftRow + 16 };
  }

  function describeScore(scale) {
    const rootName = T.nameOf(scale.root);
    const name = T.spokenName(scale.root) + scale.title.slice(rootName.length);
    const signature = scale.signature.count ? plural(scale.signature.count, scale.signature.kind) : 'no sharps or flats';
    const motion = {
      contrary: 'in contrary motion, out and back',
      thirds: 'up and down with the hands a third apart',
      sixths: 'up and down with the hands a sixth apart',
    }[scale.motion] || 'up and down';
    if (scale.pattern === 'broken') {
      return `Grand staff: ${name}, ${scale.octaves === 1 ? 'one octave' : 'two octaves'} up and down in groups of three, ` +
        `with ${signature} in the key signature, in 6/8 time as eighth notes. The tables below list each note's finger.`;
    }
    if (scale.pattern === 'arpeggio') {
      return `Grand staff: ${name} in root position, 1st and 2nd inversion, ${scale.octaves === 1 ? 'one octave' : 'two octaves'} ` +
        `each up and down, with ${signature} in the key signature, in 4/4 time as eighth notes. The tables below list each note's finger.`;
    }
    return `Grand staff: ${name}, ${scale.octaves === 1 ? 'one octave' : 'two octaves'} ${motion}, ` +
      `with ${signature} in the key signature, in 4/4 time as eighth notes. The table below lists each note's finger.`;
  }

  // Horizontal room each duration gets, in eighth-note widths, and a clef change in either staff.
  const ROOM = { 8: 1, q: 1.5, h: 2, hd: 2.5, w: 3 };
  const CLEF_CHANGE_ROOM = 1.4;

  // Whether note i starts in a different clef from the note before it on a staff.
  const clefChanges = (part, i) => i > 0 && part.notes[i].clef !== part.notes[i - 1].clef;

  // The system: treble over bass in 4/4, joined by a brace, eighth notes beamed in fours.
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
    const { bars } = scale;
    // 4/4 with eighths beamed in fours unless the pattern says otherwise (broken chords: 6/8 in threes).
    const meter = scale.meter || { time: '4/4', beats: 4, value: 4, group: 4 };
    const notesOf = ([from, to]) => scale.staves[0].notes.slice(from, to + 1);
    const room = bars.map(([from, to]) => {
      let total = notesOf([from, to]).reduce((sum, note) => sum + ROOM[note.duration], 0);
      for (let i = from; i <= to; i++) {
        if (scale.staves.some(part => clefChanges(part, i))) total += CLEF_CHANGE_ROOM;
      }
      return total;
    });
    const totalRoom = room.reduce((a, b) => a + b, 0);

    // Clefs, key and time signatures, then the same room per eighth: as much as fits, within limits.
    const brace = 16;
    const header = Math.max(...scale.staves.map(part => new VF.Stave(0, 0, 400)
      .addClef(part.notes[0].clef).addKeySignature(scale.signature.vexKey).addTimeSignature(meter.time).getNoteStartX()));
    const lead = new VF.Stave(0, 0, 400).getNoteStartX();
    const tail = 14;
    const spare = width - brace - 2 - header - bars.length * tail - (bars.length - 1) * lead;
    const spacing = Math.max(MIN_SPACING, Math.min(MAX_SPACING, spare / totalRoom));
    const widths = room.map((r, bar) => (bar === 0 ? header : lead) + r * spacing + tail);
    const lineWidth = brace + widths.reduce((a, b) => a + b, 0) + 2;
    const left = brace + Math.max(0, Math.floor((width - lineWidth) / 2));
    const plans = scale.staves.map(part => stemGroups(part, bars, meter.group));
    const layout = verticalLayout(scale, plans);

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

    // Every note of both staves, built up front so beams can be attached before drawing.
    const staveNotes = scale.staves.map((part, p) => {
      const built = part.notes.map(note => {
        const staveNote = new VF.StaveNote({ clef: note.clef, keys: [vexKey(note)], duration: note.duration });
        if (note.accidental) staveNote.addModifier(new VF.Accidental(note.accidental), 0);
        if (note.duration.endsWith('d')) VF.Dot.buildAndAttach([staveNote], { all: true });
        return staveNote;
      });
      plans[p].forEach(group => group.notes.forEach(i => {
        built[i].setStemDirection(group.down ? VF.Stem.DOWN : VF.Stem.UP);
      }));
      return built;
    });
    const beams = plans.flatMap((groups, p) => groups
      .filter(group => group.beamed)
      .map(group => new VF.Beam(group.notes.map(i => staveNotes[p][i]))));

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
          // Each staff opens in its first note's clef: the right hand may start in bass clef.
          stave.addClef(part.notes[0].clef).addKeySignature(scale.signature.vexKey).addTimeSignature(meter.time);
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

      // A small clef goes just before any note that changes clef. The other staff gets an unseen
      // clef at the same point, so both staves take the same room there and their notes stay
      // lined up; without it VexFlow shifts only the staff with the clef.
      const voices = staveNotes.map((built, p) => {
        const tickables = [];
        for (let i = from; i <= to; i++) {
          if (scale.staves.some(part => clefChanges(part, i))) {
            const clefNote = new VF.ClefNote(scale.staves[p].notes[i].clef, 'small');
            if (!clefChanges(scale.staves[p], i)) {
              clefNote.draw = function drawNothing() {
                this.setRendered();
              };
            }
            tickables.push(clefNote);
          }
          tickables.push(built[i]);
        }
        return new VF.Voice({ num_beats: meter.beats, beat_value: meter.value }).addTickables(tickables).setStave(staves[p]);
      });
      // Formatting both staves together lines up each note of the right hand over the left's.
      const formatter = new VF.Formatter();
      voices.forEach(voice => formatter.joinVoices([voice]));
      formatter.formatToStave(voices, staves[0]);
      voices.forEach((voice, p) => voice.draw(ctx, staves[p]));
      x += widths[bar];
    });
    beams.forEach(beam => beam.setContext(ctx).draw());

    // Each note's drawn parts, kept so playback can light up the note that's sounding.
    drawn = scale.staves.map((part, p) => part.notes.map((note, i) => {
      const staveNote = staveNotes[p][i];
      const cx = (staveNote.getNoteHeadBeginX() + staveNote.getNoteHeadEndX()) / 2;
      const row = layout.rows[p];
      if (note.crossing) svg.appendChild(svgElement('circle', { cx, cy: row - 6, r: 11, class: 'crossing-ring' }));
      const finger = addText(svg, cx, row, note.finger, note.crossing ? 'finger is-crossing' : 'finger');
      const head = staveNote.getSVGElement ? staveNote.getSVGElement() : document.getElementById(`vf-${staveNote.getAttribute('id')}`);
      return { x: cx, parts: [head, finger].filter(Boolean) };
    }));
    if (session && session.lit !== null) light(session.lit);
    (scale.segments || []).forEach(g => {
      addText(svg, staveNotes[0][g.from].getNoteHeadBeginX() - 4, layout.rows[0] - 24, g.name, 'segment-label', 'start');
    });
    addText(svg, left + 2, layout.rows[0], 'RH', 'hand-label', 'start');
    addText(svg, left + 2, layout.rows[1], 'LH', 'hand-label', 'start');

    $('scroll-hint').hidden = scoreEl.scrollWidth <= scoreEl.clientWidth + 1;
  }

  // A note keeps its finger on the way down unless the notes or fingers change (melodic minor).
  // True when every note keeps its finger on the way back down a run from `from` to `top`.
  function mirrored(scale, from = 0, top = scale.top) {
    return scale.staves.every(({ notes }) => notes.slice(from, top + 1).every((note, i) => {
      const back = notes[2 * top - from - i];
      return back.step === note.step && back.alter === note.alter && back.finger === note.finger;
    }));
  }

  function glanceTable(caption, scale, from, to) {
    const [right, left] = scale.staves;
    const range = [];
    for (let i = from; i <= to; i++) range.push(i);
    // A crossing belongs to the move into its note, so the second table's first note (the turning
    // point, reached in the first half) never shows one.
    const finger = (note, i) => (note.crossing && !(from === scale.top && i === from) && i !== from
      ? `<td><span class="ring" title="Crossing">${note.finger}</span></td>`
      : `<td><span>${note.finger}</span></td>`);
    const fingers = (label, part) => `<tr class="hand"><th scope="row">${label}</th>${range.map(i => finger(part.notes[i], i)).join('')}</tr>`;
    const notes = (label, part) => `<tr class="notes"><th scope="row">${label}</th>${range.map(i => `<td>${nameHTML(part.notes[i])}</td>`).join('')}</tr>`;
    // In parallel motion the hands play the same notes; in contrary motion each gets its own row.
    const sameNotes = range.every(i => right.notes[i].name === left.notes[i].name);
    const middle = sameNotes ? notes('Note', right) : notes('Right-hand notes', right) + notes('Left-hand notes', left);
    return `<div class="glance-scroll"><table><caption>${caption}</caption><tbody>` +
      fingers('Right hand', right) + middle + fingers('Left hand', left) +
      '</tbody></table></div>';
  }

  function renderGlance(scale) {
    if (scale.tables) {
      $('glance').innerHTML = scale.tables.map(t => glanceTable(t.caption, scale, t.from, t.to)).join('');
      return;
    }
    if (scale.pattern === 'arpeggio') {
      // One table per inversion, going up; coming down each note keeps its finger.
      const tables = scale.segments.map(g => glanceTable(`${g.name}, ascending`, scale, g.from, g.top)).join('');
      const same = scale.segments.every(g => mirrored(scale, g.from, g.top));
      $('glance').innerHTML = tables + (same ? '<p class="glance-note">Descending, each note keeps the finger it had going up.</p>' : '');
      return;
    }
    const contrary = scale.motion === 'contrary';
    const [outward, back] = contrary ? ['Hands moving apart', 'Hands coming back together'] : ['Ascending', 'Descending'];
    const first = glanceTable(outward, scale, 0, scale.top);
    const note = contrary
      ? 'Coming back together, each note keeps the finger it had going out.'
      : 'Descending, each note keeps the finger it had going up.';
    $('glance').innerHTML = mirrored(scale)
      ? `${first}<p class="glance-note">${note}</p>`
      : first + glanceTable(back, scale, scale.top, 2 * scale.top);
  }

  // ---- Playback ------------------------------------------------------------------------------
  // A synthesized piano, the same as Chord Progression Builder's: the page can't fetch recorded
  // samples, so each note is a stack of slightly stretched harmonics that die away faster the
  // higher they are, with a short hammer thump on the attack and a little generated room reverb.
  // Both hands play the written rhythm at state.tempo quarter notes a minute.
  function clampTempo(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(TEMPO_RANGE[0], Math.min(TEMPO_RANGE[1], n)) : 96;
  }
  const BEATS = { 8: 0.5, q: 1, qd: 1.5, h: 2, hd: 3, w: 4 };
  const PARTIALS = [1, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05, 0.035];
  const playButton = $('play');
  let audio = null;
  let session = null;

  function getAudio() {
    if (audio) return audio;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx, 1.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    master.connect(compressor);
    master.connect(reverb);
    reverb.connect(wet);
    wet.connect(compressor);
    compressor.connect(ctx.destination);
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    noise.getChannelData(0).forEach((_, i, data) => { data[i] = Math.random() * 2 - 1; });
    audio = { ctx, master, noise };
    return audio;
  }

  function roomImpulse(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }

  function playNote(out, midi, time, length) {
    const { ctx, noise } = audio;
    const f0 = 440 * 2 ** ((midi - 69) / 12);
    const stop = time + length + 1.5;
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0.15, time);
    voice.gain.setTargetAtTime(0, time + length, 0.08);
    voice.connect(out);
    // Lower notes ring longer, as on a real piano.
    const sustain = 1.6 * (261.6 / f0) ** 0.35;

    PARTIALS.forEach((amp, i) => {
      const n = i + 1;
      const freq = f0 * n * Math.sqrt(1 + 0.0004 * n * n);
      if (freq > 15000) return;
      // The lowest partials get two slightly detuned "strings" for a little shimmer.
      const detunes = n <= 2 ? [-1.5, 1.5] : [0];
      const partial = ctx.createGain();
      partial.gain.setValueAtTime(0, time);
      partial.gain.linearRampToValueAtTime(amp / detunes.length, time + 0.004);
      partial.gain.setTargetAtTime(0, time + 0.004, sustain / n ** 0.8);
      partial.connect(voice);
      detunes.forEach(cents => {
        const osc = ctx.createOscillator();
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(partial);
        osc.start(time);
        osc.stop(stop);
      });
    });

    const hammer = ctx.createBufferSource();
    hammer.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(f0 * 4, 4000);
    band.Q.value = 1.2;
    const thump = ctx.createGain();
    thump.gain.setValueAtTime(0.3, time);
    thump.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    hammer.connect(band);
    band.connect(thump);
    thump.connect(voice);
    hammer.start(time);
  }

  // Runs fn when the audio clock reaches the given time.
  function atTime(seconds, fn) {
    session.timers.push(setTimeout(fn, Math.max(0, (seconds - audio.ctx.currentTime) * 1000)));
  }

  // Lights note i on both staves (null for none), and scrolls a wide score to keep it in view.
  function light(i) {
    scoreEl.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
    if (session) session.lit = i;
    if (i === null) return;
    drawn.forEach(notes => notes[i] && notes[i].parts.forEach(el => el.classList.add('is-playing')));
    const x = drawn[0] && drawn[0][i] ? drawn[0][i].x : null;
    if (x !== null && (x < scoreEl.scrollLeft + 40 || x > scoreEl.scrollLeft + scoreEl.clientWidth - 40)) {
      scoreEl.scrollLeft = Math.max(0, x - scoreEl.clientWidth / 3);
    }
  }

  function syncPlayButton() {
    const playing = Boolean(session);
    playButton.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-pressed', String(playing));
    $('play-label').textContent = playing ? 'Stop' : 'Play';
  }

  // Plays both hands note by note in the written rhythm, the last note held a little longer.
  function play() {
    const a = getAudio();
    if (!a) {
      $('play-note').hidden = false;
      return;
    }
    if (a.ctx.state === 'suspended') a.ctx.resume();
    stopPlayback();
    const gain = a.ctx.createGain();
    gain.connect(a.master);
    session = { gain, timers: [], lit: null };
    const beat = 60 / state.tempo;
    const [right, left] = current.staves;
    let time = a.ctx.currentTime + 0.1;
    right.notes.forEach((note, i) => {
      const last = i === right.notes.length - 1;
      const length = BEATS[note.duration] * beat;
      const sound = last ? length + 0.6 : length * 0.95;
      playNote(gain, note.midi, time, sound);
      playNote(gain, left.notes[i].midi, time, sound);
      atTime(time, () => light(i));
      time += length;
    });
    atTime(time, finishSession);
    syncPlayButton();
  }

  // Ends the session but lets notes already sounding ring out.
  function finishSession() {
    if (!session) return;
    session.timers.forEach(clearTimeout);
    session = null;
    light(null);
    syncPlayButton();
  }

  // Cuts playback short with a quick fade, like lifting the sustain.
  function stopPlayback() {
    if (!session) return;
    const { gain } = session;
    const now = audio.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.04);
    setTimeout(() => gain.disconnect(), 500);
    finishSession();
  }

  playButton.addEventListener('click', () => (session ? stopPlayback() : play()));

  function update() {
    stopPlayback();
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
