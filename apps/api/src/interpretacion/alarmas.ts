import { DerivacionConsulta, type AlarmaConsulta } from '@rebotica/shared';

/** No se intenta descartar negaciones, citas o instrucciones: una mención activa el bloqueo.
 * Es un primer filtro conservador, no un triaje clínico completo. */
export function normalizarAlarma(texto: string): string {
  const digitos: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
  };
  return texto
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\p{M}\p{Cf}]/gu, '')
    .replace(/[a-z0-9]+/g, (palabra) =>
      /[a-z]/.test(palabra) ? palabra.replace(/[013457]/g, (c) => digitos[c]!) : palabra,
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (letras) => letras.replaceAll(' ', ''))
    .trim();
}

const PATRONES: ReadonlyArray<readonly [AlarmaConsulta, RegExp]> = [
  [
    'dolor-toracico',
    /\b(?:dolor|duele|duelen|opresion|presion|pinchazo|aprieta)\b.{0,60}\b(?:pecho|torax|toracico|esternon)\b/,
  ],
  ['dolor-toracico', /\b(?:pecho|torax)\b.{0,35}\b(?:duele|dolor|oprimido|apretado)\b/],
  [
    'dificultad-respiratoria',
    /\b(?:no puedo|no puede|no consigo|no logra|cuesta|dificultad (?:para|al)) respirar\b/,
  ],
  [
    'dificultad-respiratoria',
    /\b(?:falta (?:el )?aire|falta de aire|ahog(?:o|a|ando)|asfixi\w*|no respir\w*|labios (?:azules|morados))\b/,
  ],
  ['convulsion', /\b(?:convulsion\w*|convulsiv\w*|ataque epileptico)\b/],
  ['sangrado', /\b(?:sangre|sangr(?:a|ar|ado|ando)|hemorrag\w*|heces negras|vomito negro)\b/],
  [
    'fiebre-bebe',
    /\b(?:bebe|lactante|recien nacid\w*)\b.{0,80}\b(?:fiebre|febril|temperatura alta)\b/,
  ],
  [
    'fiebre-bebe',
    /\b(?:fiebre|febril|temperatura alta)\b.{0,80}\b(?:bebe|lactante|recien nacid\w*)\b/,
  ],
  [
    'fiebre-bebe',
    /\b(?:fiebre|febril)\b.{0,80}\b(?:hijo|hija|nino|nina) (?:de )?(?:[0-3]|un|una|dos|tres) (?:dias?|semanas?|mes(?:es)?)\b/,
  ],
  [
    'fiebre-bebe',
    /\b(?:hijo|hija|nino|nina) (?:de )?(?:[0-3]|un|una|dos|tres) (?:dias?|semanas?|mes(?:es)?)\b.{0,80}\b(?:fiebre|febril)\b/,
  ],
  [
    'conducta-suicida',
    /\b(?:suicid\w*|autolesion\w*|matarme|matarse|quitarme la vida|quitarse la vida|hacerme dano|hacerse dano|quiero morir|quiere morir|no quiero (?:seguir )?vivi\w*|acabar con (?:mi|su) vida)\b/,
  ],
  [
    'otra-urgencia',
    /\b(?:inconsciente|no (?:se despierta|responde)|desmayad\w*|sobredosis|intoxicacion|envenen\w*|paralisis|ictus|anafilaxi\w*)\b/,
  ],
];

export function detectarAlarmas(texto: string): AlarmaConsulta[] {
  const normalizado = normalizarAlarma(texto);
  return [...new Set(PATRONES.filter(([, patron]) => patron.test(normalizado)).map(([id]) => id))];
}

/** Prioridad fija; el proveedor no decide ni rebaja la urgencia. */
export function derivar(alarmas: AlarmaConsulta[]): DerivacionConsulta | null {
  const unicas = [...new Set(alarmas)];
  if (unicas.length === 0) return null;
  const emergencia = unicas.some((a) =>
    ['dolor-toracico', 'dificultad-respiratoria', 'convulsion', 'otra-urgencia'].includes(a),
  );
  const destino = emergencia
    ? '112'
    : unicas.includes('conducta-suicida')
      ? '024'
      : unicas.some((a) => a === 'sangrado' || a === 'fiebre-bebe')
        ? 'urgencias'
        : 'medico';
  return DerivacionConsulta.parse({ tipo: 'derivacion', destino, alarmasDetectadas: unicas });
}
