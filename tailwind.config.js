/** @type {import('tailwindcss').Config} */
const { join } = require('path')

// Les variables ne portent que les composantes oklch : on reconstruit la
// fonction ici pour que Tailwind puisse y glisser `<alpha-value>` et garder
// les modificateurs d'opacité (`bg-destructive/10`).
const teinte = (nom) => `oklch(var(--${nom}) / <alpha-value>)`

module.exports = {
  darkMode: ['class'],
  // Chemin absolu : Tailwind résout les motifs relatifs depuis le dossier
  // d'où la commande est lancée, et ne trouvait plus rien dès qu'on
  // construisait depuis le dossier parent.
  content: [join(__dirname, 'src/renderer/**/*.{ts,tsx,html}')],
  theme: {
    extend: {
      colors: {
        border: teinte('border'),
        input: teinte('input'),
        ring: teinte('ring'),
        background: teinte('background'),
        foreground: teinte('foreground'),
        positive: teinte('positive'),
        primary: {
          DEFAULT: teinte('primary'),
          foreground: teinte('primary-foreground')
        },
        secondary: {
          DEFAULT: teinte('secondary'),
          foreground: teinte('secondary-foreground')
        },
        destructive: {
          DEFAULT: teinte('destructive'),
          foreground: teinte('destructive-foreground')
        },
        muted: {
          DEFAULT: teinte('muted'),
          foreground: teinte('muted-foreground')
        },
        accent: {
          DEFAULT: teinte('accent'),
          foreground: teinte('accent-foreground')
        },
        card: {
          DEFAULT: teinte('card'),
          foreground: teinte('card-foreground')
        },
        // Surfaces de l'application : voir la note dans globals.css.
        shell: {
          DEFAULT: teinte('shell'),
          raised: teinte('shell-raised'),
          border: teinte('shell-border'),
          foreground: teinte('shell-foreground'),
          muted: teinte('shell-muted')
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)'
      },
      keyframes: {
        // Halo qui s'échappe du micro pendant l'enregistrement.
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(2.4)', opacity: '0' }
        },
        // Attente : une bande claire qui traverse le texte, plus discrète
        // qu'un clignotement.
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' }
        }
      },
      animation: {
        ripple: 'ripple 1.6s ease-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up 160ms ease-out'
      }
    }
  },
  plugins: []
}
