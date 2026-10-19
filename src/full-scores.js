// Complete public-domain or separately licensed scores sourced from Mutopia.
// See assets/SOURCES.md for the source and license of each MIDI asset.
const entries = [
  ['gymnopedie-one','Gymnopédie No. 1','Erik Satie',1,37,'gymnopedie-one',141],
  ['gymnopedie-two','Gymnopédie No. 2','Erik Satie',2,38,'gymnopedie-two',195],
  ['gymnopedie-three','Gymnopédie No. 3','Erik Satie',2,39,'gymnopedie-three',180],
  ['gnossienne-one','Gnossienne No. 1','Erik Satie',2,2035,'gnossienne-one',197],
  ['gnossienne-two','Gnossienne No. 2','Erik Satie',2,2130,'gnossienne-two',199],
  ['gnossienne-three','Gnossienne No. 3','Erik Satie',2,2131,'gnossienne-three',324],
  ['traumerei','Träumerei','Robert Schumann',2,504,'traumerei',111],
  ['sonatina-aylesford','Sonatina from the Aylesford Pieces','G. F. Handel',3,169,'sonatina-aylesford',155],
  ['sonata-facile-one','Sonata Facile · I','W. A. Mozart',3,998,'sonata-facile-one',132],
  ['sonata-facile-two','Sonata Facile · II','W. A. Mozart',2,1007,'sonata-facile-two',221],
  ['sonata-facile-three','Sonata Facile · III','W. A. Mozart',3,1027,'sonata-facile-three',84],
  ['moonlight-first-movement','Moonlight Sonata · I','L. van Beethoven',4,276,'moonlight-first-movement',276],
  ['seven-variations','Seven Variations on God Save the King','L. van Beethoven',4,1024,'seven-variations',377],
  ['fur-elise-full','Für Elise','L. van Beethoven',3,931,'fur-elise',130],
  ['entertainer-full','The Entertainer','Scott Joplin',4,263,'entertainer',253],
  ['maple-leaf-rag','Maple Leaf Rag','Scott Joplin',4,23,'maple-leaf-rag',144],
  ['elite-syncopations','Elite Syncopations','Scott Joplin',4,1540,'elite-syncopations',296],
  ['eugenia','Eugenia','Scott Joplin',4,496,'eugenia',181],
  ['magnetic-rag','Magnetic Rag','Scott Joplin',4,441,'magnetic-rag',760],
  ['easy-winners','The Easy Winners','Scott Joplin',4,352,'easy-winners',304],
  ['pineapple-rag','Pineapple Rag','Scott Joplin',4,1899,'pineapple-rag',177],
  ['clair-de-lune','Clair de Lune','Claude Debussy',4,1778,'clair-de-lune',323],
  ['arabesque-one','Première Arabesque','Claude Debussy',4,1777,'arabesque-one',176],
  ['invention-two','Invention No. 2','J. S. Bach',3,58,'invention-two',101],
  ['invention-three','Invention No. 3','J. S. Bach',3,70,'invention-three',67],
  ['invention-four','Invention No. 4','J. S. Bach',3,67,'invention-four',52],
  ['invention-five','Invention No. 5','J. S. Bach',3,55,'invention-five',73],
  ['invention-seven','Invention No. 7','J. S. Bach',3,73,'invention-seven',61],
  ['prelude-e-minor','Prelude in E minor, Op. 28 No. 4','Frédéric Chopin',3,468,'prelude-e-minor',108],
  ['minuet-g-major','Minuet in G major','Christian Petzold',2,75,'minuet-g-major',41],
  ['minuet-g-minor','Minuet in G minor','Christian Petzold',2,76,'minuet-g-minor',41],
  ['minuet-b-flat','Minuet in B♭ major','J. S. Bach',2,1014,'minuet-b-flat',78],
  ['minuet-a-minor','Minuet in A minor','J. S. Bach',2,1612,'minuet-a-minor',64],
  ['minuet-c-minor','Minuet in C minor','J. S. Bach',2,1613,'minuet-c-minor',40],
  ['musette','Musette','J. S. Bach',2,79,'musette',20]
];

export const FULL_SCORES = entries.map(([id,title,composer,difficulty,sourceId,file,duration]) => ({
  id,title,composer,difficulty,sourceId,duration,
  midiUrl: `./assets/midi/${file}.mid`,
  sourceUrl: `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${sourceId}`,
  kind: 'full'
}));

// Short complete editions are valuable practice, but Free mode is for longer sessions.
export const FREE_SCORE_MIN_DURATION = 60;
export const FREE_SCORES = FULL_SCORES.filter(song => song.duration >= FREE_SCORE_MIN_DURATION);
