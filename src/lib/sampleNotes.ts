/**
 * Built-in sample note sets. Each is written for this app (original text,
 * under 600 words) so a new user can try QuizForge without typing notes.
 */

export interface SampleNotes {
  id: string;
  title: string;
  notes: string;
}

export const SAMPLE_NOTES: SampleNotes[] = [
  {
    id: 'photosynthesis',
    title: 'Photosynthesis',
    notes: `Photosynthesis is the process by which green plants, algae, and some bacteria turn light energy into chemical energy. It takes place mostly in the leaves of plants, inside tiny structures called chloroplasts. The green pigment chlorophyll, found in chloroplasts, absorbs sunlight — mostly blue and red light — and gives leaves their green colour.

The overall word equation is: carbon dioxide + water + light energy → glucose + oxygen. The balanced chemical equation is 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. Plants take in carbon dioxide from the air through small pores called stomata, and absorb water from the soil through their roots.

Photosynthesis happens in two stages. The first stage is the light-dependent reactions, which take place in the thylakoid membranes of the chloroplast. Light energy splits water molecules into hydrogen and oxygen. The oxygen is released into the air as a waste product. The energy from light is stored in two temporary energy carriers, ATP and NADPH.

The second stage is the Calvin cycle, also called the light-independent reactions, which takes place in the stroma, the fluid around the thylakoids. Carbon dioxide is fixed into an organic molecule using the ATP and NADPH made in the first stage. The cycle produces glucose, a sugar the plant can use for energy, growth, and to build other molecules such as starch and cellulose.

Several factors affect the rate of photosynthesis. Light intensity is one: more light usually means a faster rate, up to a point where the plant cannot use any more. Carbon dioxide concentration matters too — more CO2 generally speeds the process up. Temperature also matters, because the enzymes in the Calvin cycle work best in a certain range; too hot or too cold slows them down.

Photosynthesis is essential for almost all life on Earth. It produces the oxygen we breathe and forms the base of nearly every food chain, since plants are the producers that other organisms depend on. It also removes carbon dioxide from the atmosphere, which helps regulate the climate.`,
  },
  {
    id: 'indonesian-independence',
    title: "Indonesia's Independence — 17 August 1945",
    notes: `On 17 August 1945, Indonesia proclaimed its independence from colonial rule. The proclamation was read by Sukarno, who became the first president, together with Mohammad Hatta, the first vice president. The short text declared: "We, the people of Indonesia, hereby declare the independence of Indonesia."

The road to independence was long. The Dutch had ruled the archipelago for more than three centuries. During the Second World War, Japan occupied Indonesia from 1942 to 1945. As the war turned against Japan, the Japanese allowed Indonesian leaders to prepare for independence. In 1945 a committee called BPUPKI was formed to discuss the foundations of the new state, including the Pancasila, the five principles proposed by Sukarno.

After Japan surrendered on 15 August 1945, young activists, known as the pemuda, urged Sukarno and Hatta to declare independence immediately, without waiting for the Japanese. On the night of 16 August, the two leaders were taken to Rengasdengklok, a small town east of Jakarta, by the pemuda to pressure them to act. They returned to Jakarta that night, and the text of the proclamation was drafted at the house of Admiral Maeda, a Japanese naval officer sympathetic to the Indonesian cause.

The proclamation was read at Sukarno's house on Jalan Pegangsaan Timur 56 in Jakarta at 10:00 in the morning on 17 August 1945, before a small crowd. The red-and-white flag was raised, and the news spread quickly by radio and by word of mouth across the islands.

Independence did not come without a struggle. The Dutch tried to return and reimpose colonial rule, leading to the Indonesian National Revolution, a four-year war of independence from 1945 to 1949. Indonesian diplomats also worked abroad to win international recognition. The Netherlands finally recognised Indonesian sovereignty on 27 December 1949.

Today, 17 August is celebrated every year as Indonesia's Independence Day, with flag-raising ceremonies, parades, and traditional games across the country.`,
  },
];

/**
 * A small built-in deck used by "Try the sample deck" so the study and quiz
 * UI can be explored even before a Firebase project is configured. This data
 * is hand-written sample content — it is NOT AI-generated, and the UI labels
 * it as such.
 */
export const SAMPLE_DECK = {
  title: 'Photosynthesis — sample deck',
  flashcards: [
    {
      front: 'What is the overall word equation for photosynthesis?',
      back: 'Carbon dioxide + water + light energy → glucose + oxygen.',
    },
    {
      front: 'Where in the plant cell does photosynthesis take place?',
      back: 'In the chloroplasts — the light-dependent reactions in the thylakoid membranes, and the Calvin cycle in the stroma.',
    },
    {
      front: 'What pigment absorbs sunlight, and what colour does it give leaves?',
      back: 'Chlorophyll. It absorbs mostly blue and red light and gives leaves their green colour.',
    },
    {
      front: 'What are the products of the light-dependent reactions?',
      back: 'Oxygen (released from splitting water), ATP, and NADPH — the energy carriers used by the Calvin cycle.',
    },
  ],
  quiz: {
    title: 'Photosynthesis — sample quiz',
    questions: [
      {
        question: 'Which gas do plants take in from the air for photosynthesis?',
        options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
        answerIndex: 1,
        explanation:
          'Plants take in carbon dioxide through small pores called stomata, and fix it into glucose in the Calvin cycle.',
      },
      {
        question: 'Where does the Calvin cycle take place?',
        options: [
          'In the thylakoid membranes',
          'In the mitochondria',
          'In the stroma of the chloroplast',
          'In the nucleus',
        ],
        answerIndex: 2,
        explanation:
          'The Calvin cycle (light-independent reactions) happens in the stroma, the fluid around the thylakoids.',
      },
      {
        question: 'Why is photosynthesis essential for life on Earth?',
        options: [
          'It produces oxygen and forms the base of nearly every food chain',
          'It makes soil more acidic',
          'It cools the oceans directly',
          'It creates nitrogen gas',
        ],
        answerIndex: 0,
        explanation:
          'Photosynthesis produces the oxygen we breathe and plants are the producers that almost all food chains depend on.',
      },
    ],
  },
};
