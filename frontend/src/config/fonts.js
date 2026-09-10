// Lista curada de tipografías (todas de Google Fonts, para no depender de
// archivos propios). El admin elige una para títulos y otra para texto
// desde "Generales"; useFonts() se encarga de cargar el <link> y setear
// las variables CSS --font-heading/--font-body.
export const HEADING_FONTS = [
  { id: 'syne', label: 'Syne (por defecto)', family: "'Syne', sans-serif", google: 'Syne:wght@600;700;800' },
  { id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", google: 'Poppins:wght@600;700;800' },
  { id: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif", google: 'Playfair+Display:wght@600;700;800' },
  { id: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif", google: 'Montserrat:wght@600;700;800' },
  { id: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif", google: 'Raleway:wght@600;700;800' },
];

export const BODY_FONTS = [
  { id: 'inter', label: 'Inter (por defecto)', family: "'Inter', sans-serif", google: 'Inter:wght@400;500;600;700' },
  { id: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif", google: 'Roboto:wght@400;500;700' },
  { id: 'lato', label: 'Lato', family: "'Lato', sans-serif", google: 'Lato:wght@400;700' },
  { id: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif", google: 'Merriweather:wght@400;700' },
  { id: 'sourcesans', label: 'Source Sans 3', family: "'Source Sans 3', sans-serif", google: 'Source+Sans+3:wght@400;500;600;700' },
];

export function findHeadingFont(id) {
  return HEADING_FONTS.find((f) => f.id === id) || HEADING_FONTS[0];
}

export function findBodyFont(id) {
  return BODY_FONTS.find((f) => f.id === id) || BODY_FONTS[0];
}
