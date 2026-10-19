/** Aritmética decimal exacta para redondear hacia abajo sin sumar tolerancias al límite. */
export class Racional {
  constructor(
    readonly n: bigint,
    readonly d: bigint = 1n,
  ) {}

  static de(valor: number): Racional {
    const [mantisa = '', exponente = '0'] = valor.toString().toLowerCase().split('e');
    const decimales = mantisa.split('.')[1]?.length ?? 0;
    const escala = decimales - Number(exponente);
    const n = BigInt(mantisa.replace('.', ''));
    return escala >= 0
      ? new Racional(n, 10n ** BigInt(escala))
      : new Racional(n * 10n ** BigInt(-escala));
  }

  multiplicar(b: Racional): Racional {
    return new Racional(this.n * b.n, this.d * b.d);
  }
  dividir(b: Racional): Racional {
    return new Racional(this.n * b.d, this.d * b.n);
  }
  comparar(b: Racional): number {
    const diferencia = this.n * b.d - b.n * this.d;
    return diferencia < 0n ? -1 : diferencia > 0n ? 1 : 0;
  }
  minimo(b: Racional): Racional {
    return this.comparar(b) <= 0 ? this : b;
  }
  suelo(): bigint {
    return this.n / this.d;
  }
  techo(): bigint {
    return (this.n + this.d - 1n) / this.d;
  }

  /** Solo para decimales finitos (denominador potencia de diez), nunca cocientes de dosis. */
  numeroExacto(): number | null {
    const valor = Number(`${this.n}e-${this.d.toString().length - 1}`);
    return Number.isFinite(valor) && Racional.de(valor).comparar(this) === 0 ? valor : null;
  }
}
