# Beathoven

A free, open-source piano learning app for the laptop keyboard you already own. [Play Beathoven](https://regulusaa.github.io/beathoven/) or run it locally.

## Play

1. Choose from **30 complete classical piano scores of at least one minute in Free mode**. Learning mode offers all 35 complete scores as opening excerpts, including five shorter editions, plus 25 beginner studies or traditional melodies. The library shows every score's duration before selection.
2. Pick **Free mode** to play a full score to the end without stopping, or **Learning mode** to practice the opening of a full piece (the first 40 seconds of note onsets) or a short study. Learning mode rewinds after a missed note and waits until you play it correctly.
3. Press each key when its colored bar reaches the glowing line. A longer bar shows a longer hold. The black note field has no vertical guide grid, and a three-octave piano is shown below it.

The laptop's `A S D F G H J K L` keys map left to right to white piano keys C4–D5. `W E T Y U O P` are the black keys between them. On the on-screen piano, those laptop keys are labeled; the other keys can be clicked or tapped. Up/Down or the octave buttons shift the song and laptop map together. Speed can be set from 50% to 125%.

### Full-score adaptation

The complete MIDI scores often contain simultaneous notes across several octaves. Beathoven creates a **single-note laptop adaptation** by keeping the highest note at each onset and moving that note by octaves into the C4–D5 laptop range. It keeps the source's timing and complete piece length. It is a practice arrangement, not a reproduction of the original two-hand piano part. The [original MIDI scores](assets/SOURCES.md) are also in the repository. A future physical-piano mode could use them without this reduction.

### Bring your own MIDI

Use **Import MIDI** to play a `.mid` or `.midi` file you have permission to use. It is parsed in your browser and not sent to a server. Free mode keeps the complete imported piece length; Learning mode takes an opening excerpt. The file is saved in this browser's IndexedDB for later visits, and your practice checkpoint can be resumed. Clearing site data removes it. This is how you can privately play modern copyrighted music you own without Beathoven publishing its note data.

Spotify offline downloads are audio for playback inside Spotify, not MIDI note files. Look for an authorized `.mid` or `.midi` download from a creator or publisher, or create your own MIDI in a notation program when you have the necessary rights or permission. To publish a modern piece in Beathoven's public catalog, obtain a license that allows redistribution of its note data.

## Profiles and progress

The [profile page](https://regulusaa.github.io/beathoven/profile.html) lets you create a profile with a name and PIN, sign in, add a profile picture, and see rank, points, total plays, and each song's best accuracy. Progress saves automatically on this browser after each completed piece. An unfinished piece is checkpointed during practice and can be resumed from the profile page if its MIDI is still stored here. Existing guest progress from the earlier version moves into the first new profile.

**No server is needed for this device-local version.** Profiles and pictures are stored in this browser's local storage. Your PIN is hashed locally, but this is not a security boundary against someone who can access or alter this computer's browser data. Profiles do not sync between browsers or devices. Clearing site data removes them. Secure cross-device accounts would need a backend service.

Ranking points equal the sum of `difficulty stars × best accuracy` for each unique piece. Free mode counts notes struck from 0.25 seconds early to 1 second late. Learning mode scores `notes / (notes + retries)`, where a missed or wrong note adds a retry. Bar length teaches hold duration; release timing is not yet included in accuracy. The score does not yet evaluate chords or two-hand technique.

## Song rights

The 25 short pieces are original exercises or simplified arrangements of traditional/public-domain compositions. The 35 MIDI scores come from the [Mutopia Project](https://www.mutopiaproject.org/), with individual source and license details in [assets/SOURCES.md](assets/SOURCES.md). The Moonlight Sonata, Gnossiennes, and Sonata Facile scores carry separate Creative Commons Attribution-ShareAlike licenses; the repository's MIT software license does not supersede those score licenses. The other bundled MIDI files are marked public domain by Mutopia.

**Howl's Moving Castle** (Joe Hisaishi's “Merry-Go-Round of Life”) and Kensuke Ushio's **“In the Pool”** are modern copyrighted works. Their note data is not bundled in this public repository. The private MIDI importer can play personal copies the user is allowed to use. A redistribution license would be needed to include those scores in the public catalog. [Joe Hisaishi's publisher says arrangements require permission](https://joehisaishi.com/category/uncategorized/).

## Run locally

There are no runtime package dependencies or build step. Serve the repository root with any static HTTP server:

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`. Run tests with `npm test` (Node.js 20+).

## Contribute

The app uses plain HTML, CSS, and JavaScript modules. Short pieces are in `src/songs.js`, full-score metadata in `src/full-scores.js`, MIDI parsing in `src/midi.js`, timing and scoring in `src/practice.js`, and local profiles in `src/profiles.js`. New bundled scores must have a clear redistribution license and source entry in `assets/SOURCES.md`.
