interface OddOneOutTemplate {
  category: string;
  items: string[];
  oddOne: string;
  explanation: string;
}

const easyTemplates: OddOneOutTemplate[] = [
  {
    category: "Fruits",
    items: ["Apple", "Banana", "Orange"],
    oddOne: "Carrot",
    explanation: "Carrot is a vegetable, while the others are fruits."
  },
  {
    category: "Colors",
    items: ["Red", "Blue", "Green"],
    oddOne: "Triangle",
    explanation: "Triangle is a geometric shape, while the others are colors."
  },
  {
    category: "House Pets",
    items: ["Dog", "Cat", "Rabbit"],
    oddOne: "Truck",
    explanation: "Truck is a vehicle, while the others are common household pets."
  },
  {
    category: "Oceans",
    items: ["Pacific", "Atlantic", "Indian"],
    oddOne: "Nile",
    explanation: "Nile is a river, while the others are global oceans."
  },
  {
    category: "Continents",
    items: ["Asia", "Europe", "Africa"],
    oddOne: "London",
    explanation: "London is a city, while the others are major continents."
  }
];

const mediumTemplates: OddOneOutTemplate[] = [
  {
    category: "Programming Languages",
    items: ["Python", "Java", "C++"],
    oddOne: "HTML",
    explanation: "HTML is a markup language used for document structure, not a general programming language."
  },
  {
    category: "Databases",
    items: ["MySQL", "PostgreSQL", "MongoDB"],
    oddOne: "React",
    explanation: "React is a UI frontend library, while the others are database management systems."
  },
  {
    category: "Operating Systems",
    items: ["Windows", "macOS", "Linux"],
    oddOne: "Chrome",
    explanation: "Chrome is a web browser, while the others are computer operating systems."
  },
  {
    category: "Mammals",
    items: ["Dolphin", "Whale", "Bat"],
    oddOne: "Eagle",
    explanation: "Eagle is a bird (oviparous), while the others are mammals (viviparous)."
  },
  {
    category: "Chemical Elements",
    items: ["Oxygen", "Hydrogen", "Nitrogen"],
    oddOne: "Water",
    explanation: "Water is a chemical compound (H2O), while the others are pure elemental gases."
  }
];

const hardTemplates: OddOneOutTemplate[] = [
  {
    category: "Network Protocols",
    items: ["HTTP", "WebSocket", "FTP"],
    oddOne: "JSON",
    explanation: "JSON is a structured data interchange format, while the others are network communication protocols."
  },
  {
    category: "Cryptographic Algorithms",
    items: ["AES", "RSA", "Blowfish"],
    oddOne: "SHA-256",
    explanation: "SHA-256 is a one-way hashing function, while the others are reversible cryptographic encryption algorithms."
  },
  {
    category: "Nobel Prize Fields",
    items: ["Physics", "Chemistry", "Medicine"],
    oddOne: "Mathematics",
    explanation: "There is no Nobel Prize awarded for Mathematics."
  },
  {
    category: "Greek Mythology Gods",
    items: ["Zeus", "Poseidon", "Hades"],
    oddOne: "Odin",
    explanation: "Odin is a Norse god, while the others belong to Greek mythology."
  },
  {
    category: "Chess Openings",
    items: ["Sicilian Defense", "Ruy Lopez", "Queen's Gambit"],
    oddOne: "En Passant",
    explanation: "En Passant is a special pawn capturing chess rule, not an opening setup sequence."
  }
];

const topics = [
  { name: "Fruits", query: "fruit" },
  { name: "Vegetables", query: "vegetable" },
  { name: "Colors", query: "color" },
  { name: "Geometric Shapes", query: "shape" },
  { name: "Oceans", query: "ocean" },
  { name: "Continents", query: "continent" },
  { name: "Furniture", query: "furniture" },
  { name: "Birds", query: "bird" },
  { name: "Mammals", query: "mammal" },
  { name: "Insects", query: "insect" },
  { name: "Programming Languages", query: "programming+language" },
  { name: "Operating Systems", query: "operating+system" },
  { name: "Musical Instruments", query: "musical+instrument" },
  { name: "Planets", query: "planet" },
  { name: "Vehicles", query: "vehicle" },
  { name: "Sports", query: "sport" },
  { name: "Clothing Items", query: "clothing" },
  { name: "Kitchen Utensils", query: "kitchen+utensil" },
  { name: "Chemical Elements", query: "chemical+element" },
  { name: "Capitals", query: "capital+city" },
  { name: "Office Supplies", query: "office+supply" },
  { name: "Tools", query: "tool" },
  { name: "Card Games", query: "card+game" },
  { name: "Board Games", query: "board+game" },
  { name: "Weather Terms", query: "weather" },
  { name: "Trees", query: "tree" },
  { name: "Flowers", query: "flower" },
  { name: "Desserts", query: "dessert" }
];

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function capitalizeFirstLetter(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface OddOneOutQuestion {
  category: string;
  options: string[];
  answer: string;
  explanation: string;
}

// Fallback offline generator
export function generateOddOneOutQuestionOffline(
  difficulty: "easy" | "medium" | "hard",
  excludeAnswers: string[] = []
): OddOneOutQuestion {
  let pool = easyTemplates;
  if (difficulty === "medium") pool = mediumTemplates;
  if (difficulty === "hard") pool = hardTemplates;

  let available = pool.filter((t) => !excludeAnswers.includes(t.oddOne));
  if (available.length === 0) {
    available = pool;
  }

  const template = available[Math.floor(Math.random() * available.length)];
  const options = shuffleArray([...template.items, template.oddOne]);

  return {
    category: template.category,
    options,
    answer: template.oddOne,
    explanation: template.explanation
  };
}

// Main online generator fetching related words from Datamuse API
export async function generateOddOneOutQuestion(
  difficulty: "easy" | "medium" | "hard",
  excludeAnswers: string[] = []
): Promise<OddOneOutQuestion> {
  try {
    const topicAIndex = Math.floor(Math.random() * topics.length);
    let topicBIndex = Math.floor(Math.random() * topics.length);
    while (topicBIndex === topicAIndex) {
      topicBIndex = Math.floor(Math.random() * topics.length);
    }
    
    const topicA = topics[topicAIndex];
    const topicB = topics[topicBIndex];
    
    const [resA, resB] = await Promise.all([
      fetch(`https://api.datamuse.com/words?ml=${topicA.query}&max=30`).then((r) => r.json()),
      fetch(`https://api.datamuse.com/words?ml=${topicB.query}&max=30`).then((r) => r.json())
    ]);
    
    const wordsA = (resA as any[]).map((w: any) => w.word as string).filter((w: string) => w.length > 2 && !w.includes(" ") && !w.includes("-"));
    const wordsB = (resB as any[]).map((w: any) => w.word as string).filter((w: string) => w.length > 2 && !w.includes(" ") && !w.includes("-") && !wordsA.includes(w));
    
    if (wordsA.length < 3 || wordsB.length < 1) {
      throw new Error("Insufficient words returned from API");
    }
    
    const chosenA = shuffleArray(wordsA).slice(0, 3).map((w: string) => capitalizeFirstLetter(w));
    
    // Choose oddOne, avoiding excludeAnswers if possible
    let oddOneCandidates = wordsB.map((w: string) => capitalizeFirstLetter(w));
    let oddOne = oddOneCandidates[0];
    for (const cand of oddOneCandidates) {
      if (!excludeAnswers.includes(cand)) {
        oddOne = cand;
        break;
      }
    }
    
    const options = shuffleArray([...chosenA, oddOne]);
    
    return {
      category: topicA.name,
      options,
      answer: oddOne,
      explanation: `${oddOne} is a member of the ${topicB.name.toLowerCase()} group, whereas the other options belong to the ${topicA.name.toLowerCase()} group.`
    };
  } catch (err) {
    console.warn("Datamuse API failed, falling back to offline database:", err);
    return generateOddOneOutQuestionOffline(difficulty, excludeAnswers);
  }
}
