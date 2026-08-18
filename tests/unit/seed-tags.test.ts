import { describe, expect, it } from "vitest";
import { buildFilterTags, cityKeyOf } from "@/lib/catalog-tags";
// @ts-expect-error — демо-скрипт навмисно на чистому JS, без типів
import * as seed from "../../scripts/seed-demo.mjs";

/**
 * `scripts/seed-demo.mjs` дублює побудову тегів каталогу: скрипт має
 * запускатися звичайним node, без збірки й аліасів шляхів, тому імпортувати
 * `lib/catalog.ts` він не може.
 *
 * Дублювання саме по собі не страшне — страшно, коли копія тихо
 * розходиться з оригіналом і демо-дані перестають знаходитись фільтрами.
 * Цей тест і є тим запобіжником.
 */

const PROFILES = [
  {
    languages: ["Іспанська", "Англійська"] as const,
    levelsTaught: ["A2", "B1", "B2"] as const,
    format: "both" as const,
  },
  {
    languages: ["Англійська"] as const,
    levelsTaught: ["C1"] as const,
    format: "online" as const,
  },
  {
    languages: ["Польська"] as const,
    levelsTaught: ["A1", "A2"] as const,
    format: "offline" as const,
  },
];

describe("теги демо-скрипта збігаються з каталогом", () => {
  it.each(PROFILES)("профіль %#", (profile) => {
    expect(seed.buildFilterTags(profile)).toEqual(
      buildFilterTags({
        languages: [...profile.languages],
        levelsTaught: [...profile.levelsTaught],
        format: profile.format,
      })
    );
  });

  it("нормалізація міста однакова", () => {
    for (const city of [" Львів ", "КИЇВ", "Івано  Франківськ", "", undefined]) {
      expect(seed.cityKeyOf(city)).toBe(cityKeyOf(city));
    }
  });
});
