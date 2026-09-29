/**
 * An amount written out — "Словом: Сто евро" — as a Bulgarian invoice carries it, and the English
 * equivalent for an English one.
 *
 * Bulgarian agrees in gender: евро is neuter (едно евро, две евро), цент and лев are masculine
 * (един цент, два цента; един лев, два лева), хиляда is feminine (една хиляда → "хиляда", две хиляди).
 * The conjunction "и" joins the LAST two elements — "сто двадесет и пет", "сто и пет",
 * "хиляда и сто", "две хиляди двеста и десет".
 */

type Gender = "m" | "f" | "n";

const ONES: Record<Gender, string[]> = {
  m: ["", "един", "два", "три", "четири", "пет", "шест", "седем", "осем", "девет"],
  f: ["", "една", "две", "три", "четири", "пет", "шест", "седем", "осем", "девет"],
  n: ["", "едно", "две", "три", "четири", "пет", "шест", "седем", "осем", "девет"],
};
const TEENS = ["десет", "единадесет", "дванадесет", "тринадесет", "четиринадесет", "петнадесет", "шестнадесет", "седемнадесет", "осемнадесет", "деветнадесет"];
const TENS = ["", "", "двадесет", "тридесет", "четиридесет", "петдесет", "шестдесет", "седемдесет", "осемдесет", "деветдесет"];
const HUNDREDS = ["", "сто", "двеста", "триста", "четиристотин", "петстотин", "шестстотин", "седемстотин", "осемстотин", "деветстотин"];

/** 1–999 as a list of words, without the joining "и". */
function triple(n: number, g: Gender): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) out.push(TEENS[rest - 10]!);
  else {
    if (rest >= 20) out.push(TENS[Math.floor(rest / 10)]!);
    if (rest % 10) out.push(ONES[g][rest % 10]!);
  }
  return out;
}

/** "и" before the last word of a group of two or more. */
function joinAnd(words: string[]): string {
  if (words.length < 2) return words.join(" ");
  return `${words.slice(0, -1).join(" ")} и ${words[words.length - 1]}`;
}

export function bgNumberWords(n: number, g: Gender): string {
  if (n === 0) return "нула";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "един милион" : `${joinAnd(triple(millions, "m"))} милиона`);
  if (thousands) parts.push(thousands === 1 ? "хиляда" : `${joinAnd(triple(thousands, "f"))} хиляди`);
  if (rest) {
    const w = triple(rest, g);
    // A lone word after a larger group takes the "и": "хиляда и сто", "две хиляди и двадесет".
    if (parts.length && w.length === 1) parts.push(`и ${w[0]}`);
    else parts.push(joinAnd(w));
  }
  return parts.join(" ");
}

const ONES_EN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS_EN = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES_EN[r]! : `${TENS_EN[Math.floor(r / 10)]}${r % 10 ? `-${ONES_EN[r % 10]}` : ""}`;
  return [h ? `${ONES_EN[h]} hundred` : "", h && r ? "and" : "", rest].filter(Boolean).join(" ");
}
export function enNumberWords(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const m = Math.floor(n / 1_000_000), t = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
  if (m) parts.push(`${enBelow1000(m)} million`);
  if (t) parts.push(`${enBelow1000(t)} thousand`);
  if (r) parts.push(r < 100 && parts.length ? `and ${enBelow1000(r)}` : enBelow1000(r));
  return parts.join(" ");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Сто евро", "Двеста и петдесет евро и 30 цента", "One hundred euros and 5 cents".
 * Currencies without a written form fall back to the figure and code, which is still unambiguous.
 */
export function amountInWords(minor: number, currency: string, lang: "bg" | "en"): string {
  const whole = Math.floor(Math.abs(minor) / 100);
  const cents = Math.abs(minor) % 100;
  const c = currency.toUpperCase();
  if (lang === "bg") {
    const unit = c === "EUR" ? { g: "n" as Gender, one: "евро", many: "евро", sub: "цент", subs: "цента" }
      : c === "BGN" ? { g: "m" as Gender, one: "лев", many: "лева", sub: "стотинка", subs: "стотинки" }
      : null;
    if (!unit) return `${(Math.abs(minor) / 100).toFixed(2)} ${c}`;
    const main = `${bgNumberWords(whole, unit.g)} ${whole === 1 ? unit.one : unit.many}`;
    if (!cents) return cap(main);
    const subGender: Gender = c === "BGN" ? "f" : "m";
    return cap(`${main} и ${bgNumberWords(cents, subGender)} ${cents === 1 ? unit.sub : unit.subs}`);
  }
  const unit = c === "EUR" ? ["euro", "euros", "cent", "cents"] : c === "BGN" ? ["lev", "leva", "stotinka", "stotinki"] : null;
  if (!unit) return `${(Math.abs(minor) / 100).toFixed(2)} ${c}`;
  const main = `${enNumberWords(whole)} ${whole === 1 ? unit[0] : unit[1]}`;
  return cap(cents ? `${main} and ${enNumberWords(cents)} ${cents === 1 ? unit[2] : unit[3]}` : main);
}
