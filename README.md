# Beathoven

A free, open-source piano learning app for the laptop keyboard you already own. Play it at [regulusaa.github.io/beathoven](https://regulusaa.github.io/beathoven/) or run it locally.

## Play

1. Choose a song from the 25-piece starter library.
2. Pick **Free mode** for uninterrupted play and an accuracy score, or **Learning mode** to pause on a missed or wrong note until you play it correctly.
3. Press notes as their falling bars reach the glowing line. A longer bar means hold the key longer.

The white keys are on `A S D F G H J K L`, moving from C4 to D5. Black keys sit between them on `W E T Y U O P`. The on-screen piano shows the same geometry. Use the octave buttons or Up/Down arrows to shift the keyboard **and song together**. The initial beat count gives you time to prepare. Click or tap the on-screen keys to practice without a physical keyboard.

There are four difficulty levels, song search, 50–125% speed controls, a sound toggle, and restart/pause controls. Sound is made in the browser with Web Audio; no recordings or external audio files are required. Progress is saved in this browser's local storage. Your rank is based on each unique song's star difficulty and best accuracy: `points = sum(stars × best accuracy)`. Song and play counts are also shown. Clearing browser storage clears progress. There are no accounts or online leaderboards in this version.

**Accuracy:** Free mode counts notes struck from 0.25 seconds early to 1 second late. Learning mode scores `notes / (notes + retries)`, where a missed or wrong note adds a retry. Bar length teaches hold duration; release timing is not yet included in accuracy. The library is currently melody only, without chords or accompaniment.

## Song rights

The library consists of original teaching exercises and simplified, newly entered arrangements of traditional or public-domain compositions. It does not contain copyrighted audio recordings, commercial scores, or downloaded song files. Original exercise note data and arrangements are provided under the repository's MIT license. Titles of familiar melodies identify the underlying public-domain works, not a particular copyrighted edition. Additions should follow the same rule and document their source.

## Run locally

There are no package dependencies or build step. Serve the repository root with any static HTTP server:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`. Run the small timing and catalog tests with `npm test` (Node.js 20+).

## Contribute

The app uses plain HTML, CSS, and JavaScript modules. Song entries live in `src/songs.js`, timing and scoring in `src/practice.js`, keyboard mapping in `src/music.js`, and audio in `src/audio.js`. Keep new arrangements within the displayed keyboard range (C4–D5 before octave shifting), and run `npm test` before opening a pull request.
