/*
 * Music theory for Piano Scales with Fingerings: note spelling, key signatures, the scales themselves,
 * where each hand's notes sit on its staff, and piano fingering. There's no DOM code here, so the
 * page loads it as a classic script (window.ScaleTheory) and the tests require() it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScaleTheory = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
  // Each letter's place on the line of fifths, C at 0 (F is -1, G is 1). A sharp adds 7.
  const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5];
  const FIFTHS_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const FLATS_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
  const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
  const SIGNS = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
  const SPOKEN = { '-2': ' double flat', '-1': ' flat', 0: '', 1: ' sharp', 2: ' double sharp' };
  // VexFlow's accidental codes.
  const VEX_ACCIDENTALS = { '-2': 'bb', '-1': 'b', 0: 'n', 1: '#', 2: '##' };

  const mod = (n, m) => ((n % m) + m) % m;

  function compare(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }

  // A note name is { letter, alter }: letter 0-6 for C-B, alter in semitones from -2 to 2.
  const pitchClass = note => mod(NATURAL_PC[note.letter] + note.alter, 12);
  const fifthsOf = note => LETTER_FIFTHS[note.letter] + 7 * note.alter;
  const noteAtFifths = fifths => ({ letter: FIFTHS_ORDER[mod(fifths + 1, 7)], alter: Math.floor((fifths + 1) / 7) });
  const isBlackKey = note => BLACK_PCS.has(pitchClass(note));
  const sameName = (a, b) => a.letter === b.letter && a.alter === b.alter;
  const nameOf = note => LETTERS[note.letter] + SIGNS[note.alter];
  const spokenName = note => LETTERS[note.letter] + SPOKEN[note.alter];

  // ASCII ids for storage and element ids: C, Eb, Fs (F sharp), Fss (F double sharp).
  const idOf = note => LETTERS[note.letter] + (note.alter < 0 ? 'b'.repeat(-note.alter) : 's'.repeat(note.alter));
  function parseId(id) {
    const match = /^([A-G])(b{1,2}|s{1,2})?$/.exec(String(id));
    if (!match) return null;
    const marks = match[2] || '';
    return { letter: LETTERS.indexOf(match[1]), alter: marks.startsWith('b') ? -marks.length : marks.length };
  }

  // Semitones above the tonic, degree by degree. keyOffset is the distance on the line of fifths
  // from the tonic to its key signature: D Dorian (D is 2) uses C major's signature (0).
  const MODES = [
    { id: 'ionian', name: 'Ionian', number: 1, steps: [0, 2, 4, 5, 7, 9, 11], keyOffset: 0 },
    { id: 'dorian', name: 'Dorian', number: 2, steps: [0, 2, 3, 5, 7, 9, 10], keyOffset: -2 },
    { id: 'phrygian', name: 'Phrygian', number: 3, steps: [0, 1, 3, 5, 7, 8, 10], keyOffset: -4 },
    { id: 'lydian', name: 'Lydian', number: 4, steps: [0, 2, 4, 6, 7, 9, 11], keyOffset: 1 },
    { id: 'mixolydian', name: 'Mixolydian', number: 5, steps: [0, 2, 4, 5, 7, 9, 10], keyOffset: -1 },
    { id: 'aeolian', name: 'Aeolian', number: 6, steps: [0, 2, 3, 5, 7, 8, 10], keyOffset: -3 },
    { id: 'locrian', name: 'Locrian', number: 7, steps: [0, 1, 3, 5, 6, 8, 10], keyOffset: -5 },
  ];
  const NATURAL_MINOR = MODES[5].steps;
  // All three share the natural minor's key signature. Melodic minor raises its 6th and 7th going
  // up and comes back down as natural minor.
  const MINOR_FORMS = [
    { id: 'natural', name: 'Natural', up: NATURAL_MINOR, down: NATURAL_MINOR },
    { id: 'harmonic', name: 'Harmonic', up: [0, 2, 3, 5, 7, 8, 11], down: [0, 2, 3, 5, 7, 8, 11] },
    { id: 'melodic', name: 'Melodic', up: [0, 2, 3, 5, 7, 9, 11], down: NATURAL_MINOR },
  ];

  // choice: { family: 'major' | 'minor', mode, form }. "Major" covers the seven modes.
  function scaleType(choice) {
    if (choice.family === 'minor') {
      const form = MINOR_FORMS.find(f => f.id === choice.form) || MINOR_FORMS[0];
      return { family: 'minor', form, up: form.up, down: form.down, keyOffset: -3 };
    }
    const mode = MODES.find(m => m.id === choice.mode) || MODES[0];
    return { family: 'major', mode, up: mode.steps, down: mode.steps, keyOffset: mode.keyOffset };
  }

  // The 13 tonics whose key signatures have at most six sharps or flats. That covers all 12 keys,
  // and the one with six of either gets both names: F♯ and G♭ major, D♯ and E♭ minor, G♯ and A♭
  // Dorian, and so on. order 'alphabetical' lists them up the keyboard from C; 'fifths' goes round
  // the circle of fifths from the key with no sharps or flats, through the sharps to six, then the
  // flats from six back to one (C G D … F♯ G♭ D♭ … F in major).
  function rootsFor(choice, order = 'alphabetical') {
    const { keyOffset } = scaleType(choice);
    const roots = [];
    for (let fifths = -6 - keyOffset; fifths <= 6 - keyOffset; fifths++) roots.push(noteAtFifths(fifths));
    if (order === 'fifths') {
      const place = root => mod(fifthsOf(root) + keyOffset, 13);
      return roots.sort((a, b) => place(a) - place(b));
    }
    return roots.sort((a, b) => pitchClass(a) - pitchClass(b) || fifthsOf(b) - fifthsOf(a));
  }

  // The root to use for a scale: the same name when the scale offers it, else the same key under
  // the scale's name for it (G♭ major becomes F♯ minor).
  function matchRoot(root, choice) {
    const same = rootsFor(choice).filter(r => pitchClass(r) === pitchClass(root));
    return same.find(r => sameName(r, root))
      || same.sort((a, b) => Math.abs(fifthsOf(a) - fifthsOf(root)) - Math.abs(fifthsOf(b) - fifthsOf(root)))[0];
  }

  // Names the seven degrees: one letter each, altered to land on the right key.
  function spell(root, steps) {
    const tonic = pitchClass(root);
    return steps.map((semitones, degree) => {
      const letter = (root.letter + degree) % 7;
      return { letter, alter: mod(tonic + semitones - NATURAL_PC[letter] + 6, 12) - 6 };
    });
  }

  // fifths: sharps (positive) or flats (negative) in the signature.
  function keySignature(fifths) {
    const sign = Math.sign(fifths);
    const letters = (fifths > 0 ? FIFTHS_ORDER : FLATS_ORDER).slice(0, Math.abs(fifths));
    const alterations = [0, 0, 0, 0, 0, 0, 0];
    letters.forEach(letter => { alterations[letter] = sign; });
    const major = noteAtFifths(fifths);
    return {
      fifths,
      count: letters.length,
      kind: sign > 0 ? 'sharp' : sign < 0 ? 'flat' : null,
      accidentals: letters.map(letter => ({ letter, alter: sign })),
      alterations,
      major,
      vexKey: LETTERS[major.letter] + (major.alter > 0 ? '#' : major.alter < 0 ? 'b' : ''),
    };
  }

  // Staff positions count diatonic steps: middle C (C4) is 4 × 7 + 0 = 28.
  const STAVES = {
    treble: { bottom: 30, top: 38 }, // E4 to F5
    bass: { bottom: 18, top: 26 }, // G2 to A3
  };
  const OTHER_CLEF = { treble: 'bass', bass: 'treble' };

  // A note too far from its staff for ledger lines: three or more ledger lines away, on the side
  // where the other clef does better (E3 and below under the treble staff, A4 and up over the bass).
  function tooFar(step, home) {
    return home === 'treble' ? step <= STAVES.treble.bottom - 7 : step >= STAVES.bass.top + 7;
  }

  // Clef changes set by hand where the rule below doesn't give the engraving we want, keyed by
  // motion, mode or minor form, root, octaves and hand: the [first, last] note index written in
  // the other clef. Two octaves of G♭ major in sixths keep the left hand in treble for just the
  // four notes at the top, although G major, on the same lines and spaces, takes twelve.
  const CLEF_EXCEPTIONS = {
    'sixths ionian Gb 2 left': [12, 15],
  };

  // Beam groups start every four eighths, so a clef change lands at the start of one.
  const GROUP = 4;
  // A stretch in the other clef around the top of the run lasts at least this many notes.
  const SHORTEST_EXCURSION = 12;

  // The clef each note is written in. A staff stays in its own clef, with ledger lines, unless
  // notes are too far off it. Then it changes clef once going out and once coming back, both at
  // the same pitch (the note is written in the other clef going out, and in its own clef coming
  // back), with the outward change at the start of a beam group. Runs go out and back
  // symmetrically around `top`, so the stretch is either around the top of the run (the left hand
  // climbing into the treble) or at both ends (the right hand starting low).
  // `exception`, when given, is the [first, last] note index to write in the other clef instead.
  // `group` is the beam group size (4 in 4/4 eighths, 3 in 6/8).
  function clefsFor(notes, home, top, exception, group = GROUP) {
    const last = notes.length - 1;
    const far = notes.map(({ step }) => tooFar(step, home));
    const away = new Array(notes.length).fill(false);
    const farIndexes = far.flatMap((isFar, i) => (isFar ? [i] : []));
    if (exception) {
      for (let i = exception[0]; i <= exception[1]; i++) away[i] = true;
    } else if (farIndexes.length && far[top]) {
      // Around the top: from s up to the matching pitch coming back.
      const lastFar = Math.max(...farIndexes);
      let s = Math.floor(farIndexes[0] / group) * group;
      while (s > 0 && last - s <= lastFar) s -= group;
      while (last - 2 * s < SHORTEST_EXCURSION && s >= 2 * group) s -= group;
      for (let i = s; i < last - s; i++) away[i] = true;
    } else if (farIndexes.length && far[0]) {
      // At both ends: from the start until the first beam group clear of the far notes, and from
      // the matching pitch on the way back to the end.
      const lastOnWayOut = Math.max(...farIndexes.filter(i => i <= top));
      const back = Math.min(top, (Math.floor(lastOnWayOut / group) + 1) * group);
      for (let i = 0; i < back; i++) away[i] = true;
      for (let i = last - back; i <= last; i++) away[i] = true;
    } else {
      // Anything else: each beam group with a far note goes in the other clef.
      farIndexes.forEach(i => {
        const start = Math.floor(i / group) * group;
        for (let j = start; j < Math.min(start + group, notes.length); j++) away[j] = true;
      });
    }
    return away.map(isAway => (isAway ? OTHER_CLEF[home] : home));
  }

  // [ledger lines on the busier side, ledger lines in all] to write steps low..high on a staff.
  function ledgerCost(low, high, staff) {
    const above = high > staff.top ? Math.floor((high - staff.top) / 2) : 0;
    const below = low < staff.bottom ? Math.floor((staff.bottom - low) / 2) : 0;
    return [Math.max(above, below), above + below];
  }

  // Parallel motion keeps the hands exactly an octave apart. The right hand's tonic goes where it
  // needs the fewest ledger lines on the treble staff; between equally tidy choices, whichever
  // suits the left hand an octave below better, then the higher. Returns each hand's lowest staff
  // position.
  function placeHands(root, octaves) {
    const span = 7 * octaves;
    let best = null;
    for (let octave = 2; octave <= 6; octave++) {
      const right = octave * 7 + root.letter;
      const left = right - 7;
      const key = [
        ...ledgerCost(right, right + span, STAVES.treble),
        ...ledgerCost(left, left + span, STAVES.bass),
        -octave,
      ];
      if (!best || compare(key, best.key) < 0) best = { right, left, key };
    }
    return { right: best.right, left: best.left };
  }

  // Thirds keep the hands exactly a third apart, so they're placed together: the left hand's first
  // note, and the right hand's a third above it, at whichever octave needs the fewest ledger lines
  // on the two staves, nearest middle C on a tie. `from` is the scale degree each hand starts on.
  // Returns each hand's lowest staff position.
  function placeInterval(root, octaves, from) {
    const span = 7 * octaves;
    const gap = mod(from.right - from.left, 7);
    let best = null;
    for (let octave = 1; octave <= 5; octave++) {
      const left = octave * 7 + root.letter + from.left;
      const right = left + gap;
      const treble = ledgerCost(right, right + span, STAVES.treble);
      const bass = ledgerCost(left, left + span, STAVES.bass);
      const key = [Math.max(treble[0], bass[0]), treble[1] + bass[1], Math.abs(right - 28)];
      if (!best || compare(key, best.key) < 0) best = { right, left, key };
    }
    return { right: best.right, left: best.left };
  }

  // Contrary motion starts and ends with both hands on the same tonic: the octave whose run (up
  // on the treble staff, down on the bass) needs the fewest ledger lines, nearest middle C on a tie.
  function placeUnison(root, octaves) {
    const span = 7 * octaves;
    let best = null;
    for (let octave = 2; octave <= 5; octave++) {
      const start = octave * 7 + root.letter;
      const right = ledgerCost(start, start + span, STAVES.treble);
      const left = ledgerCost(start - span, start, STAVES.bass);
      const key = [Math.max(right[0], left[0]), right[1] + left[1], Math.abs(start - 28)];
      if (!best || compare(key, best.key) < 0) best = { octave, key };
    }
    return best.octave;
  }

  // The thumb plays two notes in every octave, three degrees apart, so the fingers between make a
  // group of three and a group of four. `start` is one of the thumb's degrees: the right hand's
  // 1 2 3 begins on it, and the left hand's 3 2 1 comes right after it.
  const HAND_PATTERNS = { right: [1, 2, 3, 1, 2, 3, 4], left: [1, 3, 2, 1, 4, 3, 2] };

  function fingersFor(start, hand) {
    const fingers = [];
    HAND_PATTERNS[hand].forEach((finger, i) => { fingers[(start + i) % 7] = finger; });
    return fingers;
  }

  // Tries the seven places the thumb can go and keeps the best, judged on these in turn:
  // 1. the thumb plays white keys only;
  // 2. a scale that starts on a white key has the thumb on its tonic (right hand starts there,
  //    left hand arrives there);
  // 3. the thumb meets a black key where the hand turns: the right hand's thumb passes under
  //    just after one, and the left hand's fingers cross over the thumb onto one;
  // 4. harmonic and melodic minor keep the natural minor's fingering;
  // 5. the 4th finger plays a black key;
  // 6. going up, the right hand plays 1 2 3 from the tonic and the left hand 5 4 3 2 1.
  // `black` marks the seven degrees that fall on black keys, tonic first.
  function chooseStart(black, hand, preferred) {
    let best = null;
    for (let start = 0; start < 7; start++) {
      const thumbs = [start, (start + 3) % 7];
      const turnsAtBlack = d => black[hand === 'right' ? (d + 6) % 7 : (d + 1) % 7];
      const fourth = hand === 'right' ? (start + 6) % 7 : (start + 4) % 7;
      const score = [
        thumbs.filter(d => !black[d]).length,
        !black[0] && thumbs.includes(0) ? 1 : 0,
        thumbs.filter(turnsAtBlack).length,
        start === preferred ? 1 : 0,
        black[fourth] ? 1 : 0,
        start === (hand === 'right' ? 0 : 4) ? 1 : 0,
      ];
      if (!best || compare(score, best.score) > 0) best = { start, score };
    }
    return best.start;
  }

  // Fingers for each note of a run. `path` gives each note's height in scale steps above the run's
  // lowest note (0 to top), its scale degree (0-6, tonic 0), and whether it's on a rising stretch,
  // which picks the scale form and fingering for that direction. `up` and `down` are each
  // direction's black keys (different only in melodic minor). Every note keeps the finger the
  // scale gives its key, except at the ends of the run.
  function fingerPath(path, up, down, hand, top, preferred) {
    const upFingers = fingersFor(chooseStart(up, hand, preferred), hand);
    const downFingers = fingersFor(chooseStart(down, hand, preferred), hand);
    const degreeAt = height => path.find(step => step.height === height).degree;
    const belowUp = upFingers[degreeAt(top - 1)];
    const belowDown = downFingers[degreeAt(top - 1)];
    return path.map(({ height, degree, rising }) => {
      const fingers = rising ? upFingers : downFingers;
      if (height === top) {
        // The right hand's top note carries on from the fingers under it rather than taking the
        // thumb: 5 after 4 in C major, 4 after 3 in F major, 3 after 1 and 2 where the two
        // directions differ.
        if (hand === 'right') return Math.max(belowUp, belowDown) + 1;
        return belowUp !== 1 && belowDown !== 1 ? Math.min(belowUp, belowDown) - 1 : upFingers[degree];
      }
      // The left hand's bottom note joins the fingers above it rather than taking the thumb: 5 4 3 2 1.
      if (height === 0 && hand === 'left' && fingers[degree] === 1) return fingers[degreeAt(1)] + 1;
      return fingers[degree];
    });
  }

  // A run's notes as heights in scale steps above its lowest note, which is scale degree `from`.
  // Parallel motion (and the right hand in contrary motion) goes up and back down; the left hand
  // in contrary motion goes down from the top and back up.
  function runPath(top, downFirst, from = 0) {
    const path = [];
    for (let j = 0; j <= 2 * top; j++) {
      const out = j <= top;
      const step = downFirst
        ? { height: out ? top - j : j - top, rising: !out }
        : { height: out ? j : 2 * top - j, rising: out };
      path.push({ ...step, degree: (from + step.height) % 7 });
    }
    return path;
  }

  // How the hands move. In thirds, the left hand starts on the tonic and the right hand exactly a
  // third higher on the 3rd degree; in sixths, the right hand starts on the tonic nearest middle C
  // and the left hand exactly a sixth lower on the 3rd degree. Both hands play the scale of the key
  // either way.
  const MOTIONS = [
    { id: 'parallel', name: 'Parallel', from: { right: 0, left: 0 } },
    { id: 'thirds', name: 'Parallel in thirds', from: { right: 2, left: 0 } },
    { id: 'sixths', name: 'Parallel in sixths', from: { right: 0, left: 2 } },
    { id: 'contrary', name: 'Contrary', from: { right: 0, left: 0 } },
    // Not a way of moving through the scale: the tonic triad's arpeggios (see buildArpeggios).
    { id: 'arpeggios', name: 'Arpeggios', from: { right: 0, left: 0 } },
    // The tonic triad as broken chords in 6/8 (see buildBrokenChords).
    { id: 'broken', name: 'Broken chords', from: { right: 0, left: 0 } },
  ];

  // True where the hand shifts position: the thumb passes under, or a finger crosses over it.
  function crossings(notes, fingers, hand) {
    return fingers.map((finger, i) => {
      if (i === 0) return false;
      const rising = notes[i].midi > notes[i - 1].midi;
      return (hand === 'right') === rising ? finger < fingers[i - 1] : finger > fingers[i - 1];
    });
  }

  // The run is written in 4/4 as eighth notes, eight to a bar. A run always has an odd number of
  // notes (14 per octave plus the last tonic), so the final bar ends with a longer note that fills
  // it: a quarter after six eighths (one octave), a half after four (two octaves).
  const EIGHTHS_PER_BAR = 8;
  const HELD_NOTES = { 2: 'q', 4: 'h', 6: 'hd', 8: 'w' };

  // Each note's VexFlow duration, and the bars as [first, last] note indexes.
  function rhythm(count) {
    const durations = new Array(count).fill('8');
    const lastBar = Math.floor((count - 1) / EIGHTHS_PER_BAR) * EIGHTHS_PER_BAR;
    durations[count - 1] = HELD_NOTES[EIGHTHS_PER_BAR - (count - 1 - lastBar)];
    const bars = [];
    for (let from = 0; from < count; from += EIGHTHS_PER_BAR) {
      bars.push([from, Math.min(from + EIGHTHS_PER_BAR, count) - 1]);
    }
    return { durations, bars };
  }

  // Which notes get a written accidental. Within a bar, a note needs one when it differs from the
  // key signature or from an earlier accidental on its line or space. A bar line cancels those,
  // but the first time a line or space comes back in a later bar, it gets a courtesy sign if the
  // last note written there was different (melodic minor's naturals on the way down).
  function writtenAccidentals(notes, signature, bars) {
    const lastWritten = new Map();
    const shown = [];
    for (const [from, to] of bars) {
      const inForce = new Map();
      for (let i = from; i <= to; i++) {
        const note = notes[i];
        const current = inForce.has(note.step) ? inForce.get(note.step) : signature.alterations[note.letter];
        const courtesy = !inForce.has(note.step) && lastWritten.has(note.step) && lastWritten.get(note.step) !== note.alter;
        shown.push(note.alter !== current || courtesy ? VEX_ACCIDENTALS[note.alter] : null);
        inForce.set(note.step, note.alter);
        lastWritten.set(note.step, note.alter);
      }
    }
    return shown;
  }

  function placeNote(step, name) {
    const octave = Math.floor(step / 7);
    return {
      letter: name.letter,
      alter: name.alter,
      octave,
      step,
      midi: 12 * (octave + 1) + NATURAL_PC[name.letter] + name.alter,
      name: nameOf(name),
      black: isBlackKey(name),
    };
  }

  function titleOf(root, type) {
    if (type.family === 'minor') return `${nameOf(root)} ${type.form.name} Minor`;
    return type.mode.number === 1 ? `${nameOf(root)} Major` : `${nameOf(root)} ${type.mode.name}`;
  }

  // How far the octave shift goes each way.
  const MAX_SHIFT = 2;

  // Everything the page draws for one scale. settings: { root, family, mode, form, octaves, motion,
  // shift }, with root as a note name, motion one of the MOTIONS ids ('parallel' by default) and
  // shift the whole octaves to move both hands (0 by default, up to MAX_SHIFT each way). `top` is
  // the index where each staff's run turns round; `bars` holds each 4/4 bar's [first, last] index.
  // Motion 'arpeggios' builds the tonic triad's arpeggios instead (see buildArpeggios).
  function buildScale(settings) {
    if (settings.motion === 'arpeggios') return buildArpeggios(settings);
    if (settings.motion === 'broken') return buildBrokenChords(settings);
    const choice = { family: settings.family, mode: settings.mode, form: settings.form };
    const type = scaleType(choice);
    const root = matchRoot(settings.root, choice);
    const octaves = settings.octaves === 2 ? 2 : 1;
    const top = 7 * octaves;
    const up = spell(root, type.up);
    const down = spell(root, type.down);
    const signature = keySignature(fifthsOf(root) + type.keyOffset);
    const blackKeys = degrees => degrees.map(isBlackKey);
    const naturalMinor = type.family === 'minor' ? blackKeys(spell(root, NATURAL_MINOR)) : null;
    const motion = MOTIONS.find(m => m.id === settings.motion) || MOTIONS[0];
    const contrary = motion.id === 'contrary';
    const span = 7 * octaves;
    // Each hand's lowest staff position.
    let lows;
    if (contrary) {
      const start = placeUnison(root, octaves) * 7 + root.letter;
      lows = { right: start, left: start - span };
    } else if (motion.id === 'parallel') {
      lows = placeHands(root, octaves);
    } else if (motion.id === 'sixths') {
      // The right hand starts on the tonic nearest middle C (the lower one when it's a tritone
      // either way), the left hand a sixth below: E3 and C4 in C major, B2 and G3 in G, F♯3 and
      // D4 in D, B♭2 and G♭3 in G♭.
      const distance = octave => Math.abs(placeNote(octave * 7 + root.letter, root).midi - 60);
      const octave = distance(3) <= distance(4) ? 3 : 4;
      const right = octave * 7 + root.letter;
      lows = { right, left: right - 5 };
    } else {
      lows = placeInterval(root, octaves, motion.from);
    }
    // The octave shift moves both hands together, whole octaves at a time.
    const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(Number(settings.shift) || 0)));
    lows = { right: lows.right + 7 * shift, left: lows.left + 7 * shift };
    const { durations, bars } = rhythm(2 * top + 1);

    const staves = [
      { clef: 'treble', hand: 'right' },
      { clef: 'bass', hand: 'left' },
    ].map(staff => {
      const path = runPath(top, contrary && staff.hand === 'left', motion.from[staff.hand]);
      const notes = path.map(({ height, degree, rising }) => placeNote(lows[staff.hand] + height, (rising ? up : down)[degree]));
      const preferred = naturalMinor ? chooseStart(naturalMinor, staff.hand) : undefined;
      const fingers = fingerPath(path, blackKeys(up), blackKeys(down), staff.hand, top, preferred);
      const crossed = crossings(notes, fingers, staff.hand);
      const accidentals = writtenAccidentals(notes, signature, bars);
      const variety = type.family === 'minor' ? type.form.id : type.mode.id;
      // Hand-set clef changes were set for the scale's usual octave, so a shift uses the rule.
      const exception = shift === 0
        ? CLEF_EXCEPTIONS[`${motion.id} ${variety} ${idOf(root)} ${octaves} ${staff.hand}`]
        : undefined;
      const clefs = clefsFor(notes, staff.clef, top, exception);
      return {
        ...staff,
        notes: notes.map((note, i) => ({
          ...note,
          clef: clefs[i],
          duration: durations[i],
          finger: fingers[i],
          crossing: crossed[i],
          accidental: accidentals[i],
        })),
      };
    });

    return {
      pattern: 'scale', root, choice, type, title: titleOf(root, type), octaves, motion: motion.id, shift, top, bars, up, down, signature, staves,
    };
  }

  const INVERSIONS = ['Root position', '1st inversion', '2nd inversion'];

  // Arpeggio fingering. A triad has three notes to the octave and the thumb takes one of them;
  // the right hand plays 1 2 and then 3 or 4 before the thumb passes under, and the left hand
  // 3 or 4, 2 and 1 before crossing over. The thumb goes where, in turn:
  // 1. it plays a white key;
  // 2. it plays the bottom note, when that's a white key;
  // 3. it meets a black key where the hand turns (just after one for the right hand going up,
  //    just before one for the left hand), as in the scales;
  // 4. it's lower in the chord.
  // The group before each thumb stretch uses the 4th finger when it spans more than a fifth
  // (C E G then C: 1 2 3; E G C then E: 1 2 4), otherwise the 3rd. `tones` are the chord's three
  // notes from the bottom of the run up.
  function arpeggioCycle(tones, hand) {
    const black = tones.map(isBlackKey);
    const pcs = tones.map(pitchClass);
    let thumb = 0;
    let best = null;
    for (let t = 0; t < 3; t++) {
      const turnsAtBlack = hand === 'right' ? black[(t + 2) % 3] : black[(t + 1) % 3];
      const score = [black[t] ? 0 : 1, t === 0 && !black[0] ? 1 : 0, turnsAtBlack ? 1 : 0, -t];
      if (!best || compare(score, best) > 0) {
        best = score;
        thumb = t;
      }
    }
    const span = (from, to) => mod(pcs[to] - pcs[from], 12);
    const fingers = [];
    if (hand === 'right') {
      fingers[thumb] = 1;
      fingers[(thumb + 1) % 3] = 2;
      fingers[(thumb + 2) % 3] = span(thumb, (thumb + 2) % 3) > 7 ? 4 : 3;
    } else {
      fingers[thumb] = 1;
      fingers[(thumb + 2) % 3] = 2;
      fingers[(thumb + 1) % 3] = span((thumb + 1) % 3, thumb) > 7 ? 4 : 3;
    }
    return { thumb, fingers };
  }

  // Fingers for one arpeggio run up `octaves` octaves and back (3 notes to the octave).
  function arpeggioFingers(tones, hand, octaves) {
    const { thumb, fingers } = arpeggioCycle(tones, hand);
    const top = 3 * octaves;
    const run = [];
    for (let p = 0; p <= top; p++) run.push(p);
    for (let p = top - 1; p >= 0; p--) run.push(p);
    return run.map(p => {
      const finger = fingers[p % 3];
      if (hand === 'right') {
        // The top note takes the 5th rather than the thumb, and a single note below the first
        // thumb takes the 2nd (2 1 2 4 in E♭ major).
        if (p === top && finger === 1) return 5;
        if (p === 0 && thumb === 1) return 2;
        return finger;
      }
      // The left hand's bottom note takes the 5th rather than the thumb.
      if (p === 0 && finger === 1) return 5;
      return finger;
    });
  }

  function chordName(tones) {
    const third = mod(pitchClass(tones[1]) - pitchClass(tones[0]), 12);
    const fifth = mod(pitchClass(tones[2]) - pitchClass(tones[0]), 12);
    const quality = third === 4 ? (fifth === 8 ? 'augmented' : 'major') : (fifth === 6 ? 'diminished' : 'minor');
    return `${nameOf(tones[0])} ${quality}`;
  }

  // Arpeggios of the scale's tonic triad in root position, 1st and 2nd inversion, one after the
  // other on one line, each up `octaves` octaves and back in parallel motion an octave apart,
  // each starting a new bar. `segments` gives each inversion's name and [from, to] note indexes
  // and `top` (its highest note's index); `bars` covers the whole line.
  function buildArpeggios(settings) {
    const choice = { family: settings.family, mode: settings.mode, form: settings.form };
    const type = scaleType(choice);
    const root = matchRoot(settings.root, choice);
    const octaves = settings.octaves === 2 ? 2 : 1;
    const up = spell(root, type.up);
    const down = spell(root, type.down);
    const triad = [up[0], up[2], up[4]];
    const signature = keySignature(fifthsOf(root) + type.keyOffset);
    const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(Number(settings.shift) || 0)));
    const top = 3 * octaves;
    const segments = [];
    const bars = [];
    const durations = [];
    const hands = { right: [], left: [] };

    // Root position goes where parallel scales would. Each inversion starts on its bottom note
    // just above or just below that, whichever needs fewer ledger lines for the right hand, then
    // whichever is nearer, so the three stay in one part of the keyboard.
    const home = placeHands(root, octaves);
    INVERSIONS.forEach((name, inversion) => {
      const tones = [0, 1, 2].map(i => triad[(inversion + i) % 3]);
      const from = hands.right.length;
      const lift = mod(tones[0].letter - root.letter, 7);
      const rise = [lift, lift - 7]
        .map(r => ({ r, key: [...ledgerCost(home.right + r, home.right + r + 7 * octaves, STAVES.treble), Math.abs(r), -r] }))
        .sort((a, b) => compare(a.key, b.key))[0].r;
      const placement = { right: home.right + rise, left: home.left + rise };
      const rhythmOf = rhythm(2 * top + 1);
      rhythmOf.bars.forEach(([a, b]) => bars.push([from + a, from + b]));
      durations.push(...rhythmOf.durations);
      for (const hand of ['right', 'left']) {
        const low = placement[hand] + 7 * shift;
        // Staff steps from the bottom note to each chord tone above it.
        const steps = tones.map(t => mod(t.letter - tones[0].letter, 7));
        const run = [];
        for (let p = 0; p <= top; p++) run.push(p);
        for (let p = top - 1; p >= 0; p--) run.push(p);
        const notes = run.map(p => placeNote(low + 7 * Math.floor(p / 3) + steps[p % 3], tones[p % 3]));
        const fingers = arpeggioFingers(tones, hand, octaves);
        const crossed = crossings(notes, fingers, hand);
        const clefs = clefsFor(notes, hand === 'right' ? 'treble' : 'bass', top);
        notes.forEach((note, i) => hands[hand].push({ ...note, clef: clefs[i], finger: fingers[i], crossing: crossed[i] }));
      }
      segments.push({ name, from, to: hands.right.length - 1, top: from + top, chord: tones });
    });

    const staves = [
      { clef: 'treble', hand: 'right' },
      { clef: 'bass', hand: 'left' },
    ].map(staff => {
      const notes = hands[staff.hand];
      const accidentals = writtenAccidentals(notes, signature, bars);
      return {
        ...staff,
        notes: notes.map((note, i) => ({ ...note, duration: durations[i], accidental: accidentals[i] })),
      };
    });

    const title = type.family === 'minor'
      ? `${nameOf(root)} Minor Arpeggios`
      : `${titleOf(root, type)} Arpeggios`;
    return {
      pattern: 'arpeggio', root, choice, type, title, chord: chordName(triad), triad, octaves, motion: 'arpeggios', shift,
      top, segments, bars, up, down, signature, staves,
    };
  }

  // Broken chords, written in 6/8: groups of three chord notes, each group starting on the next
  // note of the triad (C E G, E G C, G C E, C E G in C major) up to the top, then the same groups
  // back down in reverse, eighth notes beamed in threes. The hand keeps one position per group:
  // the right hand plays 1 _ 5 from the bottom and the left hand 5 _ 1, with the middle note on
  // the 2nd finger when it's a third from the thumb and a fourth from the 5th, otherwise the 3rd
  // (right hand 1 3 5, 1 2 5, 1 3 5; left hand 5 3 1, 5 3 1, 5 2 1). Coming down, each group
  // reverses its fingers. The hands are an octave apart.
  const BROKEN_METER = { time: '6/8', beats: 6, value: 8, group: 3 };

  function buildBrokenChords(settings) {
    const choice = { family: settings.family, mode: settings.mode, form: settings.form };
    const type = scaleType(choice);
    const root = matchRoot(settings.root, choice);
    const octaves = settings.octaves === 2 ? 2 : 1;
    const up = spell(root, type.up);
    const down = spell(root, type.down);
    const triad = [up[0], up[2], up[4]];
    const signature = keySignature(fifthsOf(root) + type.keyOffset);
    const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(Number(settings.shift) || 0)));
    const home = placeHands(root, octaves);
    const groups = 3 * octaves + 1;
    // Staff steps from the tonic to chord note i (0 the tonic, 3 the tonic an octave up, ...).
    const chordStep = i => 7 * Math.floor(i / 3) + mod(triad[i % 3].letter - root.letter, 7);
    const count = 6 * groups;
    const bars = [];
    for (let from = 0; from < count; from += BROKEN_METER.beats) bars.push([from, from + BROKEN_METER.beats - 1]);
    const top = 3 * groups - 1;

    const staves = [
      { clef: 'treble', hand: 'right' },
      { clef: 'bass', hand: 'left' },
    ].map(staff => {
      const low = home[staff.hand] + 7 * shift;
      const chord = [];
      for (let i = 0; i < groups + 2; i++) chord.push(placeNote(low + chordStep(i), triad[i % 3]));
      const fingersFor3 = k => {
        const steps = [0, 1, 2].map(j => chordStep(k + j));
        const lower = steps[1] - steps[0];
        const upper = steps[2] - steps[1];
        // 3 staff steps is a fourth.
        return staff.hand === 'right' ? [1, upper === 3 ? 2 : 3, 5] : [5, lower === 3 ? 2 : 3, 1];
      };
      const notes = [];
      const fingers = [];
      for (let k = 0; k < groups; k++) {
        notes.push(chord[k], chord[k + 1], chord[k + 2]);
        fingers.push(...fingersFor3(k));
      }
      for (let k = groups - 1; k >= 0; k--) {
        notes.push(chord[k + 2], chord[k + 1], chord[k]);
        fingers.push(...fingersFor3(k).reverse());
      }
      const crossed = crossings(notes, fingers, staff.hand);
      const accidentals = writtenAccidentals(notes, signature, bars);
      const clefs = clefsFor(notes, staff.clef, top, undefined, BROKEN_METER.group);
      return {
        ...staff,
        notes: notes.map((note, i) => ({
          ...note, clef: clefs[i], duration: '8', finger: fingers[i], crossing: crossed[i], accidental: accidentals[i],
        })),
      };
    });

    const title = type.family === 'minor'
      ? `${nameOf(root)} Minor Broken Chords`
      : `${titleOf(root, type)} Broken Chords`;
    return {
      pattern: 'broken', root, choice, type, title, chord: chordName(triad), triad, octaves, motion: 'broken', shift,
      meter: BROKEN_METER, top, bars, up, down, signature, staves,
      tables: [{ caption: 'Ascending', from: 0, to: top }, { caption: 'Descending', from: top + 1, to: count - 1 }],
    };
  }

  return {
    LETTERS,
    MODES,
    MINOR_FORMS,
    MOTIONS,
    MAX_SHIFT,
    scaleType,
    rootsFor,
    matchRoot,
    spell,
    keySignature,
    placeHands,
    chooseStart,
    fingersFor,
    fingerPath,
    rhythm,
    buildScale,
    pitchClass,
    fifthsOf,
    isBlackKey,
    sameName,
    nameOf,
    spokenName,
    idOf,
    parseId,
  };
});
