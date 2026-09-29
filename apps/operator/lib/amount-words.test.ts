import { describe, expect, it } from "vitest";
import { amountInWords, bgNumberWords } from "./amount-words";

describe("amountInWords — Bulgarian, as an invoice writes it", () => {
  it.each([
    [10000, "Сто евро"],
    [100, "Едно евро"],
    [200, "Две евро"],
    [12500, "Сто двадесет и пет евро"],
    [10500, "Сто и пет евро"],
    [12000, "Сто и двадесет евро"],
    [110000, "Хиляда и сто евро"],
    [221000, "Две хиляди двеста и десет евро"],
    [2100000, "Двадесет и една хиляди евро"],
    [25030, "Двеста и петдесет евро и тридесет цента"],
    [101, "Едно евро и един цент"],
    [102, "Едно евро и два цента"],
  ])("%i → %s", (minor, words) => {
    expect(amountInWords(minor, "EUR", "bg")).toBe(words);
  });

  it("puts leva and stotinki in their own genders", () => {
    expect(amountInWords(20102, "BGN", "bg")).toBe("Двеста и един лева и две стотинки");
  });

  it("writes millions", () => {
    expect(bgNumberWords(2_000_001, "n")).toBe("два милиона и едно");
  });
});

describe("amountInWords — English", () => {
  it.each([
    [10000, "One hundred euros"],
    [12505, "One hundred and twenty-five euros and five cents"],
    [100100, "One thousand and one euros"],
  ])("%i → %s", (minor, words) => {
    expect(amountInWords(minor, "EUR", "en")).toBe(words);
  });
});
