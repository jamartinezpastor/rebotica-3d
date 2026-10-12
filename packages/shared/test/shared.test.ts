import { describe, expect, it } from 'vitest';
import { AVISO_LEGAL, GrupoPaciente, HealthResponse, TELEFONOS } from '../src/index';

describe('@rebotica/shared', () => {
  it('el aviso legal remite a un profesional', () => {
    expect(AVISO_LEGAL).toMatch(/médico o farmacéutico/);
  });

  it('los teléfonos de derivación son los oficiales', () => {
    expect(TELEFONOS).toEqual({ emergencias: '112', conductaSuicida: '024' });
  });

  it('valida la respuesta de health', () => {
    const ok = HealthResponse.safeParse({
      status: 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
    });
    expect(ok.success).toBe(true);
    expect(HealthResponse.safeParse({ status: 'down', version: '0.1.0' }).success).toBe(false);
  });

  it('rechaza grupos de paciente desconocidos', () => {
    expect(GrupoPaciente.safeParse('anciano').success).toBe(false);
  });
});
