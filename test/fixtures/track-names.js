// Filenames and expected parses carried over from the previous MetaParser test suite.
export const trackNameCases = [
  {
    input: 'The Beatles - A Day In The Life',
    output: {
      artist: 'Beatles, The',
      artistNorm: 'Beatles',
      title: 'Day In The Life, A',
      titleNorm: 'Day In The Life',
    },
  },
  {
    input: 'Beatles, The - Day In The Life, A',
    output: {
      artist: 'Beatles, The',
      artistNorm: 'Beatles',
      title: 'Day In The Life, A',
      titleNorm: 'Day In The Life',
    },
  },
  {
    input: 'ABC12345-01_-_Lion_King,_The_-_Warthog_Rhapsody',
    output: {
      artist: 'Lion King, The',
      artistNorm: 'Lion King',
      title: 'Warthog Rhapsody',
      titleNorm: 'Warthog Rhapsody',
    },
  },
  {
    input: 'ABC-1234-THE LIFE OF RILEY-LIGHTNING SEEDS, THE',
    output: {
      artist: 'ABC-1234-THE LIFE OF RILEY',
      artistNorm: 'ABC1234THE LIFE OF RILEY',
      title: 'LIGHTNING SEEDS, THE',
      titleNorm: 'LIGHTNING SEEDS',
    },
  },
  {
    input: 'MJM10-01 - Temp - The Beat Goes On [duet]',
    output: {
      artist: 'Temp',
      artistNorm: 'Temp',
      title: 'Beat Goes On, The [duet]',
      titleNorm: 'Beat Goes On The duet',
    },
  },
  {
    input: 'Tyler, The Creator - See You Again [AZ Karaoke]',
    output: {
      artist: 'Tyler, The Creator',
      artistNorm: 'Tyler The Creator',
      title: 'See You Again',
      titleNorm: 'See You Again',
    },
  },
  {
    input: 'Calvin Harris ft. Florence Welch - Sweet Nothing [AZ Karaoke]',
    output: {
      artist: 'Calvin Harris ft. Florence Welch',
      artistNorm: 'Calvin Harris ft Florence Welch',
      title: 'Sweet Nothing',
      titleNorm: 'Sweet Nothing',
    },
  },
  {
    input: 'Britney Spears Ft Will.I.Am - It Should Be Easy [AZ Karaoke]',
    output: {
      artist: 'Britney Spears ft. Will.I.Am',
      artistNorm: 'Britney Spears ft WillIAm',
      title: 'It Should Be Easy',
      titleNorm: 'It Should Be Easy',
    },
  },
  {
    input: 'Lloyd Ft Andre 3000 & Lil Wayne - Dedication To My Ex (Miss That) [Karaoke]',
    output: {
      artist: 'Lloyd ft. Andre 3000 & Lil Wayne',
      artistNorm: 'Lloyd ft Andre 3000 and Lil Wayne',
      title: 'Dedication To My Ex (Miss That)',
      titleNorm: 'Dedication To My Ex Miss That',
    },
  },
  {
    input: 'Britney Spears Feat. G-Eazy - Make Me [AZ Karaoke]',
    output: {
      artist: 'Britney Spears ft. G-Eazy',
      artistNorm: 'Britney Spears ft GEazy',
      title: 'Make Me',
      titleNorm: 'Make Me',
    },
  },
  {
    input: 'Charli Xcx Feat Lil Yachty - After The Afterparty [AZ Karaoke]',
    output: {
      artist: 'Charli Xcx ft. Lil Yachty',
      artistNorm: 'Charli Xcx ft Lil Yachty',
      title: 'After The Afterparty',
      titleNorm: 'After The Afterparty',
    },
  },
  {
    input: '01 - Sinatra, Nancy & Frank - Something Stupid',
    output: {
      artist: 'Sinatra, Nancy & Frank',
      artistNorm: 'Sinatra Nancy and Frank',
      title: 'Something Stupid',
      titleNorm: 'Something Stupid',
    },
  },
  {
    input: 'Az123-01 - Knight, Gladys & The Pips - Way We Were, The',
    output: {
      artist: 'Knight, Gladys & The Pips',
      artistNorm: 'Knight Gladys and The Pips',
      title: 'Way We Were, The',
      titleNorm: 'Way We Were',
    },
  },
  {
    input: '01 - Pickett, Bobby Boris & Crypt Kickers - Monster Mash',
    output: {
      artist: 'Pickett, Bobby Boris & Crypt Kickers',
      artistNorm: 'Pickett Bobby Boris and Crypt Kickers',
      title: 'Monster Mash',
      titleNorm: 'Monster Mash',
    },
  },
  {
    input: 'AZ1234-01 - Van Beethoven, Camper - Take The Skinheads Bowling',
    output: {
      artist: 'Camper Van Beethoven',
      artistNorm: 'Camper Van Beethoven',
      title: 'Take The Skinheads Bowling',
      titleNorm: 'Take The Skinheads Bowling',
    },
  },
  {
    input: 'Camper Van Beethoven - Take The Skinheads Bowling [AZ Karaoke]',
    output: {
      artist: 'Camper Van Beethoven',
      artistNorm: 'Camper Van Beethoven',
      title: 'Take The Skinheads Bowling',
      titleNorm: 'Take The Skinheads Bowling',
    },
  },
  {
    input: 'AB1234Z-01 - Scott, Linda - I\'ve Told Every Little Star',
    output: {
      artist: 'Linda Scott',
      artistNorm: 'Linda Scott',
      title: 'I\'ve Told Every Little Star',
      titleNorm: 'Ive Told Every Little Star',
    },
  },
  {
    input: 'The Bird & The Bee - Something & Something (test)',
    output: {
      artist: 'Bird & The Bee, The',
      artistNorm: 'Bird and The Bee',
      title: 'Something & Something (test)',
      titleNorm: 'Something and Something test',
    },
  },
  {
    input: '(You Drive Me) Crazy in the Style of \'Britney Spears\' karaoke video with lyrics (with lead vocal)',
    output: {
      artist: '\'Britney Spears\' karaoke video with lyrics',
      artistNorm: 'Britney Spears karaoke video with lyrics',
      title: '(You Drive Me) Crazy',
      titleNorm: 'You Drive Me Crazy',
    },
  },
  {
    input: 'When You Say Nothing At All in the Style of \'Alison Krauss & Union Station\' (no lead vocal)',
    output: {
      artist: 'Alison Krauss & Union Station',
      artistNorm: 'Alison Krauss and Union Station',
      title: 'When You Say Nothing At All',
      titleNorm: 'When You Say Nothing At All',
    },
  },
  {
    input: 'Ain\'t Too Proud To Beg in the style of The Rolling Stones - karaoke video with lyrics',
    output: {
      artist: 'Rolling Stones - karaoke video with lyrics, The',
      artistNorm: 'Rolling Stones  karaoke video with lyrics',
      title: 'Ain\'t Too Proud To Beg',
      titleNorm: 'Aint Too Proud To Beg',
    },
  },
  {
    input: 'Hello Goodbye - The Beatles _ Karaoke with Lyrics',
    output: {
      artist: 'Hello Goodbye',
      artistNorm: 'Hello Goodbye',
      title: 'Beatles Karaoke with Lyrics, The',
      titleNorm: 'Beatles Karaoke with Lyrics',
    },
  },
  {
    input: 'Williamsndy - Speak Softly, Love (Godfather Theme) [Karaoke]',
    output: {
      artist: 'Williamsndy',
      artistNorm: 'Williamsndy',
      title: 'Speak Softly, Love (Godfather Theme)',
      titleNorm: 'Speak Softly Love Godfather Theme',
    },
  },
  {
    input: 'Craig McLachlan & Check 1-2 - Mona [ABC Karaoke]',
    output: {
      artist: 'Craig McLachlan & Check 1-2',
      artistNorm: 'Craig McLachlan and Check 12',
      title: 'Mona',
      titleNorm: 'Mona',
    },
  },
  {
    input: 'Blue (Eurovision 2011) - I Can [ABC Karaoke]',
    output: {
      artist: 'Blue (Eurovision 2011)',
      artistNorm: 'Blue Eurovision 2011',
      title: 'I Can',
      titleNorm: 'I Can',
    },
  },
  {
    input: 'Len Barry - 1-2-3 [Karaoke]',
    output: {
      artist: 'Len Barry',
      artistNorm: 'Len Barry',
      title: '1-2-3',
      titleNorm: '123',
    },
  },
  {
    input: 'AZ1234-01 - 10,000 Maniacs - Trouble Me',
    output: {
      artist: '10,000 Maniacs',
      artistNorm: '10000 Maniacs',
      title: 'Trouble Me',
      titleNorm: 'Trouble Me',
    },
  },
  {
    input: 'ABCD2-1-01 - Vanessa Carlton - A Thousand Miles',
    output: {
      artist: 'Vanessa Carlton',
      artistNorm: 'Vanessa Carlton',
      title: 'Thousand Miles, A',
      titleNorm: 'Thousand Miles',
    },
  },
  {
    input: '1 - Level42 - Something About You',
    output: {
      artist: 'Level42',
      artistNorm: 'Level42',
      title: 'Something About You',
      titleNorm: 'Something About You',
    },
  },
  {
    input: 'Az 1234-01 - Boney-M - Daddy Cool',
    output: {
      artist: 'Boney-M',
      artistNorm: 'BoneyM',
      title: 'Daddy Cool',
      titleNorm: 'Daddy Cool',
    },
  },
  {
    input: 'UB40 - Homely Girl',
    output: {
      artist: 'UB40',
      artistNorm: 'UB40',
      title: 'Homely Girl',
      titleNorm: 'Homely Girl',
    },
  },
  {
    input: 'Disney - 101 Dalmations - Cruella De Vil',
    output: {
      artist: 'Disney-101 Dalmations',
      artistNorm: 'Disney101 Dalmations',
      title: 'Cruella De Vil',
      titleNorm: 'Cruella De Vil',
    },
  },
  {
    input: 'ちゃんみな - 「ハレンチ」',
    output: {
      artist: 'ちゃんみな',
      artistNorm: 'ちゃんみな',
      title: '「ハレンチ」',
      titleNorm: 'ハレンチ',
    },
  },
  {
    input: 'ちゃんみな - 花火',
    output: {
      artist: 'ちゃんみな',
      artistNorm: 'ちゃんみな',
      title: '花火',
      titleNorm: '花火',
    },
  },
  // Regression test for upstream issue #53 (RTL/Hebrew filenames parse fine
  // as long as they use the "Artist - Title" delimiter).
  {
    input: 'שלמה ארצי - שיר ללא שם',
    output: {
      artist: 'שלמה ארצי',
      artistNorm: 'שלמה ארצי',
      title: 'שיר ללא שם',
      titleNorm: 'שיר ללא שם',
    },
  },
]
