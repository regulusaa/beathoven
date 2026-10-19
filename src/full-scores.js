// Complete public-domain or separately licensed scores sourced from Mutopia.
// See assets/SOURCES.md for the source and license of each MIDI asset.
const entries = [
  ['moonlight-first-movement','Moonlight Sonata · I','L. van Beethoven',4,276,'moonlight-first-movement'],
  ['fur-elise-full','Für Elise','L. van Beethoven',3,931,'fur-elise'],
  ['entertainer-full','The Entertainer','Scott Joplin',4,263,'entertainer'],
  ['maple-leaf-rag','Maple Leaf Rag','Scott Joplin',4,23,'maple-leaf-rag'],
  ['elite-syncopations','Elite Syncopations','Scott Joplin',4,1540,'elite-syncopations'],
  ['eugenia','Eugenia','Scott Joplin',4,496,'eugenia'],
  ['magnetic-rag','Magnetic Rag','Scott Joplin',4,441,'magnetic-rag'],
  ['easy-winners','The Easy Winners','Scott Joplin',4,352,'easy-winners'],
  ['pineapple-rag','Pineapple Rag','Scott Joplin',4,1899,'pineapple-rag'],
  ['clair-de-lune','Clair de Lune','Claude Debussy',4,1778,'clair-de-lune'],
  ['arabesque-one','Première Arabesque','Claude Debussy',4,1777,'arabesque-one'],
  ['invention-two','Invention No. 2','J. S. Bach',3,58,'invention-two'],
  ['invention-three','Invention No. 3','J. S. Bach',3,70,'invention-three'],
  ['invention-four','Invention No. 4','J. S. Bach',3,67,'invention-four'],
  ['invention-five','Invention No. 5','J. S. Bach',3,55,'invention-five'],
  ['invention-seven','Invention No. 7','J. S. Bach',3,73,'invention-seven'],
  ['prelude-e-minor','Prelude in E minor, Op. 28 No. 4','Frédéric Chopin',3,468,'prelude-e-minor'],
  ['minuet-b-flat','Minuet in B♭ major','J. S. Bach',2,1014,'minuet-b-flat'],
  ['minuet-a-minor','Minuet in A minor','J. S. Bach',2,1612,'minuet-a-minor'],
  ['minuet-c-minor','Minuet in C minor','J. S. Bach',2,1613,'minuet-c-minor'],
  ['musette','Musette','J. S. Bach',2,79,'musette']
];

export const FULL_SCORES = entries.map(([id,title,composer,difficulty,sourceId,file]) => ({
  id,title,composer,difficulty,sourceId,
  midiUrl: `./assets/midi/${file}.mid`,
  sourceUrl: `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${sourceId}`,
  kind: 'full'
}));
