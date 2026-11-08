/**
 * Catálogo territorial temporal para desarrollo y pruebas.
 *
 * Mockup actual:
 * - 5 estados
 * - 3 municipios por estado
 *
 * IMPORTANTE:
 * Este catálogo NO representa todavía los municipios reales de operación.
 * La relación territorial es Estado -> Municipio y la identidad de un
 * municipio debe evaluarse dentro de su estado, porque un mismo nombre
 * puede existir en estados distintos.
 */

const TERRITORIO: Record<string, readonly string[]> = {
  "Estado 1": ["Municipio A", "Municipio B", "Municipio C"],
  "Estado 2": ["Municipio A", "Municipio B", "Municipio C"],
  "Estado 3": ["Municipio A", "Municipio B", "Municipio C"],
  "Estado 4": ["Municipio A", "Municipio B", "Municipio C"],
  "Estado 5": ["Municipio A", "Municipio B", "Municipio C"],
};

/**
 * Devuelve los municipios configurados para un estado.
 * Un estado inexistente devuelve una lista vacía.
 */
export function obtenerMunicipiosPorEstado(
  estado: string
): readonly string[] {
  return TERRITORIO[estado] ?? [];
}

/**
 * Verifica que un municipio pertenezca al estado indicado.
 *
 * La relación se valida como una unidad compuesta:
 *   estado + municipio
 *
 * Esto evita asumir que el nombre de un municipio sea único globalmente.
 */
export function esRelacionTerritorialValida(
  estado: string,
  municipio: string
): boolean {
  return obtenerMunicipiosPorEstado(estado).includes(municipio);
}
