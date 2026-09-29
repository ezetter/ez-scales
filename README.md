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
| **Motion** | Parallel (default), Contrary | Parallel: both hands go up together and come back down. Contrary: both hands start in unison on the tonic, the right hand goes up while the left goes down, and they come back together. Each hand keeps its usual fingering on every key; in melodic minor each hand plays the raised 6th and 7th only while it's going up. |
| **Root order** | Alphabetical (default), Circle of fifths | How the root buttons are laid out. Alphabetical runs up the keyboard from C. Circle of fifths starts at the key with no sharps or flats (C major, A minor, D Dorian), goes through the sharp keys to six sharps, then the flat keys from six flats back to one: C G D A E B F♯ G♭ D♭ A♭ E♭ B♭ F in major. |

Changing the scale keeps the same key, renamed if needed: G♭ major becomes F♯ minor.

### What the sheet shows

- The scale's name, key signature, parent or relative major, and notes.
- The grand staff in 4/4: eighth notes beamed in fours, eight to a bar, with the last note held to fill the final bar (a quarter note for one octave, a half note for two). Accidentals follow the usual rules: a sign lasts to the end of its bar, and a courtesy sign reminds you when a line or space changes back in a later bar, as with melodic minor's naturals on the way down.
- Circled numbers mark where the hand shifts: the thumb passes under, or a finger crosses over the thumb.
- Each hand is placed on its staff with as few ledger lines as possible, so the hands may be one or two octaves apart.
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
