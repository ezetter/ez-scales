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

  // [ledger lines on the busier side, ledger lines in all] to write steps low..high on a staff.
  function ledgerCost(low, high, staff) {
    const above = high > staff.top ? Math.floor((high - staff.top) / 2) : 0;
    const below = low < staff.bottom ? Math.floor((staff.bottom - low) / 2) : 0;
    return [Math.max(above, below), above + below];
  }

  // The octave of each hand's starting tonic: whatever needs the fewest ledger lines on that
  // hand's staff. Between equally tidy choices the right hand goes higher and the left hand lower,
  // so the extra ledger lines stay outside the system and the space between the staves is clear.
  function placeHands(root, octaves) {
    const span = 7 * octaves;
    const tidiest = (staff, higher) => {
      let best = null;
      for (let octave = 1; octave <= 6; octave++) {
        const low = octave * 7 + root.letter;
        const key = [...ledgerCost(low, low + span, STAVES[staff]), higher ? -octave : octave];
        if (!best || compare(key, best.key) < 0) best = { octave, key };
      }
      return best.octave;
    };
    return { right: tidiest('treble', true), left: tidiest('bass', false) };
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

  // Fingers for the whole run, up from the tonic to the top and back down. `up` and `down` are
  // each direction's black keys (different only in melodic minor).
  function fingerRun(up, down, hand, octaves, preferred) {
    const upFingers = fingersFor(chooseStart(up, hand, preferred), hand);
    const downFingers = fingersFor(chooseStart(down, hand, preferred), hand);
    const top = 7 * octaves;
    const fingers = [];
    for (let i = 0; i <= top; i++) fingers.push(upFingers[i % 7]);
    for (let i = top - 1; i >= 0; i--) fingers.push(downFingers[i % 7]);
    const last = fingers.length - 1;
    const belowUp = fingers[top - 1];
    const belowDown = fingers[top + 1];
    if (hand === 'right') {
      // The top note carries on from the fingers under it rather than taking the thumb: 5 after
      // 4 in C major, 4 after 3 in F major, 3 after 1 and 2 where the two directions differ.
      fingers[top] = Math.max(belowUp, belowDown) + 1;
    } else {
      if (belowUp !== 1 && belowDown !== 1) fingers[top] = Math.min(belowUp, belowDown) - 1;
      // The bottom note joins the fingers above it rather than taking the thumb: 5 4 3 2 1.
      if (fingers[0] === 1) fingers[0] = fingers[1] + 1;
      if (fingers[last] === 1) fingers[last] = fingers[last - 1] + 1;
    }
    return fingers;
  }

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

  // Everything the page draws for one scale. settings: { root, family, mode, form, octaves },
  // with root as a note name. Each staff's notes run up from the tonic and back down; `top` is the
  // index of the highest note. `bars` holds each 4/4 bar's [first, last] note index.
  function buildScale(settings) {
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
    const placement = placeHands(root, octaves);
    const { durations, bars } = rhythm(2 * top + 1);

    const staves = [
      { clef: 'treble', hand: 'right', octave: placement.right },
      { clef: 'bass', hand: 'left', octave: placement.left },
    ].map(staff => {
      const first = staff.octave * 7 + root.letter;
      const notes = [];
      for (let i = 0; i <= top; i++) notes.push(placeNote(first + i, up[i % 7]));
      for (let i = top - 1; i >= 0; i--) notes.push(placeNote(first + i, down[i % 7]));
      const preferred = naturalMinor ? chooseStart(naturalMinor, staff.hand) : undefined;
      const fingers = fingerRun(blackKeys(up), blackKeys(down), staff.hand, octaves, preferred);
      const crossed = crossings(notes, fingers, staff.hand);
      const accidentals = writtenAccidentals(notes, signature, bars);
      return {
        ...staff,
        notes: notes.map((note, i) => ({
          ...note, duration: durations[i], finger: fingers[i], crossing: crossed[i], accidental: accidentals[i],
        })),
      };
    });

    return { root, choice, type, title: titleOf(root, type), octaves, top, bars, up, down, signature, staves };
  }

  return {
    LETTERS,
    MODES,
    MINOR_FORMS,
    scaleType,
    rootsFor,
    matchRoot,
    spell,
    keySignature,
    placeHands,
    chooseStart,
    fingersFor,
    fingerRun,
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
