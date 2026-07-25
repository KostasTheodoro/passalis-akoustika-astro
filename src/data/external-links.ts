/**
 * Links that leave the site. Provider websites live on their own content entries; this file
 * holds only the site-wide ones.
 */
export const EXTERNAL_LINKS = {
  /** Signia's companion app, promoted in the home page section. */
  signiaApp: {
    appStore: 'https://apps.apple.com/app/signia-app/id1440887920',
    googlePlay: 'https://play.google.com/store/apps/details?id=com.signia.rta',
  },

  /** Google Maps. `place` opens the listing; `embed` is the iframe on the contact page. */
  googleMaps: {
    place:
      'https://www.google.com/maps/place/%CE%A0%CE%91%CE%A3%CE%A3%CE%91%CE%9B%CE%97%CE%A3+%CE%97.+-+%CE%91%CE%9A%CE%9F%CE%A5%CE%A3%CE%A4%CE%99%CE%9A%CE%91+%CE%92%CE%91%CE%A1%CE%97%CE%9A%CE%9F%CE%8A%CE%91%CE%A3/@38.0483082,23.807228,17z/data=!3m1!4b1!4m6!3m5!1s0x14a19968f09ee0db:0x121536f50b8e6e2a!8m2!3d38.0483082!4d23.807228!16s%2Fg%2F11xdw04xv9',
    embed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3121.087441868825!2d23.80464681537398!3d38.04830817971486!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14a19968f09ee0db%3A0x121536f50b8e6e2a!2zzpHOtc67zqzOsM6xz4nOvyDigJggzprOkc6vzr_Ou867zqzOuc69IM6izpHOv8-BzrXOhM-BzrUgzpTOv8-Bzr3Okc6xz4nPhSDOkM6hIM6UzrjOtc67zq_Ou867!5e0!3m2!1sel!2sgr!4v1718802598390!5m2!1sel!2sgr',
    /** Accessible name for the embedded map iframe. */
    embedTitle: 'Χάρτης Πασσαλής Ακουστικά',
  },
} as const;
