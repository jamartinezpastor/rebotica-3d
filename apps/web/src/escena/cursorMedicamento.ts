/** La caja frontal es dueña del hover; la salida de otra caja no debe borrarlo. */
export function marcarMedicamento(lienzo: HTMLCanvasElement, id: string, activo: boolean): void {
  if (activo) {
    lienzo.dataset.cursor = 'medicamento';
    lienzo.dataset.cursorMedicamento = id;
  } else if (lienzo.dataset.cursorMedicamento === id) {
    if (lienzo.dataset.cursor === 'medicamento') delete lienzo.dataset.cursor;
    delete lienzo.dataset.cursorMedicamento;
  }
}
