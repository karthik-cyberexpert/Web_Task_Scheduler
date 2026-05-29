export interface RegexTestCase {
  text: string;
  shouldMatch: boolean;
}

export interface RegexQuestion {
  id: string;
  description: string;
  answer: string;
  options: string[];
  testCases: RegexTestCase[];
  explanation: string;
}

const easyQuestions: RegexQuestion[] = [
  {
    id: "zip_code",
    description: "Match a standard 5-digit US ZIP Code (exactly five numeric digits).",
    answer: "^\\d{5}$",
    options: ["^\\d{5}$", "^\\d{5}-\\d{4}$", "^\\d+$", "^[0-9]{4,6}$"],
    testCases: [
      { text: "90210", shouldMatch: true },
      { text: "12345", shouldMatch: true },
      { text: "1234", shouldMatch: false },
      { text: "90210-1234", shouldMatch: false },
      { text: "abcde", shouldMatch: false }
    ],
    explanation: "\\d{5} matches exactly 5 digits, and anchors ^ and $ ensure the string has no other characters."
  },
  {
    id: "binary_string",
    description: "Match any valid binary string (containing only '0' and '1' characters, at least one character long).",
    answer: "^[01]+$",
    options: ["^[01]+$", "^[01]*$", "^[0-9]+$", "^[12]+$"],
    testCases: [
      { text: "10101", shouldMatch: true },
      { text: "0", shouldMatch: true },
      { text: "10201", shouldMatch: false },
      { text: "", shouldMatch: false },
      { text: "0101a", shouldMatch: false }
    ],
    explanation: "[01]+ matches one or more repetitions of 0 or 1. The * quantifier would incorrectly match empty strings."
  },
  {
    id: "hex_color",
    description: "Match a valid Hex Color starting with '#' containing exactly 3 or 6 hex characters.",
    answer: "^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$",
    options: [
      "^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$",
      "^#[A-Za-z0-9]{3,6}$",
      "^#[0-9]{3,6}$",
      "^#([0-9a-f]{3}){1,2}$"
    ],
    testCases: [
      { text: "#FFF", shouldMatch: true },
      { text: "#a3c1ad", shouldMatch: true },
      { text: "FFF", shouldMatch: false },
      { text: "#GG0011", shouldMatch: false },
      { text: "#12345", shouldMatch: false }
    ],
    explanation: "([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}) matches either a 3-character hex sequence or a 6-character hex sequence."
  },
  {
    id: "positive_number",
    description: "Match positive integers including '0', with no leading zeros (e.g. '0' is valid, '42' is valid, '07' is invalid).",
    answer: "^(0|[1-9][0-9]*)$",
    options: ["^(0|[1-9][0-9]*)$", "^[0-9]+$", "^[1-9][0-9]*$", "^0[0-9]+$"],
    testCases: [
      { text: "42", shouldMatch: true },
      { text: "0", shouldMatch: true },
      { text: "07", shouldMatch: false },
      { text: "-5", shouldMatch: false },
      { text: "100", shouldMatch: true }
    ],
    explanation: "This matches either a single '0' OR a non-zero digit [1-9] followed by any number of digits [0-9]*."
  }
];

const mediumQuestions: RegexQuestion[] = [
  {
    id: "js_var",
    description: "Match valid JS variable names (starts with a letter, '_', or '$', followed by alphanumeric characters, '_', or '$').",
    answer: "^[a-zA-Z_$][a-zA-Z0-9_$]*$",
    options: [
      "^[a-zA-Z_$][a-zA-Z0-9_$]*$",
      "^[a-z][a-z0-9]*$",
      "^[a-zA-Z0-9_$]+$",
      "^[^0-9][a-zA-Z0-9]*$"
    ],
    testCases: [
      { text: "myVar", shouldMatch: true },
      { text: "_temp", shouldMatch: true },
      { text: "$price", shouldMatch: true },
      { text: "2count", shouldMatch: false },
      { text: "user-name", shouldMatch: false }
    ],
    explanation: "[a-zA-Z_$] ensures it starts with an allowed symbol. [a-zA-Z0-9_$]* matches optional remaining alphanumeric characters."
  },
  {
    id: "time_24",
    description: "Match valid 24-hour time format (HH:MM) from '00:00' to '23:59'.",
    answer: "^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$",
    options: [
      "^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$",
      "^[0-2][0-9]:[0-5][0-9]$",
      "^\\d{2}:\\d{2}$",
      "^(1[0-2]|[0-9]):[0-5][0-9]$"
    ],
    testCases: [
      { text: "14:30", shouldMatch: true },
      { text: "09:15", shouldMatch: true },
      { text: "23:59", shouldMatch: true },
      { text: "24:00", shouldMatch: false },
      { text: "13:60", shouldMatch: false }
    ],
    explanation: "(0[0-9]|1[0-9]|2[0-3]) ensures the hour portion is 00-23. :[0-5][0-9] ensures the minutes portion is 00-59."
  },
  {
    id: "date_dash",
    description: "Match YYYY-MM-DD format (validates 4-digit year, 01-12 month, and 01-31 day).",
    answer: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
    options: [
      "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
      "^\\d{4}-\\d{2}-\\d{2}$",
      "^\\d{4}-(1[0-2])-(3[01])$",
      "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
    ],
    testCases: [
      { text: "2026-05-29", shouldMatch: true },
      { text: "1999-12-31", shouldMatch: true },
      { text: "2024-13-01", shouldMatch: false },
      { text: "2023-02-32", shouldMatch: false },
      { text: "202-05-29", shouldMatch: false }
    ],
    explanation: "\\d{4} matches the year. (0[1-9]|1[0-2]) matches months 01-12. (0[1-9]|[12][0-9]|3[01]) matches days 01-31."
  },
  {
    id: "username_chars",
    description: "Match allowed characters in an email username (letters, numbers, '.', '_', '%', '+', or '-').",
    answer: "^[a-zA-Z0-9._%+-]+$",
    options: [
      "^[a-zA-Z0-9._%+-]+$",
      "^[a-z.]+$",
      "^\\w+$",
      "^[a-zA-Z0-9]+$"
    ],
    testCases: [
      { text: "john.doe", shouldMatch: true },
      { text: "alice_smith123", shouldMatch: true },
      { text: "user-name", shouldMatch: true },
      { text: "john@doe", shouldMatch: false },
      { text: "user$", shouldMatch: false }
    ],
    explanation: "The character class [a-zA-Z0-9._%+-]+ matches one or more characters allowed in typical email usernames."
  }
];

const hardQuestions: RegexQuestion[] = [
  {
    id: "ipv4",
    description: "Match valid IPv4 addresses (four decimal octets separated by dots, each octet in range 0-255).",
    answer: "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
    options: [
      "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
      "^(\\d{1,3}\\.){3}\\d{1,3}$",
      "^([0-255]\\.){3}[0-255]$",
      "^((2[0-5]{2}|1\\d{2}|\\d{1,2})\\.){3}(2[0-5]{2}|1\\d{2}|\\d{1,2})$"
    ],
    testCases: [
      { text: "192.168.1.1", shouldMatch: true },
      { text: "255.255.255.255", shouldMatch: true },
      { text: "8.8.8.8", shouldMatch: true },
      { text: "256.0.0.1", shouldMatch: false },
      { text: "192.168.1", shouldMatch: false }
    ],
    explanation: "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?) correctly matches digits from 0 to 255. Other regexes allow digits > 255."
  },
  {
    id: "url_basic",
    description: "Match web URLs starting with http:// or https:// with a valid top-level domain extension.",
    answer: "^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)$",
    options: [
      "^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)$",
      "^https?:\\/\\/www\\.\\w+\\.\\w+$",
      "^(http|https):\\/\\/[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$",
      "^www\\.\\w+\\.com$"
    ],
    testCases: [
      { text: "https://google.com", shouldMatch: true },
      { text: "http://sub.domain.co/path?query=1", shouldMatch: true },
      { text: "google.com", shouldMatch: false },
      { text: "ftp://server.com", shouldMatch: false },
      { text: "http://google", shouldMatch: false }
    ],
    explanation: "This matches http or https, optional www, valid domain characters, a dot, TLD, and optional path query parameters."
  },
  {
    id: "float_dec",
    description: "Match floating-point numbers (contains optional +/- sign, integer part, decimal point, and fractional part).",
    answer: "^[+-]?(0|[1-9][0-9]*)\\.[0-9]+$",
    options: [
      "^[+-]?(0|[1-9][0-9]*)\\.[0-9]+$",
      "^[+-]?[0-9]*\\.[0-9]*$",
      "^[+-]?\\d+\\.\\d*$",
      "^[0-9]+\\.[0-9]+$"
    ],
    testCases: [
      { text: "3.14", shouldMatch: true },
      { text: "-0.001", shouldMatch: true },
      { text: "+42.0", shouldMatch: true },
      { text: "42", shouldMatch: false },
      { text: ".5", shouldMatch: false }
    ],
    explanation: "[+-]? is the optional sign. (0|[1-9][0-9]*) prevents leading zeros. \\. is the decimal point. [0-9]+ matches the fraction."
  },
  {
    id: "password_comp",
    description: "Match password: at least 1 lowercase letter, 1 uppercase letter, 1 number, and minimum length of 8 characters.",
    answer: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$",
    options: [
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$",
      "^[a-zA-Z0-9]{8,}$",
      "^(?=.*[a-z])(?=.*[A-Z]).{8,}$",
      "^(?=.*[A-Z])(?=.*\\d).{8,}$"
    ],
    testCases: [
      { text: "Secret12", shouldMatch: true },
      { text: "aB345678", shouldMatch: true },
      { text: "secret12", shouldMatch: false },
      { text: "SECRET12", shouldMatch: false },
      { text: "Sec12", shouldMatch: false }
    ],
    explanation: "The positive lookaheads (?=.*[a-z]), (?=.*[A-Z]), and (?=.*\\d) enforce the characters. .{8,} sets the minimum length."
  }
];

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateRegexQuestion(
  difficulty: "easy" | "medium" | "hard",
  excludeIds: string[] = []
): RegexQuestion {
  let pool = easyQuestions;
  if (difficulty === "medium") pool = mediumQuestions;
  if (difficulty === "hard") pool = hardQuestions;

  let available = pool.filter((q) => !excludeIds.includes(q.id));
  if (available.length === 0) {
    available = pool;
  }

  const question = available[Math.floor(Math.random() * available.length)];
  const options = shuffleArray([...question.options]);

  return {
    ...question,
    options
  };
}
