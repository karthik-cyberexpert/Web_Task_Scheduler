export const wordPools: Record<string, string[]> = {
  people: ["John", "Sarah", "The teacher", "My friend", "The doctor", "A small boy", "A clever girl"],
  animals: ["cat", "dog", "bird", "rabbit", "lion", "elephant", "fish", "hamster"],
  places: ["park", "school", "library", "house", "forest", "beach", "city", "store"],
  emotions: ["happy", "sad", "excited", "brave", "tired", "calm", "proud"],
  actions: ["walks", "runs", "jumps", "reads", "writes", "eats", "sleeps", "plays", "thinks"],
  foods: ["apple", "bread", "cake", "pizza", "water", "milk", "fruit", "lunch"],
  family: ["mother", "father", "brother", "sister", "grandpa", "grandma"],
  objects: ["book", "ball", "pen", "desk", "tree", "flower", "car", "bicycle"],
  colors: ["red", "blue", "green", "yellow", "white", "black", "purple"],
  time: ["morning", "evening", "afternoon", "night", "today", "yesterday"]
};

export const connectors: string[] = ["and", "but", "so", "because", "while", "when"];

export const templates: Record<string, string[]> = {
  easy: [
    "{people} {actions} to the {places}.",
    "The {animals} is {emotions}.",
    "I like {foods} in the {time}.",
    "My {family} has a {objects}.",
    "The {objects} is {colors}."
  ],
  medium: [
    "{people} {actions} to the {places}, {connectors} it is very {emotions}.",
    "When the {animals} {actions}, the {family} feels {emotions}.",
    "The {colors} {objects} is in the {places} near the {objects}.",
    "My {family} likes to eat {foods} while they {actions} a {objects}."
  ],
  hard: [
    "\"Is the {colors} {objects} yours?\" asked the {people} from the {places}.",
    "The {animals}'s behavior was {emotions}; however, it enjoyed the {foods} at 12:30 PM.",
    "Actually, {people} and {family} went to the {places} to find 5 {colors} {objects}.",
    "It's true that the {animals} {actions} better than the {animals} when it's {time}."
  ]
};

const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

const fillTemplate = (template: string, struggleLetters: string[] = []) => {
  let filled = template;
  
  const keys = Object.keys(wordPools).concat(['connectors']);
  const combinedPools: Record<string, string[]> = { ...wordPools, connectors };

  keys.forEach(key => {
    const placeholder = `{${key}}`;
    while (filled.includes(placeholder)) {
      let pool = combinedPools[key];
      
      // If we have struggle letters, filter pool or prioritize
      if (struggleLetters.length > 0) {
        const priorityWords = pool.filter(word => 
          struggleLetters.some(letter => word.toLowerCase().includes(letter.toLowerCase()))
        );
        if (priorityWords.length > 0 && Math.random() > 0.3) {
          pool = priorityWords;
        }
      }

      const word = getRandom(pool);
      filled = filled.replace(placeholder, word);
    }
  });

  return filled;
};

export const generateParagraph = (difficulty: string = 'easy', count: number = 3, struggleLetters: string[] = []) => {
  const currentTemplates = templates[difficulty] || templates.easy;
  let paragraph = [];
  
  for (let i = 0; i < count; i++) {
    const template = getRandom(currentTemplates);
    paragraph.push(fillTemplate(template, struggleLetters));
  }

  return paragraph.join(' ');
};
