import type { EstadoCatalogoPublico } from '@rebotica/shared';

/** Información desplegable: no añade un aviso permanente a la portada. */
export function EstadoCatalogo({ datos }: { datos?: EstadoCatalogoPublico }) {
  if (!datos) return null;
  return (
    <details className="pointer-events-auto text-sm text-tinta-suave">
      <summary className="min-h-11 cursor-pointer py-2 font-medium text-cruz">
        {datos.estado === 'completo'
          ? 'Copia sincronizada'
          : datos.estado === 'vacio'
            ? 'Catálogo pendiente'
            : 'Copia parcial · resultados provisionales'}
      </summary>
      <div className="space-y-1 pb-2">
        {datos.estado !== 'completo' && (
          <p>
            La carga completa aún no está verificada. Los resultados pueden aumentar al completarla.
          </p>
        )}
        <p>
          {datos.conIndicaciones} de {datos.total} medicamentos tienen indicaciones consultables en
          esta copia.
        </p>
        {datos.sincronizadoHasta && (
          <p>
            Sincronizada hasta el{' '}
            {new Date(datos.sincronizadoHasta).toLocaleDateString('es-ES', { timeZone: 'UTC' })}.
          </p>
        )}
        <p>
          La búsqueda usa el texto de la sección 4.1 de CIMA. Las fichas sin esa sección pueden
          explorarse en el catálogo general.
        </p>
      </div>
    </details>
  );
}
