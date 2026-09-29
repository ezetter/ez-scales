const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');

const MINOR_FORMS = ['natural', 'harmonic', 'melodic'];

// kind: a mode id or a minor form id.
function scale(rootId, kind, octaves = 1) {
  const minor = MINOR_FORMS.includes(kind);
  return T.buildScale({
    root: T.parseId(rootId),
    family: minor ? 'minor' : 'major',
    mode: minor ? 'ionian' : kind,
    form: minor ? kind : 'natural',
    octaves,
  });
}

const staff = (s, hand) => s.staves.find(x => x.hand === hand);
// 'up' is tonic to top; 'down' is top back to the tonic.
const part = (s, hand, direction) => {
  const { notes } = staff(s, hand);
  return direction === 'up' ? notes.slice(0, s.top + 1) : notes.slice(s.top);
};
const fingers = (s, hand, direction = 'up') => part(s, hand, direction).map(n => n.finger).join('');
const names = notes => notes.map(n => T.nameOf(n));

test('each scale offers 13 roots covering all 12 keys, none past six sharps or flats', () => {
  const choices = [
    ...T.MODES.map(m => ({ family: 'major', mode: m.id })),
    ...T.MINOR_FORMS.map(f => ({ family: 'minor', form: f.id })),
  ];
  for (const choice of choices) {
    const roots = T.rootsFor(choice);
    assert.equal(roots.length, 13);
    assert.equal(new Set(roots.map(T.pitchClass)).size, 12);
    for (const root of roots) {
      const s = T.buildScale({ ...choice, root, octaves: 1 });
      assert.ok(Math.abs(s.signature.fifths) <= 6, `${s.title} has ${s.signature.fifths}`);
    }
  }
});

test('roots are spelled for the chosen scale, in keyboard order', () => {
  assert.deepEqual(names(T.rootsFor({ family: 'major', mode: 'ionian' })),
    ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']);
  assert.deepEqual(names(T.rootsFor({ family: 'minor', form: 'harmonic' })),
    ['C', 'C♯', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B']);
  assert.deepEqual(names(T.rootsFor({ family: 'major', mode: 'dorian' })),
    ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A♭', 'A', 'B♭', 'B']);
  assert.deepEqual(names(T.rootsFor({ family: 'major', mode: 'lydian' })),
    ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B', 'C♭']);
  assert.deepEqual(names(T.rootsFor({ family: 'major', mode: 'locrian' })),
    ['C', 'C♯', 'D', 'D♯', 'E', 'E♯', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
});

test('switching scales keeps the root, renaming it when the new scale spells it differently', () => {
  const match = (id, choice) => T.nameOf(T.matchRoot(T.parseId(id), choice));
  assert.equal(match('Gb', { family: 'minor', form: 'natural' }), 'F♯');
  assert.equal(match('Ds', { family: 'major', mode: 'ionian' }), 'E♭');
  assert.equal(match('Eb', { family: 'major', mode: 'ionian' }), 'E♭');
  assert.equal(match('Db', { family: 'minor', form: 'melodic' }), 'C♯');
  assert.equal(match('Fs', { family: 'major', mode: 'locrian' }), 'F♯');
  assert.equal(match('B', { family: 'major', mode: 'lydian' }), 'B');
});

test('scales are spelled with one letter per degree', () => {
  assert.deepEqual(names(scale('Eb', 'harmonic').up), ['E♭', 'F', 'G♭', 'A♭', 'B♭', 'C♭', 'D']);
  assert.deepEqual(names(scale('Gs', 'harmonic').up), ['G♯', 'A♯', 'B', 'C♯', 'D♯', 'E', 'F𝄪']);
  assert.deepEqual(names(scale('Ds', 'melodic').up), ['D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B♯', 'C𝄪']);
  assert.deepEqual(names(scale('Ds', 'melodic').down), ['D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B', 'C♯']);
  assert.deepEqual(names(scale('Cb', 'lydian').up), ['C♭', 'D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭']);
  assert.deepEqual(names(scale('Es', 'locrian').up), ['E♯', 'F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯']);
  assert.deepEqual(names(scale('Eb', 'dorian').up), ['E♭', 'F', 'G♭', 'A♭', 'B♭', 'C', 'D♭']);
});

test('key signatures come from the parent major scale', () => {
  const sig = (id, kind) => scale(id, kind).signature;
  assert.equal(sig('D', 'dorian').fifths, 0);
  assert.equal(sig('Eb', 'dorian').vexKey, 'Db');
  assert.deepEqual(names(sig('Eb', 'dorian').accidentals), ['B♭', 'E♭', 'A♭', 'D♭', 'G♭']);
  assert.deepEqual(names(sig('Ds', 'harmonic').accidentals), ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯']);
  assert.equal(sig('Fs', 'locrian').vexKey, 'G');
  assert.equal(sig('Cb', 'lydian').vexKey, 'Gb');
  assert.equal(sig('Es', 'locrian').vexKey, 'F#');
  assert.equal(sig('Ds', 'natural').vexKey, 'F#');
  assert.equal(sig('Eb', 'harmonic').vexKey, 'Gb');
  assert.equal(sig('G', 'mixolydian').count, 0);
});

// Published fingerings, one octave going up: [right hand, left hand].
const MAJOR = {
  C: ['12312345', '54321321'],
  G: ['12312345', '54321321'],
  D: ['12312345', '54321321'],
  A: ['12312345', '54321321'],
  E: ['12312345', '54321321'],
  B: ['12312345', '43214321'],
  Fs: ['23412312', '43213214'],
  Gb: ['23412312', '43213214'],
  Db: ['23123412', '32143213'],
  Ab: ['34123123', '32143213'],
  Eb: ['31234123', '32143213'],
  Bb: ['41231234', '32143213'],
  F: ['12341234', '54321321'],
};

const HARMONIC_MINOR = {
  A: ['12312345', '54321321'],
  E: ['12312345', '54321321'],
  B: ['12312345', '43214321'],
  Fs: ['34123123', '43213214'],
  Cs: ['34123123', '32143213'],
  Gs: ['34123123', '32143213'],
  Ds: ['31234123', '21432132'],
  Eb: ['31234123', '21432132'],
  Bb: ['41231234', '21321432'],
  F: ['12341234', '54321321'],
  C: ['12312345', '54321321'],
  G: ['12312345', '54321321'],
  D: ['12312345', '54321321'],
};

// Natural minor matches harmonic minor except G♯, whose left hand keeps its thumb on E.
const NATURAL_MINOR = { ...HARMONIC_MINOR, Gs: ['34123123', '32132143'] };

// Melodic minor, up and then down from the top: [right hand, left hand] each way.
const MELODIC_MINOR = {
  A: { up: ['12312345', '54321321'], down: ['54321321', '12312345'] },
  E: { up: ['12312345', '54321321'], down: ['54321321', '12312345'] },
  B: { up: ['12312345', '43214321'], down: ['54321321', '12341234'] },
  Fs: { up: ['23123413', '43213214'], down: ['32132143', '41231234'] },
  Cs: { up: ['23123413', '32143213'], down: ['32132143', '31234123'] },
  Gs: { up: ['34123123', '32143213'], down: ['32132143', '34123123'] },
  Ds: { up: ['31234123', '21432132'], down: ['32143213', '23123412'] },
  Eb: { up: ['31234123', '21432132'], down: ['32143213', '23123412'] },
  Bb: { up: ['41231234', '21321432'], down: ['43213214', '23412312'] },
  F: { up: ['12341234', '54321321'], down: ['43214321', '12312345'] },
  C: { up: ['12312345', '54321321'], down: ['54321321', '12312345'] },
  G: { up: ['12312345', '54321321'], down: ['54321321', '12312345'] },
  D: { up: ['12312345', '54321321'], down: ['54321321', '12312345'] },
};

const reverse = text => [...text].reverse().join('');

for (const [label, table, kind] of [
  ['major', MAJOR, 'ionian'],
  ['harmonic minor', HARMONIC_MINOR, 'harmonic'],
  ['natural minor', NATURAL_MINOR, 'natural'],
]) {
  test(`${label} scales use the standard fingering`, () => {
    for (const [root, [right, left]] of Object.entries(table)) {
      const s = scale(root, kind);
      assert.equal(fingers(s, 'right'), right, `${s.title}, right hand`);
      assert.equal(fingers(s, 'left'), left, `${s.title}, left hand`);
      // Coming down, each note keeps its finger.
      assert.equal(fingers(s, 'right', 'down'), reverse(right), `${s.title}, right hand down`);
      assert.equal(fingers(s, 'left', 'down'), reverse(left), `${s.title}, left hand down`);
    }
  });
}

test('melodic minor scales use the standard fingering both ways', () => {
  for (const [root, { up, down }] of Object.entries(MELODIC_MINOR)) {
    const s = scale(root, 'melodic');
    assert.equal(fingers(s, 'right'), up[0], `${s.title}, right hand up`);
    assert.equal(fingers(s, 'left'), up[1], `${s.title}, left hand up`);
    assert.equal(fingers(s, 'right', 'down'), down[0], `${s.title}, right hand down`);
    assert.equal(fingers(s, 'left', 'down'), down[1], `${s.title}, left hand down`);
  }
});

test('two octaves carry the pattern through the middle tonic', () => {
  assert.equal(fingers(scale('C', 'ionian', 2), 'right'), '123123412312345');
  assert.equal(fingers(scale('C', 'ionian', 2), 'left'), '543213214321321');
  assert.equal(fingers(scale('Bb', 'ionian', 2), 'right'), '412312341231234');
  assert.equal(fingers(scale('Fs', 'melodic', 2), 'right'), '231234123123413');
  assert.equal(fingers(scale('Fs', 'melodic', 2), 'right', 'down'), '321321432132143');
});

test('modes follow the same rules', () => {
  assert.equal(fingers(scale('D', 'dorian'), 'right'), '12312345');
  assert.equal(fingers(scale('D', 'dorian'), 'left'), '54321321');
  // Same fingers on the same keys as D♭ major, its parent scale.
  assert.equal(fingers(scale('Eb', 'dorian'), 'right'), '31234123');
  assert.equal(fingers(scale('Eb', 'dorian'), 'left'), '21432132');
  assert.equal(fingers(scale('Fs', 'locrian'), 'right'), '41231234');
});

test('every scale is playable: thumbs on white keys, crossings through the thumb', () => {
  const kinds = [...T.MODES.map(m => m.id), ...MINOR_FORMS];
  for (const kind of kinds) {
    const minor = MINOR_FORMS.includes(kind);
    const choice = { family: minor ? 'minor' : 'major', mode: kind, form: kind };
    for (const root of T.rootsFor(choice)) {
      for (const octaves of [1, 2]) {
        const s = T.buildScale({ ...choice, root, octaves });
        for (const { hand, notes } of s.staves) {
          const where = `${s.title}, ${octaves} octave(s), ${hand} hand`;
          assert.equal(notes.length, 14 * octaves + 1, where);
          notes.forEach((note, i) => {
            assert.ok(note.finger >= 1 && note.finger <= 5, `${where}: finger ${note.finger}`);
            if (note.finger === 1) assert.ok(!note.black, `${where}: thumb on ${note.name}`);
            if (i === 0) return;
            const before = notes[i - 1];
            assert.notEqual(note.finger, before.finger, `${where}: repeated finger at ${i}`);
            if (note.crossing) assert.ok(note.finger === 1 || before.finger === 1, `${where}: crossing at ${i}`);
          });
        }
      }
    }
  }
});

test('crossings mark where the thumb passes under or a finger crosses over', () => {
  const s = scale('C', 'ionian');
  const marked = hand => part(s, hand, 'up').concat(part(s, hand, 'down').slice(1))
    .map((n, i) => (n.crossing ? `${n.name}${i}` : null)).filter(Boolean);
  assert.deepEqual(marked('right'), ['F3', 'E12']);
  assert.deepEqual(marked('left'), ['A5', 'G10']);
});

test('accidentals follow the key signature, the bar line, and courtesy naturals', () => {
  const written = (id, kind, octaves = 1) => staff(scale(id, kind, octaves), 'right').notes
    .map((n, i) => (n.accidental ? `${i}${n.accidental}` : null)).filter(Boolean);
  assert.deepEqual(written('A', 'natural'), []);
  assert.deepEqual(written('A', 'harmonic'), ['6#', '8#']);
  assert.deepEqual(written('A', 'melodic'), ['5#', '6#', '8n', '9n']);
  assert.deepEqual(written('Eb', 'harmonic'), ['6n', '8n']);
  assert.deepEqual(written('Gs', 'harmonic'), ['6##', '8##']);
  assert.deepEqual(written('A', 'melodic', 2), ['5#', '6#', '12#', '13#', '15n', '16n', '22n', '23n']);
  assert.deepEqual(written('C', 'ionian'), []);
});

test('each hand sits on its staff with as few ledger lines as possible, extras outside the system', () => {
  const octaves = (id, n = 1) => {
    const s = scale(id, 'ionian', n);
    return [staff(s, 'right').notes[0].octave, staff(s, 'left').notes[0].octave];
  };
  assert.deepEqual(octaves('C'), [4, 3]);
  assert.deepEqual(octaves('D'), [4, 2]);
  assert.deepEqual(octaves('E'), [4, 2]);
  assert.deepEqual(octaves('A'), [4, 2]);
  assert.deepEqual(octaves('B'), [4, 2]);
  assert.deepEqual(octaves('C', 2), [4, 2]);
  assert.deepEqual(octaves('E', 2), [4, 2]);
  assert.deepEqual(octaves('G', 2), [3, 1]);
});

test('note ids round-trip', () => {
  for (const id of ['C', 'Eb', 'Fs', 'Cb', 'Es', 'Fss', 'Bbb']) assert.equal(T.idOf(T.parseId(id)), id);
  assert.equal(T.parseId('H'), null);
  assert.equal(T.parseId('Cx'), null);
});
