import type { MetadataRoute } from "next";

/**
 * PWA-маніфест. Дає встановлення на домашній екран — для учня, який
 * заходить перевірити домашнє завдання чи час наступного уроку, це
 * природний спосіб користування.
 *
 * `start_url` веде на каталог, а не на головну: для гостя це початок
 * шляху, а для того, хто вже увійшов, `AuthGate` однаково перекине
 * в його кабінет.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mentora — маркетплейс репетиторства",
    short_name: "Mentora",
    description:
      "Знайдіть репетитора, бронюйте уроки й відстежуйте прогрес — для учнів, репетиторів і батьків.",
    lang: "uk",
    start_url: "/catalog",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8EA",
    theme_color: "#451010",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Окрема maskable: система обрізає іконку під свою форму, і без
      // безпечної зони по краях літера втратила б частину.
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
