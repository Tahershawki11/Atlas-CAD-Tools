export function Blueprint({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "blueprint small" : "blueprint"}
      viewBox="0 0 280 180"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1">
        <path d="M40 28H235V150H40z M44 32H231V146H44z M125 32V87H231 M125 92V146 M44 95H88 M88 95V146 M177 87V146 M177 120H231" />
        <path
          d="M89 95v-30a30 30 0 0 0-30 30 M125 91h-26a26 26 0 0 1 26-26 M178 120v-24a24 24 0 0 1 24 24"
          strokeOpacity=".6"
        />
        <path
          d="M40 12H235 M40 7v12 M235 7v12 M22 28v122 M17 28h10 M17 150h10 M45 163h185 M45 158v10 M230 158v10"
          strokeOpacity=".45"
        />
        <path d="M207 120v26 M213 120v26 M219 120v26 M225 120v26 M35 24h-8 M35 155h-8" />
        <circle cx="258" cy="84" r="7" />
        <path d="M244 84h28 M258 70v28" />
      </g>
    </svg>
  );
}
