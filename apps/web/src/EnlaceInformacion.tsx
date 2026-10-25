export function EnlaceInformacion({ nuevaPestana = false }: { nuevaPestana?: boolean }) {
  return (
    <a
      href="/informacion"
      target={nuevaPestana ? '_blank' : undefined}
      rel={nuevaPestana ? 'noopener noreferrer' : undefined}
      className="inline-flex min-h-11 items-center font-medium text-cruz underline"
    >
      Privacidad y fuentes
    </a>
  );
}
