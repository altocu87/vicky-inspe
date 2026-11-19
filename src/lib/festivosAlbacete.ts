// Festivos iniciales de Albacete capital (nacionales + Castilla-La Mancha + locales).
// Se cargan en la tabla `festivos` con la migración; desde ahí se editan en Ajustes.
// La prueba festivos.test.ts comprueba que esta lista y la migración coinciden.
// Fuentes:
//  - 2026 CLM: Decreto 44/2025, de 17 de junio (DOCM 26-06-2025): 12 fiestas.
//  - 2026 Albacete: fiestas locales 24 de junio y 8 de septiembre (resolución de la Delegación
//    Provincial de Economía, Empresas y Empleo, nov. 2025).
//  - 2027 CLM: Decreto 34/2026, de 23 de junio (DOCM 13-07-2026): 12 fiestas.
//  - 2027 Albacete: fiestas locales AÚN NO PUBLICADAS → añadirlas en Ajustes cuando salgan en el BOP.
import type { Festivo } from './habiles'

const D44 = 'Decreto 44/2025 (DOCM 26-06-2025)'
const D34 = 'Decreto 34/2026 (DOCM 13-07-2026)'
const LOC26 = 'Fiestas locales Albacete 2026'

export const FESTIVOS_ALBACETE: readonly Festivo[] = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-01-06', nombre: 'Epifanía del Señor', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-04-02', nombre: 'Jueves Santo', ambito: 'autonomico', fuente: D44 },
  { fecha: '2026-04-03', nombre: 'Viernes Santo', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-04-06', nombre: 'Lunes de Pascua', ambito: 'autonomico', fuente: D44 },
  { fecha: '2026-05-01', nombre: 'Fiesta del Trabajo', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-06-04', nombre: 'Corpus Christi', ambito: 'autonomico', fuente: D44 },
  { fecha: '2026-06-24', nombre: 'Fiesta local de Albacete', ambito: 'local', fuente: LOC26 },
  { fecha: '2026-08-15', nombre: 'Asunción de la Virgen', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-09-08', nombre: 'Virgen de los Llanos (fiesta local)', ambito: 'local', fuente: LOC26 },
  { fecha: '2026-10-12', nombre: 'Fiesta Nacional de España', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-11-02', nombre: 'Lunes siguiente a Todos los Santos', ambito: 'autonomico', fuente: D44 },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción', ambito: 'nacional', fuente: D44 },
  { fecha: '2026-12-25', nombre: 'Natividad del Señor', ambito: 'nacional', fuente: D44 },
  { fecha: '2027-01-01', nombre: 'Año Nuevo', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-01-06', nombre: 'Epifanía del Señor', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-03-25', nombre: 'Jueves Santo', ambito: 'autonomico', fuente: D34 },
  { fecha: '2027-03-26', nombre: 'Viernes Santo', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-05-01', nombre: 'Fiesta del Trabajo', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-05-27', nombre: 'Corpus Christi', ambito: 'autonomico', fuente: D34 },
  { fecha: '2027-05-31', nombre: 'Día de Castilla-La Mancha', ambito: 'autonomico', fuente: D34 },
  { fecha: '2027-10-12', nombre: 'Fiesta Nacional de España', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-11-01', nombre: 'Todos los Santos', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-12-06', nombre: 'Día de la Constitución Española', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción', ambito: 'nacional', fuente: D34 },
  { fecha: '2027-12-25', nombre: 'Natividad del Señor', ambito: 'nacional', fuente: D34 },
]
