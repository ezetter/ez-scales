# Piano Scales with Fingerings

Shows a scale on a grand staff, ascending and descending, with the standard piano fingering for each hand: right hand above the treble staff, left hand below the bass staff.

## Run it

Open `index.html` in a browser. Or serve the folder and go to http://localhost:8777:

```bash
python3 -m http.server 8777
```

The notation library ([VexFlow](https://www.vexflow.com) 4.2.5) and the fonts load from CDNs, so the page needs an internet connection. Your last settings are remembered in the browser's local storage.

## Using it

| Control | Choices | What it does |
| --- | --- | --- |
| **Root** | 13 keys | The scale's starting note. Names follow the scale's key signature, so the same key is D♭ in major and C♯ in minor. The one key that can be written with six sharps or six flats appears both ways: F♯ and G♭ major, D♯ and E♭ minor, and so on for each mode. Black-key roots look like black keys. |
| **Scale** | Major, Minor | Major offers the seven modes; Minor offers the three minor forms. |
| **Mode** | Ionian (default), Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian | Modes of the major scale, each built on the chosen root: D Dorian is D to D with C major's key signature. |
| **Minor form** | Natural, Harmonic, Melodic | Melodic minor raises the 6th and 7th going up and comes back down as natural minor. |
| **Octaves** | 1, 2 | Two octaves show how the fingering carries on through the middle of the scale. |
| **Motion** | Parallel (default), Parallel in thirds, Parallel in sixths, Contrary, Arpeggios | Parallel: both hands go up together, exactly an octave apart, and come back down. In thirds: the left hand starts on the tonic and the right hand exactly a third higher, on the 3rd degree (C3 and E3 in C major). In sixths: the right hand starts on the tonic nearest middle C and the left hand exactly a sixth lower, on the 3rd degree (E3 and C4 in C major, B2 and G3 in G, C♯3 and A3 in A, F♯3 and D4 in D). F♯ and G♭ are a tritone from middle C either way and take the lower tonic (B♭2 and G♭3 in G♭). The hands stay that interval apart throughout, so a hand may spend part of the run in the other hand's clef (see below). Contrary: both hands start in unison on the tonic, the right hand goes up while the left goes down, and they come back together. Each hand keeps the key's usual fingering on every note; in melodic minor each hand plays the raised 6th and 7th only while it's going up. Arpeggios plays the scale's tonic triad (major, minor, or diminished for Locrian) in root position, 1st inversion and 2nd inversion, one after another on one line; each goes up the chosen number of octaves and back, starts a new bar, and is labeled above the staff, with the hands an octave apart. |
| **Octave shift** | ↓ and ↑ arrows, −2 to +2 (default 0) | Moves both hands up or down a whole octave per press. Fingering and accidentals stay the same; clefs are worked out again for the new range, so a hand may change clef where it didn't before. |
| **Root order** | Alphabetical (default), Circle of fifths | How the root buttons are laid out. Alphabetical runs up the keyboard from C. Circle of fifths starts at the key with no sharps or flats (C major, A minor, D Dorian), goes through the sharp keys to six sharps, then the flat keys from six flats back to one: C G D A E B F♯ G♭ D♭ A♭ E♭ B♭ F in major. |

Octaves, Octave shift, Motion and Root order are at the top right; the scale, mode and root are buttons. Changing the scale keeps the same key, renamed if needed: G♭ major becomes F♯ minor.

### What the sheet shows

- **Play** above the staff plays both hands on a synthesized piano in the written rhythm, at the **Tempo** beside it (quarter notes a minute, 40–208, default 96). The note sounding turns red on the staff, with its finger numbers, and a wide score scrolls to keep it in view. Press **Stop**, or change any setting, to stop. The piano is synthesized with the Web Audio API (the same sound as Chord Progression Builder), since the published page can't load recorded samples.

- The scale's name, key signature, parent or relative major, and notes.
- The grand staff in 4/4: eighth notes beamed in fours, eight to a bar, with the last note held to fill the final bar (a quarter note for one octave, a half note for two). Accidentals follow the usual rules: a sign lasts to the end of its bar, and a courtesy sign reminds you when a line or space changes back in a later bar, as with melodic minor's naturals on the way down.
- Few clef changes. Each staff stays in its own clef, using up to two ledger lines, and changes clef only for notes three or more ledger lines off it (E3 and below under the treble staff, A4 and up over the bass). Then it changes once going out and once coming back, at the same pitch both ways, with the outward change at the start of a beam group; a change around the top of the run covers at least twelve notes. In two octaves of C major sixths, the left hand goes to treble at F4 at the start of bar 2 and back to bass at F4 halfway through bar 3, while the right hand stays in treble. In C major thirds the right hand starts in bass clef on E3 and goes to treble at B3. A few engravings are set by hand where the rule doesn't give the preferred result: two octaves of G♭ major in sixths keep the left hand in treble for only the four notes at the top (`CLEF_EXCEPTIONS` in `js/theory.js`). A small clef sign marks each change, the other staff leaves the same room so the notes stay lined up, and beams break at a clef change.
- Circled numbers mark where the hand shifts: the thumb passes under, or a finger crosses over the thumb.
- In parallel motion the hands are exactly an octave apart, with the right hand placed for the fewest ledger lines on the treble staff (C4 over C3, D4 over D3). Over two octaves one hand usually crosses into the other clef for about a bar.
- A table of the fingering note by note, with a second table for the way back when it differs (melodic minor). In contrary motion the table lists each hand's notes separately.

## How the fingering is chosen

Major and minor scales match the standard fingerings in piano scale books, and `test/theory.test.js` checks all of them against published tables. Modes have no single standard, so every scale is fingered by the same rules. The thumb plays two notes per octave, three scale steps apart, with groups of three and four fingers between. Of the seven places that pattern can go, the app takes the one that best meets these, in order:

1. The thumb plays white keys only.
2. A scale that starts on a white key has the thumb on its tonic.
3. The thumb meets a black key where the hand turns: the right hand's thumb passes under just after one, and the left hand crosses over onto one.
4. Harmonic and melodic minor keep the natural minor's fingering.
5. The 4th finger lands on a black key.
6. Going up, the right hand plays 1 2 3 from the tonic and the left hand 5 4 3 2 1.

The top note takes the next finger instead of the thumb (5 in C major's right hand), and so does the left hand's bottom note. In F♯ and C♯ melodic minor the right hand's fingering changes on the way down, because the raised notes move the thumb.

### Arpeggio fingering

Arpeggios follow the same principles. The thumb takes one note of the triad per octave: a white key, the bottom note when that's white, and otherwise where it meets a black key as the hand turns (just after one in the right hand, just before one in the left). A group spanning more than a fifth uses the 4th finger, otherwise the 3rd. That gives the standard fingerings: C major 1 2 3 1 2 3 5 / 5 4 2 1 4 2 1 in root position, 1 2 4 / 5 4 2 1 in 1st inversion and 1 2 4 / 5 3 2 1 in 2nd; E♭, A♭ and D♭ major 2 1 2 4 / 2 1 4 2; B♭ major 2 1 2 4 / 3 2 1 3. Each inversion starts on its bottom note just above or below where root position starts, whichever needs fewer ledger lines.

## Tests

```bash
npm test
```

No dependencies to install; the tests use Node's built-in runner.

## Files

- `index.html`: the page and its styles
- `js/theory.js`: spelling, key signatures, scales, staff placement and fingering (no DOM code)
- `js/app.js`: the controls, the staff drawing and the fingering table
- `test/theory.test.js`: tests for `theory.js`
