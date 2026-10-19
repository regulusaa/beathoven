// Note sequences are original teaching exercises or newly transcribed,
// simplified arrangements of traditional/public-domain compositions.
// A token is NOTE/BEATS; R is a rest. Every arrangement fits the visible range.
const entries = [
  ['first-steps','First Steps','Original exercise',1,88,'C4/1 D4/1 E4/1 F4/1 G4/2 F4/1 E4/1 D4/1 C4/2'],
  ['home-row','Home Row Walk','Original exercise',1,90,'C4/1 D4/1 E4/1 F4/1 G4/1 A4/1 B4/1 C5/2 B4/1 A4/1 G4/1 F4/1 E4/1 D4/1 C4/2'],
  ['little-echo','Little Echo','Original exercise',1,82,'C4/1 E4/1 G4/2 C4/1 E4/1 G4/2 D4/1 F4/1 A4/2 D4/1 F4/1 A4/2'],
  ['twinkle','Twinkle, Twinkle, Little Star','Traditional · simplified',1,100,'C4/1 C4/1 G4/1 G4/1 A4/1 A4/1 G4/2 F4/1 F4/1 E4/1 E4/1 D4/1 D4/1 C4/2 G4/1 G4/1 F4/1 F4/1 E4/1 E4/1 D4/2 G4/1 G4/1 F4/1 F4/1 E4/1 E4/1 D4/2 C4/1 C4/1 G4/1 G4/1 A4/1 A4/1 G4/2 F4/1 F4/1 E4/1 E4/1 D4/1 D4/1 C4/2'],
  ['mary','Mary Had a Little Lamb','Traditional · simplified',1,105,'E4/1 D4/1 C4/1 D4/1 E4/1 E4/1 E4/2 D4/1 D4/1 D4/2 E4/1 G4/1 G4/2 E4/1 D4/1 C4/1 D4/1 E4/1 E4/1 E4/1 E4/1 D4/1 D4/1 E4/1 D4/1 C4/4'],
  ['hot-cross','Hot Cross Buns','Traditional',1,95,'E4/1 D4/1 C4/2 E4/1 D4/1 C4/2 C4/0.5 C4/0.5 C4/0.5 C4/0.5 D4/0.5 D4/0.5 D4/0.5 D4/0.5 E4/1 D4/1 C4/2'],
  ['morning-light','Morning Light','Original exercise',1,92,'C4/1 D4/1 E4/1 G4/1 E4/2 D4/2 C4/1 E4/1 G4/1 C5/1 B4/2 G4/2'],
  ['london-bridge','London Bridge','Traditional · simplified',2,105,'G4/1 A4/1 G4/1 F4/1 E4/1 F4/1 G4/2 D4/1 E4/1 F4/2 E4/1 F4/1 G4/2 G4/1 A4/1 G4/1 F4/1 E4/1 F4/1 G4/2 D4/2 G4/2 E4/1 C4/3'],
  ['frere-jacques','Frère Jacques','Traditional',2,100,'C4/1 D4/1 E4/1 C4/1 C4/1 D4/1 E4/1 C4/1 E4/1 F4/1 G4/2 E4/1 F4/1 G4/2 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4/1 C4/1 G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4/1 C4/1 C4/1 G4/1 C4/2'],
  ['ode-to-joy','Ode to Joy','Beethoven · simplified',2,104,'E4/1 E4/1 F4/1 G4/1 G4/1 F4/1 E4/1 D4/1 C4/1 C4/1 D4/1 E4/1 E4/1.5 D4/0.5 D4/2 E4/1 E4/1 F4/1 G4/1 G4/1 F4/1 E4/1 D4/1 C4/1 C4/1 D4/1 E4/1 D4/1.5 C4/0.5 C4/2'],
  ['raindrops','Raindrops','Original exercise',2,96,'G4/0.5 E4/0.5 C4/1 G4/0.5 E4/0.5 C4/1 A4/0.5 F4/0.5 D4/1 A4/0.5 F4/0.5 D4/1 G4/1 E4/1 D4/1 C4/2'],
  ['skip-stones','Skipping Stones','Original exercise',2,108,'C4/0.5 E4/0.5 G4/1 D4/0.5 F4/0.5 A4/1 E4/0.5 G4/0.5 B4/1 F4/0.5 A4/0.5 C5/1 B4/1 G4/1 E4/1 C4/2'],
  ['jingle-bells','Jingle Bells','J. Pierpont · simplified',2,112,'E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1 D4/1 E4/4 F4/1 F4/1 F4/1 F4/1 F4/1 E4/1 E4/1 E4/0.5 E4/0.5 E4/1 D4/1 D4/1 E4/1 D4/2 G4/2'],
  ['saints','When the Saints Go Marching In','Traditional · simplified',2,106,'C4/1 E4/1 F4/1 G4/2 C4/1 E4/1 F4/1 G4/2 C4/1 E4/1 F4/1 G4/1 E4/1 C4/1 E4/1 D4/2 E4/1 E4/1 D4/1 C4/1 C4/1 E4/1 G4/1 G4/1 F4/1 E4/1 F4/1 G4/1 E4/1 C4/1 D4/1 C4/2'],
  ['minuet-morning','Minuet Morning','Original exercise',2,90,'G4/1 C5/1 B4/1 A4/1 G4/2 E4/2 F4/1 A4/1 G4/1 F4/1 E4/2 D4/2 C4/1 E4/1 G4/1 C5/1 B4/1 A4/1 G4/2 F4/1 E4/1 D4/1 C4/3'],
  ['sharps-and-flats','Black Key Bridge','Original exercise',2,96,'C4/1 C#4/1 D4/1 D#4/1 E4/2 F4/1 F#4/1 G4/1 G#4/1 A4/2 A#4/1 B4/1 C5/2 B4/1 A#4/1 A4/1 G#4/1 G4/1 F#4/1 F4/1 E4/1 D#4/1 D4/1 C#4/1 C4/2'],
  ['can-can','Can-Can','Offenbach · opening, simplified',3,124,'C4/0.5 D4/0.5 E4/0.5 F4/0.5 G4/0.5 A4/0.5 B4/0.5 C5/0.5 C5/1 B4/1 A4/1 G4/1 F4/0.5 E4/0.5 D4/0.5 C4/0.5 D4/1 E4/1 F4/1 G4/1'],
  ['midnight-train','Midnight Train','Original exercise',3,116,'C4/0.5 E4/0.5 G4/0.5 C5/0.5 B4/1 G4/1 A4/0.5 F4/0.5 D4/0.5 F4/0.5 E4/1 C4/1 C4/0.5 E4/0.5 G4/0.5 C5/0.5 D5/1 C5/1 B4/0.5 G4/0.5 E4/0.5 D4/0.5 C4/2'],
  ['greensleeves','Greensleeves','Traditional · opening, transposed',3,88,'D4/1 F4/2 G4/1 A4/1 A#4/1 A4/1 G4/2 E4/1 C4/1 D4/1 E4/1 F4/2 D4/1 D4/1 C#4/1 D4/2'],
  ['spring-path','Spring Path','Original exercise',3,118,'C4/0.5 D4/0.5 E4/0.5 G4/0.5 A4/1 G4/1 E4/0.5 F4/0.5 G4/0.5 B4/0.5 C5/1 G4/1 A4/0.5 G4/0.5 F4/0.5 E4/0.5 D4/1 E4/1 C4/2'],
  ['chromatic-climb','Chromatic Climb','Original exercise',3,112,'C4/0.5 C#4/0.5 D4/0.5 D#4/0.5 E4/0.5 F4/0.5 F#4/0.5 G4/0.5 G#4/0.5 A4/0.5 A#4/0.5 B4/0.5 C5/1 G4/1 E4/1 C4/2'],
  ['waltz-in-c','Waltz in C','Original exercise',3,94,'C4/1 E4/1 G4/1 C5/2 G4/1 B4/1 G4/1 D4/1 F4/1 A4/1 C5/2 A4/1 G4/1 E4/1 D4/1 C4/3'],
  ['flight-study','Flight Study','Original exercise',4,130,'C4/0.5 E4/0.5 G4/0.5 C5/0.5 B4/0.5 G4/0.5 E4/0.5 C4/0.5 D4/0.5 F4/0.5 A4/0.5 D5/0.5 C5/0.5 A4/0.5 F4/0.5 D4/0.5 E4/0.5 G4/0.5 B4/0.5 C5/0.5 G4/0.5 E4/0.5 D4/0.5 C4/0.5 C4/2'],
  ['blue-hour','Blue Hour','Original exercise',4,106,'C4/0.75 E4/0.25 G4/0.5 A#4/0.5 A4/1 G4/1 F#4/0.5 G4/0.5 D#4/0.5 E4/0.5 C4/1 D4/0.5 E4/0.5 G4/0.5 A#4/0.5 C5/1 G4/1 E4/1 C4/2'],
  ['octave-dance','Octave Dance','Original exercise',4,122,'C4/0.5 C5/0.5 B4/0.5 D4/0.5 E4/0.5 G4/0.5 C5/1 A4/0.5 F4/0.5 D4/0.5 F4/0.5 G4/0.5 B4/0.5 D5/1 C5/0.5 G4/0.5 E4/0.5 C4/0.5 C4/2']
];

export const SONGS = entries.map(([id,title,composer,difficulty,bpm,score]) => ({
  id, title, composer, difficulty, bpm,
  notes: score.split(' ').map(token => {
    const [pitch, beats] = token.split('/');
    return { pitch: pitch === 'R' ? null : pitch, beats: Number(beats) };
  })
}));
